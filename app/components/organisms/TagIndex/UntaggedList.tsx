"use client";

import { useEffect, useState } from "react";
import { useJournal } from "../../../../lib/useJournal";
import pageStyles from "../../../page.module.css";
import AiUsage from "../AiUsage/AiUsage";
import TagCleanup from "../TagCleanup/TagCleanup";
import AutoTagBar from "./AutoTagBar";
import NoteList, { useTagIndex } from "./NoteList";
import styles from "./TagIndexView.module.css";

/** The Untagged screen: notes with text and no tag, tagged one by one or in a batch, plus the tag upkeep tools. */
export default function UntaggedList() {
  const { entries, tagState, tagsLoaded, autoTag, findMerges, merge, loadUsage } = useJournal();
  const index = useTagIndex();

  // Dates shown as untagged during this visit stay listed after they gain tags.
  const [seen, setSeen] = useState<string[]>([]);
  const untaggedKey = index.untagged.join(",");
  useEffect(() => {
    setSeen(prev => {
      const next = new Set(prev.filter(date => Object.hasOwn(entries, date)));
      for (const date of index.untagged) next.add(date);
      return next.size === prev.length && prev.every(date => next.has(date)) ? prev : [...next];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [untaggedKey, entries]);

  if (!tagsLoaded) return <p className={pageStyles.loading} aria-busy="true">Loading tags…</p>;
  if (!tagState) {
    return (
      <div className={styles.view}>
        <p className={styles.empty}>Tags are unavailable right now. Your notes are safe.</p>
      </div>
    );
  }

  const list = [...new Set([...seen, ...index.untagged])]
    .filter(date => Object.hasOwn(entries, date))
    .sort()
    .reverse();
  const candidates = index.untagged.filter(date => !Object.hasOwn(tagState.entryTags, date));
  const count = index.untagged.length;

  return (
    <div className={styles.view}>
      <div>
        <h2 className={styles.tagHeading}>Untagged notes</h2>
        <p className={styles.noteMeta} role="status">
          {count === 0 ? "Every note with text has a tag." : count === 1 ? "1 note has no tag yet." : `${count} notes have no tag yet.`}
        </p>
      </div>
      <AutoTagBar candidates={candidates} available={tagState.available} autoTag={autoTag} />
      {list.length > 0 && (
        <NoteList dates={list} noteFor={date => (index.untagged.includes(date) ? undefined : "Tagged")} />
      )}
      <section aria-label="AI tools" className={`${pageStyles.aiTools} ${pageStyles.card}`}>
        <TagCleanup due={tagState.cleanupDue} available={tagState.available} onFind={findMerges} onMerge={merge} />
        <AiUsage onLoad={loadUsage} />
      </section>
    </div>
  );
}
