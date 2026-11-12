"use client";

import { useState, useEffect, useRef } from "react";
import { clearDraft, readDraft, writeDraft } from "../../lib/drafts";
import { isEmptyEntry } from "../../lib/entries";
import { SaveConflictError, sameContent } from "../../lib/entrySync";
import styles from "./JournalEntry.module.css";

import { ATTIRE_OPTIONS } from "../types";
import type { Attire, JournalEntryData, SavedEntry } from "../types";
import type { Draft } from "../../lib/drafts";

/** The saved version a save is based on: null for a day with no entry, undefined when unknown. */
type BaseVersion = string | null | undefined;

interface JournalEntryProps {
  selectedDate: string | null;
  savedEntry: JournalEntryData;
  /** The version of savedEntry. */
  savedVersion?: BaseVersion;
  onDirtyChange: (dirty: boolean) => void;
  /** Rejects with SaveConflictError when the day changed elsewhere; nothing was saved then. */
  onSave: (date: string, entry: JournalEntryData, baseVersion: BaseVersion) => Promise<void>;
  /** The user took the server's copy after a refused save. null means the day was deleted. */
  onAdopt?: (date: string, current: SavedEntry | null) => void;
}

const DRAFT_DELAY_MS = 500;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SESSION_TYPES = [
  { id: "class",       label: "Class" },
  { id: "instructing", label: "Instructing" },
  { id: "open-mat",    label: "Open Mat" },
  { id: "drilling",    label: "Drilling" },
  { id: "competition", label: "Competition" },
  { id: "private",     label: "Private" },
];

