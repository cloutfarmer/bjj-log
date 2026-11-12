"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fetchUsage, mergeTags, requestClean, requestCleanup } from "./aiClient";
import { isDate, parseEntry } from "./entries";
import { useTagState } from "./useTagState";

import type { AiUsage, TagMerge, TagState, TextEdit } from "./aiClient";
import type { TagEditorProps } from "./useTagState";
import type { Attire, JournalEntryData } from "../app/types";

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

  entries: Record<string, JournalEntryData>;
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
  /** Returns false to cancel leaving the journal (unsaved draft). */
  confirmLeave: () => boolean;
  save: (date: string, entry: JournalEntryData) => Promise<void>;

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
const isEmpty = (entry: JournalEntryData) => !entry.text.trim() && !entry.sessionTypes.length && !entry.attire;

/** Loads the journal once for every screen and owns the calls that change it. */
export function JournalProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, JournalEntryData>>({});
  const [ready, setReady] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [localNotes, setLocalNotes] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const tag = useTagState();
  const { tagState, reload, autoTag, forget } = tag;
  // React strict mode runs mount effects twice in dev; loading and the catch-up must run once.
  const startedRef = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/entries", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load notes. Check your connection and sign in again if needed.");
    const data: Record<string, JournalEntryData> = await response.json();
    setEntries(data);
    setReady(true);
  }, []);

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
      try {
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load notes.");
        return;
      }
      // Tags notes saved while AI was unavailable, newest first and one at a time to keep provider load low.
      const state = await tagsLoading;
      if (!state) return;
      for (const date of state.pending.slice(0, 5)) {
        if (!(await autoTag(date))) return;
      }
    })();
  }, [refresh, reload, autoTag]);

  const retry = useCallback(() => {
    setError("");
    refresh().catch((cause: Error) => setError(cause.message));
  }, [refresh]);

  function selectDate(date: string) {
    if (date === selectedDate) return true;
    if (dirty && !window.confirm(DISCARD_PROMPT)) return false;
    setDirty(false);
    setSelectedDate(date);
    return true;
  }

  async function save(dateStr: string, entry: JournalEntryData) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/entries", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, entry }),
      });
      if (!response.ok) throw new Error("Could not save. Your draft is still open; check your connection or sign in again, then retry.");
      setEntries(previous => {
        const updated = { ...previous };
        // Must match the server's rule in app/api/entries/route.ts, attire included.
        if (isEmpty(entry)) delete updated[dateStr];
        else updated[dateStr] = entry;
        return updated;
      });
      setNotice("Saved to your journal.");
      // Tagging is best effort and never delays or fails the save.
      if (isEmpty(entry)) forget(dateStr);
      if (entry.text.trim() && tagState) void autoTag(dateStr);
    } finally { setBusy(false); }
  }

  // Offer only meaningful browser notes whose dates are absent from the cloud.
  let pendingImport: Record<string, JournalEntryData> = {};
  if (ready && localNotes) {
    try {
      const parsed: unknown = JSON.parse(localNotes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        pendingImport = Object.fromEntries(Object.entries(parsed).flatMap(([date, value]) => {
          const entry = parseEntry(value);
          return isDate(date) && !Object.hasOwn(entries, date) && entry && !isEmpty(entry) ? [[date, entry]] : [];
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
      await refresh();
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
    error,
    notice,
    clearNotice: () => setNotice(""),
    retry,
    selectedDate,
    selectDate,
    busy,
    dirty,
    setDirty,
    confirmLeave: () => !dirty || window.confirm(DISCARD_PROMPT),
    save,
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
