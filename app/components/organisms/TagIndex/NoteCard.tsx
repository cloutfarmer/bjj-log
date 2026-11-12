"use client";

import { useState } from "react";
import Link from "next/link";
import TagEditor from "../../molecules/TagEditor/TagEditor";
import styles from "./TagIndexView.module.css";

import type { TagEditorProps } from "../../../../lib/useTagState";
import type { JournalEntryData } from "../../../types";

interface NoteCardProps {
  date: string;
  entry: JournalEntryData;
  /** Already includes the hrefFor override. */
  editor: TagEditorProps;
  journalHref: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SESSION_LABELS: Record<string, string> = {
  class: "Class",
  instructing: "Instructing",
  "open-mat": "Open Mat",
  drilling: "Drilling",
  competition: "Competition",
  private: "Private",
};

const PREVIEW_LINES = 6;

function formatDateHeading(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayName = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long" });
  return `${dayName}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

export default function NoteCard({ date, entry, editor, journalHref }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.split("\n").length > PREVIEW_LINES || entry.text.length > 400;
  const attire = entry.attire === "gi" ? "Gi" : entry.attire === "nogi" ? "No-gi" : null;
  const meta = [attire, ...entry.sessionTypes.map(id => SESSION_LABELS[id] ?? id)].filter(Boolean).join(" · ");

  return (
    <article className={styles.noteCard}>
      <h3 className={styles.noteDate}>{formatDateHeading(date)}</h3>
      {meta && <p className={styles.noteMeta}>{meta}</p>}
      <TagEditor {...editor} />
      {entry.text.trim() ? (
        <>
          <div className={`${styles.noteText} ${!expanded && isLong ? styles.collapsed : ""}`}>{entry.text}</div>
          {isLong && (
            <button type="button" className={styles.textButton} onClick={() => setExpanded(value => !value)}>
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </>
      ) : (
        <p className={styles.noteMeta}>Session logged, no notes.</p>
      )}
      <Link href={journalHref} className={styles.journalLink}>Open in journal</Link>
    </article>
  );
}