function formatDateHeading(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${dayName}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

const PREVIEW_LINES = 6;

export default function JournalEntry({ selectedDate, savedEntry, savedVersion, onSave, onDirtyChange, onAdopt }: JournalEntryProps) {
  const [text, setText] = useState(savedEntry.text);
  const [sessionTypes, setSessionTypes] = useState(savedEntry.sessionTypes);
  const [attire, setAttire] = useState<Attire | null>(savedEntry.attire);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set when the server refused a save because the day changed elsewhere.
  const [conflict, setConflict] = useState<{ current: SavedEntry | null } | null>(null);
  const [restored, setRestored] = useState(false);
  // Replaces savedVersion as the base of the next save: a restored draft keeps the
  // version it was started from.
  const [baseOverride, setBaseOverride] = useState<{ value: BaseVersion } | null>(null);
  const savingRef = useRef(false);
  const keepDraftRef = useRef(false);
  const latestDraftRef = useRef<{ date: string; draft: Draft } | null>(null);
  const fieldsRef = useRef<JournalEntryData>(savedEntry);
  // What the previous render showed, read by the effect below before it is updated.
  const previousRef = useRef<{ date: string | null; dirty: boolean; version: BaseVersion }>({ date: null, dirty: false, version: undefined });

  useEffect(() => {
    fieldsRef.current = { text, sessionTypes, attire };
  });

  useEffect(() => {
    // The saved entry changed under an open draft, and not because of this editor's own
    // save. Keep the draft. It stays based on the version it started from, so saving it
    // is refused and the user is shown both copies.
    const previous = previousRef.current;
    if (previous.date === selectedDate && previous.dirty && !sameContent(fieldsRef.current, savedEntry)) {
      setBaseOverride((current) => current ?? { value: previous.version });
      return;
    }
    // A save in flight is about to replace savedEntry; its draft must not come back.
    const draft = selectedDate && !savingRef.current ? readDraft(selectedDate) : null;
    const restore = draft && !sameContent(draft.entry, savedEntry) ? draft : null;
    const shown = restore?.entry ?? savedEntry;
    keepDraftRef.current = restore !== null;
    setText(shown.text);
    setSessionTypes(shown.sessionTypes);
    setAttire(shown.attire);
    setEditing(restore !== null || (!savedEntry.text && !savedEntry.sessionTypes.length && !savedEntry.attire));
    setRestored(restore !== null);
    setBaseOverride(restore ? { value: restore.baseVersion } : null);
    setConflict(null);
    setExpanded(false);
    setError("");
  }, [savedEntry, selectedDate]);

  const dirty = editing && !sameContent({ text, sessionTypes, attire }, savedEntry);
  const baseVersion = baseOverride ? baseOverride.value : savedVersion;

  useEffect(() => {
    previousRef.current = { date: selectedDate, dirty, version: savedVersion };
  });

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Keep the unsaved draft on this device, so a reload or an evicted tab doesn't lose it.
  useEffect(() => {
    latestDraftRef.current = dirty && selectedDate
      ? { date: selectedDate, draft: { entry: { text, sessionTypes, attire }, baseVersion } }
      : null;
    if (!selectedDate) return;
    if (!dirty) {
      // The effect above has just restored a draft that this render doesn't show yet.
      if (keepDraftRef.current) keepDraftRef.current = false;
      else if (!savingRef.current) clearDraft(selectedDate);
      return;
    }
    keepDraftRef.current = false;
    const timer = setTimeout(() => {
      if (latestDraftRef.current) writeDraft(latestDraftRef.current.date, latestDraftRef.current.draft);
    }, DRAFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dirty, selectedDate, text, sessionTypes, attire, baseVersion]);

  // A phone can drop a hidden tab without warning, so write at once when the page hides.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && latestDraftRef.current) {
        writeDraft(latestDraftRef.current.date, latestDraftRef.current.draft);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, []);

  const savedText = savedEntry.text;
  const isLong = savedText.split("\n").length > PREVIEW_LINES || savedText.length > 400;
  const hasContent = savedText.length > 0 || savedEntry.sessionTypes.length > 0 || savedEntry.attire !== null;
  const savedAttire = ATTIRE_OPTIONS.find((option) => option.id === savedEntry.attire);

  function toggleType(id: string) {
    setSessionTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  /** Re-picking the current choice clears it, so "unrecorded" stays reachable. */
  function toggleAttire(id: Attire) {
    setAttire((prev) => (prev === id ? null : id));
  }

  function show(entry: JournalEntryData) {
    setText(entry.text);
    setSessionTypes(entry.sessionTypes);
    setAttire(entry.attire);
    setConflict(null);
    setRestored(false);
    setBaseOverride(null);
    setError("");
  }

  async function save(base: BaseVersion) {
    if (selectedDate === null || saving) return;
    const entry = { text, sessionTypes, attire };
    setSaving(true);
    savingRef.current = true;
    setError("");
    try {
      await onSave(selectedDate, entry, base);
      clearDraft(selectedDate);
      setConflict(null);
      setRestored(false);
      setBaseOverride(null);
      // A day saved empty is deleted, and a day with no entry stays in the editor.
      setEditing(isEmptyEntry(entry));
    } catch (cause) {
      if (cause instanceof SaveConflictError) setConflict({ current: cause.current });
      else setError(cause instanceof Error ? cause.message : "Could not save. Please retry.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function handleSave() {
    // Nothing changed, so there is nothing to send.
    if (!dirty && !conflict) {
      if (hasContent) setEditing(false);
      return;
    }
    void save(baseVersion);
  }

  /** Saves the draft over the copy the server showed in the conflict. */
  function saveOverOther() {
    if (!conflict) return;
    void save(conflict.current ? conflict.current.version || undefined : null);
  }

  /** Drops the draft and takes the copy the server showed in the conflict. */
  function adoptOther() {
    if (selectedDate === null || !conflict) return;
    const current = conflict.current;
    clearDraft(selectedDate);
    show(current ?? { text: "", sessionTypes: [], attire: null });
    setEditing(current === null || isEmptyEntry(current));
    onAdopt?.(selectedDate, current);
  }

  function handleCancel() {
    if (selectedDate !== null) clearDraft(selectedDate);
    show(savedEntry);
    setEditing(false);
  }

  if (!selectedDate) {
    return (
      <div className={styles.container}>
        <p className={styles.placeholder}>Select a day to view or add a journal entry.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.dateHeading}>{formatDateHeading(selectedDate)}</h2>

      {editing ? (
        <>
          <fieldset disabled={saving} style={{ border: 0, minWidth: 0 }}>
          <div className={styles.sessionSection}>
            <span className={styles.sessionLabel}>Gi or no-gi</span>
            <div className={styles.attireRow} role="group" aria-label="Gi or no-gi">
              {ATTIRE_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={attire === id}
                  className={
                    `${styles.pill} ${id === "gi" ? styles.attireGi : styles.attireNogi}` +
                    (attire === id ? ` ${styles.pillActive}` : "")
                  }
                  onClick={() => toggleAttire(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.attireHint}>
              {attire ? "Tap again to clear." : "Not recorded for this session."}
            </p>
          </div>

          <div className={styles.sessionSection}>
            <span className={styles.sessionLabel}>Session type</span>
            <div className={styles.sessionPills}>
              {SESSION_TYPES.map(({ id, label }) => (
                <button
                  key={id}
                  className={
                    styles.pill +
                    (sessionTypes.includes(id) ? ` ${styles.pillActive}` : "")
                  }
                  onClick={() => toggleType(id)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            className={styles.textarea}
            aria-label="Training notes"
            maxLength={50000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you learn today? Key techniques, rolls, notes..."
          />
          <div className={styles.actions}>
            <button className={styles.saveBtn} onClick={handleSave}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
          </div>
          </fieldset>
          {restored && !conflict && (
            <p role="status" className={styles.draftNote}>Restored your unsaved draft from this device. Cancel discards it.</p>
          )}
          {conflict && (
            <div role="alert" className={styles.conflict}>
              <p>
                <strong>This day was changed somewhere else after you opened it.</strong> Nothing was saved, and your
                draft is still above.
              </p>
              {conflict.current ? (
                <>
                  <p className={styles.sessionLabel}>The other version</p>
                  <p className={styles.conflictMeta}>
                    {[
                      ATTIRE_OPTIONS.find((option) => option.id === conflict.current?.attire)?.label,
                      ...conflict.current.sessionTypes.map((id) => SESSION_TYPES.find((t) => t.id === id)?.label ?? id),
                    ].filter(Boolean).join(" · ") || "No session details"}
                  </p>
                  <div className={styles.conflictText}>{conflict.current.text || "No notes."}</div>
                </>
              ) : (
                <p>The other version deleted this day.</p>
              )}
              <div className={styles.actions}>
                <button type="button" className={styles.saveBtn} disabled={saving} onClick={saveOverOther}>
                  Save my version
                </button>
                <button type="button" className={styles.cancelBtn} disabled={saving} onClick={adoptOther}>
                  Use the other version
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </>
      ) : (
        <>
          {hasContent ? (
            <>
              {savedAttire && (
                <div className={styles.attireRow}>
                  <span
                    className={
                      `${styles.pill} ${styles.pillActive} ${styles.pillStatic} ` +
                      (savedAttire.id === "gi" ? styles.attireGi : styles.attireNogi)
                    }
                  >
                    {savedAttire.label}
                  </span>
                </div>
              )}
              {savedEntry.sessionTypes.length > 0 && (
                <div className={styles.sessionPills}>
                  {savedEntry.sessionTypes.map((id) => {
                    const match = SESSION_TYPES.find((t) => t.id === id);
                    return (
                      <span key={id} className={`${styles.pill} ${styles.pillActive} ${styles.pillStatic}`}>
                        {match ? match.label : id}
                      </span>
                    );
                  })}
                </div>
              )}
              {savedText.length > 0 && (
                <>
                  <div
                    className={
                      styles.entryText +
                      (!expanded && isLong ? ` ${styles.collapsed}` : "")
                    }
                  >
                    {savedText}
                  </div>
                  {isLong && (
                    <button
                      className={styles.expandBtn}
                      onClick={() => setExpanded((e) => !e)}
                    >
                      {expanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <p className={styles.placeholder}>No entry for this day yet.</p>
          )}
          <button
            className={styles.editBtn}
            onClick={() => setEditing(true)}
          >
            {hasContent ? "Edit Entry" : "Add Entry"}
          </button>
        </>
      )}
    </div>
  );
}
