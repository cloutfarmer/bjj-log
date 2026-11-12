"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchUsage, mergeTags, requestClean, requestCleanup } from "./aiClient";
import { clearDraft } from "./drafts";
import { isDate, isEmptyEntry, parseEntry } from "./entries";
import { SaveConflictError, parseSavedEntry } from "./entrySync";
import { applySaved, loadEntries, pauseRechecks, useJournal as useJournalStore } from "./journalStore";
import { useTagState } from "./useTagState";

import type { AiUsage, TagMerge, TagState, TextEdit } from "./aiClient";
import type { TagEditorProps } from "./useTagState";
import type { Attire, JournalEntryData, SavedEntry } from "../app/types";

/** Where each screen lives. The /dev previews point these inside /dev. */
export interface ScreenHrefs {
  journal: string;
  calendar: string;
  tags: string;
  untagged: string;
}

export const APP_HREFS: ScreenHrefs = { journal: "/", calendar: "/calendar", tags: "/tags", untagged: "/untagged" };

export const tagHref = (hrefs: ScreenHrefs, name: string) => `${hrefs.tags}/${encodeURIComponent(name)}`;
export const dayHref = (hrefs: ScreenHrefs, date: string) => `${hrefs.journal}?date=${date}`;

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The days that have an entry, and the attire of those that recorded one. */
export function calendarMarks(entries: Record<string, JournalEntryData>) {
  const entriesDates = new Set(Object.keys(entries));
  const attireByDate = new Map<string, Attire>();
  for (const [date, entry] of Object.entries(entries)) {
    if (entry.attire) attireByDate.set(date, entry.attire);
  }
  return { entriesDates, attireByDate };
}

/** Everything the screens share. It lives above them, so it survives moving between screens. */
export interface JournalValue {
  hrefs: ScreenHrefs;
  /** False hides the sign-out form (the /dev previews have no session). */
  signOut: boolean;

  entries: Record<string, SavedEntry>;
  /** Entries have loaded; screens render only after this. */
  ready: boolean;
  error: string;
  notice: string;
  clearNotice: () => void;
  retry: () => void;

  selectedDate: string | null;
  /** Returns false when an unsaved draft was kept instead. */
  selectDate: (date: string) => boolean;
  busy: boolean;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  /** Returns false to cancel leaving the journal (unsaved draft). Leaving discards the draft. */
  confirmLeave: () => boolean;
  /**
   * baseVersion is the saved version the draft started from; the server refuses a save
   * over any other, and this then rejects with SaveConflictError.
   */
  save: (date: string, entry: JournalEntryData, baseVersion: string | null | undefined) => Promise<void>;
  /** Takes the server's copy after a refused save. null means the day was deleted. */
  adopt: (date: string, current: SavedEntry | null) => void;

  /** Browser notes from the pre-cloud version that the journal does not have. */
  pendingImportCount: number;
  importNotes: () => void;

  /** null hides all tag UI: the AI routes are missing or failed. */
  tagState: TagState | null;
  tagsLoaded: boolean;
  tagError: string;
  editorProps: (date: string, noteText: string) => TagEditorProps;
  autoTag: (date: string) => Promise<boolean>;
  findMerges: () => Promise<TagMerge[] | null>;
  merge: (from: string, into: string) => Promise<boolean>;
  loadUsage: () => Promise<AiUsage | null>;
  /** Present only when the AI grammar check is available. */
  checkGrammar?: (date: string, text: string) => Promise<TextEdit[] | null>;
}

export const JournalContext = createContext<JournalValue | null>(null);

export function useJournal(): JournalValue {
  const value = useContext(JournalContext);
  if (!value) throw new Error("useJournal needs a JournalProvider above it.");
  return value;
}

const STORAGE_KEY = "bjj-log-entries";
const DISCARD_PROMPT = "Discard unsaved changes?";
const CATCH_UP_LIMIT = 5;

/**
 * The unsaved-draft check shared by the live provider and the /dev preview. The editor
 * reports whether it holds a draft; picking another day or leaving the journal asks first,
 * and agreeing discards the draft from browser storage too.
 */
export function useDraftGuard(selectedDate: string | null) {
  const [dirty, setDirtyState] = useState(false);
  // The day whose draft the user agreed to discard by leaving the journal. The draft is
  // removed when the editor unmounts, because until then the editor may write it again.
  const discardRef = useRef<string | null>(null);

  const setDirty = useCallback((value: boolean) => {
    setDirtyState(value);
    if (!value && discardRef.current) {
      clearDraft(discardRef.current);
      discardRef.current = null;
    }
  }, []);

  /** Before picking another day. Returns false to keep the draft and stay. */
  function confirmSwitch() {
    if (!dirty) return true;
    if (!window.confirm(DISCARD_PROMPT)) return false;
    if (selectedDate) clearDraft(selectedDate);
    setDirty(false);
    return true;
  }

  /** Before leaving the journal screen. Returns false to keep the draft and stay. */
  function confirmLeave() {
    if (!dirty) return true;
    if (!window.confirm(DISCARD_PROMPT)) return false;
    discardRef.current = selectedDate;
    return true;
  }

  return { dirty, setDirty, confirmSwitch, confirmLeave };
}

