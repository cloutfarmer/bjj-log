"use client";

import { useState } from "react";
import Link from "next/link";
import { filterTagIndex, searchNotes } from "../../../../lib/tagIndex";
import { tagHref, useJournal } from "../../../../lib/useJournal";
import pageStyles from "../../../page.module.css";
import NoteList, { useTagIndex } from "./NoteList";
import styles from "./TagIndexView.module.css";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatLast(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const year = y === new Date().getFullYear() ? "" : ` ${y}`;
  return `${d} ${SHORT_MONTHS[m - 1]}${year}`;
}

function describe(count: number, lastDate: string | null) {
  const noun = count === 0 ? "no notes" : count === 1 ? "1 note" : `${count} notes`;
  return lastDate ? `${noun} · last ${formatLast(lastDate)}` : noun;
}

/** The Tags screen: every tag by bucket, and a search over tags and note text. */
export default function TagList() {
  const { entries, tagState, tagsLoaded, hrefs } = useJournal();
  const index = useTagIndex();
  const [query, setQuery] = useState("");

  if (!tagsLoaded) return <p className={pageStyles.loading} aria-busy="true">Loading tags…</p>;

  const q = query.trim();
  const groups = q ? filterTagIndex(index, q) : index.buckets;
  const matches = q ? searchNotes(entries, q) : [];

  return (
    <div className={styles.view}>
      <input
        type="search"
        className={styles.search}
        aria-label="Search tags and notes"
        placeholder="Search tags and notes"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      {!q && tagState === null && (
        <p className={styles.empty}>Tags are unavailable right now. Your notes are safe, and search still works.</p>
      )}
      {!q && tagState !== null && groups.length === 0 && (
        <p className={styles.empty}>No tags yet. Tag a note to start your index.</p>
      )}
      {groups.map(group => (
        <section key={group.bucket} className={styles.bucket}>
          <h2 className={styles.bucketHeading}>{group.bucket}</h2>
          {group.tags.map(tag => (
            <Link key={tag.name} href={tagHref(hrefs, tag.name)} className={styles.tagRow}>
              <span className={styles.tagName}>{tag.name}</span>
              <span className={styles.tagMeta}>
                {describe(tag.count, tag.lastDate)}
                <span aria-hidden="true" className={styles.chevron}>›</span>
              </span>
            </Link>
          ))}
        </section>
      ))}
      {q && matches.length > 0 && (
        <section className={styles.bucket}>
          <h2 className={styles.bucketHeading}>Notes mentioning “{q}”</h2>
          <NoteList key={q} dates={matches} />
        </section>
      )}
      {q && groups.length === 0 && matches.length === 0 && <p className={styles.empty}>Nothing matches “{q}”.</p>}
    </div>
  );
}
