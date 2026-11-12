"use client";

import { useState, useEffect } from "react";
import TagEditor from "./molecules/TagEditor/TagEditor";
import NoteCleaner from "./organisms/NoteCleaner/NoteCleaner";
import styles from "./JournalEntry.module.css";

import type { TagEditorProps } from "../../lib/useTagState";

import { ATTIRE_OPTIONS } from "../types";
import type { Attire, JournalEntryData } from "../types";

interface JournalEntryProps {
  selectedDate: string | null;
  savedEntry: JournalEntryData;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (date: string, entry: JournalEntryData) => Promise<void>;
  /** Present only when the AI grammar check is available; it runs only on a button press. */
  onCheckGrammar?: (date: string, text: string) => Promise<{ from: string; to: string }[] | null>;
  /** Present only when tagging is available for this saved note; absent renders nothing new. */
  tagging?: TagEditorProps;
}

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

export default function JournalEntry({ selectedDate, savedEntry, onSave, onDirtyChange, onCheckGrammar, tagging }: JournalEntryProps) {
  const [text, setText] = useState(savedEntry.text);
  const [sessionTypes, setSessionTypes] = useState(savedEntry.sessionTypes);
  const [attire, setAttire] = useState<Attire | null>(savedEntry.attire);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setText(savedEntry.text);
    setSessionTypes(savedEntry.sessionTypes);
    setAttire(savedEntry.attire);
    setEditing(!savedEntry.text && !savedEntry.sessionTypes.length && !savedEntry.attire);
    setExpanded(false);
    setError("");
  }, [savedEntry, selectedDate]);

  useEffect(() => {
    onDirtyChange(editing && (text !== savedEntry.text || attire !== savedEntry.attire || JSON.stringify(sessionTypes) !== JSON.stringify(savedEntry.sessionTypes)));
  }, [editing, text, attire, sessionTypes, savedEntry, onDirtyChange]);

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

  async function handleSave() {
    if (selectedDate === null || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(selectedDate, { text, sessionTypes, attire });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Please retry.");
    } finally { setSaving(false); }
  }

  function handleCancel() {
    setText(savedEntry.text);
    setSessionTypes(savedEntry.sessionTypes);
    setAttire(savedEntry.attire);
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
          {/* Accepting a suggestion goes through setText, so dirty tracking and Cancel work unchanged. */}
          <NoteCleaner
            key={selectedDate}
            text={text}
            onApply={setText}
            onCheckGrammar={onCheckGrammar ? (draft) => onCheckGrammar(selectedDate, draft) : undefined}
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
              {tagging && (
                <div className={styles.tagSection}>
                  <span className={styles.sessionLabel}>Tags</span>
                  <TagEditor {...tagging} />
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
