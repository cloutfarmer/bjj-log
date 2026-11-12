"use client";

import Link from "next/link";
import { useJournal } from "../../../../lib/useJournal";
import pageStyles from "../../../page.module.css";
import NoteList, { useTagIndex } from "./NoteList";
import styles from "./TagIndexView.module.css";

/** The Tag screen: every note that carries one tag. */
export default function TagDetail({ name }: { name: string }) {
  const { tagsLoaded, hrefs } = useJournal();
  const index = useTagIndex();

  if (!tagsLoaded) return <p className={pageStyles.loading} aria-busy="true">Loading tags…</p>;

  const tag = index.buckets.flatMap(group => group.tags).find(item => item.name === name);
  return (
    <div className={styles.view}>
      <Link href={hrefs.tags} className={styles.backButton}>‹ All tags</Link>
      {tag ? (
        <>
          <div>
            <h2 className={styles.tagHeading}>{tag.name}</h2>
            <p className={styles.noteMeta}>{tag.bucket} · {tag.count === 1 ? "1 note" : `${tag.count} notes`}</p>
          </div>
          {tag.count === 0
            ? <p className={styles.empty}>No notes have this tag.</p>
            : <NoteList key={tag.name} dates={tag.dates} />}
        </>
      ) : (
        <p className={styles.empty}>No tag named “{name}”.</p>
      )}
    </div>
  );
}
