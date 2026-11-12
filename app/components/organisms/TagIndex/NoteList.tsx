"use client";

import { useState } from "react";
import { BUCKETS } from "../../../../lib/ai/buckets";
import { buildTagIndex } from "../../../../lib/tagIndex";
import { dayHref, useJournal } from "../../../../lib/useJournal";
import pageStyles from "../../../page.module.css";
import NoteCard from "./NoteCard";
import styles from "./TagIndexView.module.css";

const PAGE_SIZE = 10;

/** The tag index of the loaded journal. Built in the browser, so it makes no request. */
export function useTagIndex() {
  const { entries, tagState } = useJournal();
  return buildTagIndex(entries, tagState?.entryTags ?? {}, tagState?.tags ?? {}, BUCKETS);
}

interface NoteListProps {
  /** Newest first. */
  dates: string[];
  /** A small muted line above a note's tag editor, such as "Tagged". */
  noteFor?: (date: string) => string | undefined;
}

/** Notes as cards with their tag editors, ten at a time. */
export default function NoteList({ dates, noteFor }: NoteListProps) {
  const { entries, tagState, editorProps, hrefs } = useJournal();
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <div className={styles.notes}>
      {dates.slice(0, shown).map(date => (
        <NoteCard
          key={date}
          date={date}
          entry={entries[date]}
          note={noteFor?.(date)}
          editor={tagState ? editorProps(date, entries[date].text) : undefined}
          journalHref={dayHref(hrefs, date)}
        />
      ))}
      {dates.length > shown && (
        <button type="button" className={pageStyles.showMore} onClick={() => setShown(value => value + PAGE_SIZE)}>Show more</button>
      )}
    </div>
  );
}