/** Reads the journal store for every screen and owns the calls that change it. */
export function JournalProvider({ children }: { children: ReactNode }) {
  // Saved entries live in lib/journalStore.ts, which loads them once and rechecks on focus.
  const journal = useJournalStore();
  const { entries, ready } = journal;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { dirty, setDirty, confirmSwitch, confirmLeave } = useDraftGuard(selectedDate);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [localNotes, setLocalNotes] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const tag = useTagState();
  const { tagState, reload, autoTag, forget } = tag;
  // React strict mode runs mount effects twice in dev; the catch-up must run once.
  const startedRef = useRef(false);

  // An open draft must not have its entry replaced under it by a background check.
  useEffect(() => {
    pauseRechecks(dirty);
    return () => pauseRechecks(false);
  }, [dirty]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setSelectedDate(dateKey(new Date()));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw !== "{}") setLocalNotes(raw);
    } catch { /* Cloud notes still work if browser storage is unavailable. */ }
    void (async () => {
      const tagsLoading = reload();
      // The store reports a failed load itself; this only waits for the first answer.
      await loadEntries();
      // Tags notes saved while AI was unavailable, newest first and one at a time to keep provider load low.
      const state = await tagsLoading;
      if (!state) return;
      // One note that can't be tagged must not block the ones behind it, but two failures
      // in a row mean tagging is down, so stop until the next load.
      let tagged = 0;
      let failures = 0;
      for (const date of state.pending) {
        if (tagged >= CATCH_UP_LIMIT || failures >= 2) return;
        if (await autoTag(date)) { tagged++; failures = 0; } else failures++;
      }
    })();
  }, [reload, autoTag]);

  const retry = useCallback(() => {
    setError("");
    void loadEntries();
  }, []);

  function selectDate(date: string) {
    if (date === selectedDate) return true;
    if (!confirmSwitch()) return false;
    setSelectedDate(date);
    return true;
  }

  async function save(dateStr: string, entry: JournalEntryData, baseVersion: string | null | undefined) {
    setBusy(true);
    setNotice("");
    const previousText = entries[dateStr]?.text;
    try {
      const response = await fetch("/api/entries", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, entry, baseVersion }),
      });
      if (response.status === 409) {
        const body: unknown = await response.json().catch(() => null);
        const current = body && typeof body === "object" ? parseSavedEntry((body as { current?: unknown }).current) : null;
        throw new SaveConflictError(current);
      }
      if (!response.ok) throw new Error("Could not save. Your draft is still open; check your connection or sign in again, then retry.");
      const result: unknown = await response.json().catch(() => null);
      const version = result && typeof result === "object" ? (result as { version?: unknown }).version : undefined;
      // isEmptyEntry is also the server's rule in app/api/entries/route.ts.
      applySaved(dateStr, isEmptyEntry(entry) ? null : { ...entry, version: typeof version === "string" ? version : "" });
      setNotice("Saved to your journal.");
      // Tagging is best effort and never delays or fails the save.
      if (isEmptyEntry(entry)) forget(dateStr);
      // Tags come from the text, so a save that leaves it unchanged asks for nothing.
      if (entry.text.trim() && tagState && entry.text !== previousText) void autoTag(dateStr);
    } finally { setBusy(false); }
  }

  function adopt(dateStr: string, current: SavedEntry | null) {
    applySaved(dateStr, current);
    setNotice("");
    if (!current) forget(dateStr);
  }

  // Offer only meaningful browser notes whose dates are absent from the cloud.
  let pendingImport: Record<string, JournalEntryData> = {};
  if (ready && localNotes) {
    try {
      const parsed: unknown = JSON.parse(localNotes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        pendingImport = Object.fromEntries(Object.entries(parsed).flatMap(([date, value]) => {
          const entry = parseEntry(value);
          return isDate(date) && !Object.hasOwn(entries, date) && entry && !isEmptyEntry(entry) ? [[date, entry]] : [];
        }));
      }
    } catch { /* Invalid or empty browser data is not an importable note. */ }
  }

  async function importNotes() {
    if (!localNotes) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/entries/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingImport),
      });
      if (!response.ok) throw new Error("Could not import notes. Your original browser notes are unchanged.");
      const result: { imported: number } = await response.json();
      await loadEntries({ full: true });
      setLocalNotes(null);
      setNotice(`Imported ${result.imported} notes. Existing cloud notes were kept; browser originals remain untouched.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setBusy(false); }
  }

  const value: JournalValue = {
    hrefs: APP_HREFS,
    signOut: true,
    entries,
    ready,
    error: error || journal.error,
    notice,
    clearNotice: () => setNotice(""),
    retry,
    selectedDate,
    selectDate,
    busy,
    dirty,
    setDirty,
    confirmLeave,
    save,
    adopt,
    pendingImportCount: Object.keys(pendingImport).length,
    importNotes: () => { void importNotes(); },
    tagState,
    tagsLoaded: tag.loaded,
    tagError: tag.error,
    editorProps: (date, noteText) => ({ ...tag.editorProps(date, noteText), hrefFor: name => tagHref(APP_HREFS, name) }),
    autoTag,
    findMerges: requestCleanup,
    merge: async (from, into) => {
      const ok = await mergeTags(from, into);
      await reload();
      return ok;
    },
    loadUsage: fetchUsage,
    checkGrammar: tagState?.available ? requestClean : undefined,
  };

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}
