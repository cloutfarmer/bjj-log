"use client";

import { useState } from "react";
import { useJournal } from "../../../../lib/useJournal";
import styles from "../../../page.module.css";

const PAGE_SIZE = 5;

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The newest entries, each a shortcut to its day on the journal screen. */
export default function RecentEntries() {
  const { entries, selectedDate, selectDate, tagState } = useJournal();
  const [shown, setShown] = useState(PAGE_SIZE);
  const dates = Object.keys(entries).sort().reverse();

  return (
    <aside className={`${styles.recent} ${styles.card}`}>
      <h2>Recent entries</h2>
      {dates.slice(0, shown).map(date => {
        const entry = entries[date];
        const meta = [
          entry.attire === "gi" ? "Gi" : entry.attire === "nogi" ? "No-Gi" : "",
          ...entry.sessionTypes,
          ...(tagState?.entryTags[date]?.tags.map(item => item.name) ?? []),
        ].filter(Boolean).join(" · ");
        return (
          <button
            key={date}
            type="button"
            className={styles.recentItem}
            onClick={() => selectDate(date)}
            aria-current={date === selectedDate ? "date" : undefined}
          >
            <strong>{formatDate(date)}</strong>
            <span>{entry.text || "Session logged"}</span>
            <small>{meta}</small>
          </button>
        );
      })}
      {!dates.length && <p>Your training notes will appear here.</p>}
      {dates.length > shown && (
        <button type="button" className={styles.showMore} onClick={() => setShown(count => count + PAGE_SIZE)}>Show more</button>
      )}
    </aside>
  );
}
