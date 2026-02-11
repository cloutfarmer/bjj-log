"use client";

import { useState, useEffect } from "react";
import styles from "./JournalEntry.module.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDateHeading(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${dayName}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

const PREVIEW_LINES = 6;

export default function JournalEntry({ selectedDate, savedText, onSave }) {
  const [text, setText] = useState(savedText);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setText(savedText);
    setEditing(false);
    setExpanded(false);
  }, [savedText, selectedDate]);

  const isLong = savedText.split("\n").length > PREVIEW_LINES || savedText.length > 400;

  const hasContent = savedText.length > 0;

  function handleSave() {
    onSave(selectedDate, text);
    setEditing(false);
  }

  function handleCancel() {
    setText(savedText);
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
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you learn today? Key techniques, rolls, notes..."
            autoFocus
          />
          <div className={styles.actions}>
            <button className={styles.saveBtn} onClick={handleSave}>
              Save
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          {hasContent ? (
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
                  {expanded ? "Show less" : "Show more..."}
                </button>
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
