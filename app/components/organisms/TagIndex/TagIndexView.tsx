"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BUCKETS } from "../../../../lib/ai/buckets";
import { buildTagIndex, filterTagIndex, searchNotes } from "../../../../lib/tagIndex";
import pageStyles from "../../../page.module.css";
import TagCleanup from "../TagCleanup/TagCleanup";
import AiUsage from "../AiUsage/AiUsage";
import AutoTagBar from "./AutoTagBar";
import NoteCard from "./NoteCard";
import styles from "./TagIndexView.module.css";

import type { AiUsage as AiUsageData, TagState } from "../../../../lib/aiClient";
import type { TagEditorProps } from "../../../../lib/useTagState";
import type { JournalEntryData } from "../../../types";

export interface TagIndexViewProps {
  entries: Record<string, JournalEntryData>;
  /** null: tags unavailable. */
  tagState: TagState | null;
  editorProps: (date: string, noteText: string) => TagEditorProps;
  autoTag: (date: string) => Promise<boolean>;
  onFindMerges: () => Promise<{ from: string; into: string }[] | null>;
  onMerge: (from: string, into: string) => Promise<boolean>;
  onLoadUsage: () => Promise<AiUsageData | null>;
  /** "Open in journal" link target. */
  journalHref: (date: string) => string;
}

const PAGE_SIZE = 10;
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

export default function TagIndexView({
  entries, tagState, editorProps, autoTag, onFindMerges, onMerge, onLoadUsage, journalHref,
}: TagIndexViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const selectedTag = params.get("tag");
  const untaggedTab = selectedTag === null && params.get("view") === "untagged";

  const index = buildTagIndex(entries, tagState?.entryTags ?? {}, tagState?.tags ?? {}, BUCKETS);
  const hrefFor = (name: string) => `${pathname}?tag=${encodeURIComponent(name)}`;
  const go = (search: string) => router.push(`${pathname}${search}`);

  const renderCards = (dates: string[]): ReactNode =>
    dates.map(date => (
      <NoteCard
        key={date}
        date={date}
        entry={entries[date]}
        editor={{ ...editorProps(date, entries[date].text), hrefFor }}
        journalHref={journalHref(date)}
      />
    ));

  if (selectedTag !== null) {
    const tag = index.buckets.flatMap(group => group.tags).find(item => item.name === selectedTag);
    return (
      <div className={styles.view}>
        <button type="button" className={styles.backButton} onClick={() => go("")}>‹ All tags</button>
        {tag ? (
          <>
            <div>
              <h2 className={styles.tagHeading}>{tag.name}</h2>
              <p className={styles.noteMeta}>{tag.bucket} · {tag.count === 1 ? "1 note" : `${tag.count} notes`}</p>
            </div>
            {tag.count === 0
              ? <p className={styles.empty}>No notes have this tag.</p>
              : <PagedList key={tag.name} dates={tag.dates} render={renderCards} />}
          </>
        ) : (
          <p className={styles.empty}>No tag named “{selectedTag}”.</p>
        )}
      </div>
    );
  }

  const q = query.trim();
  const groups = q ? filterTagIndex(index, q) : index.buckets;
  const matches = q ? searchNotes(entries, q) : [];
  const candidates = tagState ? index.untagged.filter(date => !Object.hasOwn(tagState.entryTags, date)) : [];

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
      <div className={styles.switch} role="group" aria-label="View">
        <button type="button" aria-pressed={!untaggedTab} className={styles.switchButton} onClick={() => go("")}>Tags</button>
        <button type="button" aria-pressed={untaggedTab} className={styles.switchButton} onClick={() => go("?view=untagged")}>
          Untagged ({index.untagged.length})
        </button>
      </div>

      {untaggedTab ? (
        <>
          {tagState && <AutoTagBar candidates={candidates} available={tagState.available} autoTag={autoTag} />}
          {index.untagged.length === 0
            ? <p className={styles.empty}>Every note with text has a tag.</p>
            : <PagedList dates={index.untagged} render={renderCards} />}
        </>
      ) : (
        <>
          {!q && tagState === null && (
            <p className={styles.empty}>Tags are unavailable right now. Your notes are safe, and search below still works.</p>
          )}
          {!q && tagState !== null && groups.length === 0 && (
            <p className={styles.empty}>No tags yet. Tag a note to start your index.</p>
          )}
          {groups.map(group => (
            <section key={group.bucket} className={styles.bucket}>
              <h2 className={styles.bucketHeading}>{group.bucket}</h2>
              {group.tags.map(tag => (
                <button key={tag.name} type="button" className={styles.tagRow} onClick={() => go(`?tag=${encodeURIComponent(tag.name)}`)}>
                  <span className={styles.tagName}>{tag.name}</span>
                  <span className={styles.tagMeta}>
                    {describe(tag.count, tag.lastDate)}
                    <span aria-hidden="true" className={styles.chevron}>›</span>
                  </span>
                </button>
              ))}
            </section>
          ))}
          {q && (
            <section className={styles.bucket}>
              <h2 className={styles.bucketHeading}>Notes mentioning “{q}”</h2>
              {matches.length > 0 && <PagedList key={q} dates={matches} render={renderCards} />}
            </section>
          )}
          {q && groups.length === 0 && matches.length === 0 && <p className={styles.empty}>Nothing matches “{q}”.</p>}
          {tagState && (
            <section aria-label="AI tools" className={`${pageStyles.aiTools} ${pageStyles.card}`}>
              <TagCleanup due={tagState.cleanupDue} available={tagState.available} onFind={onFindMerges} onMerge={onMerge} />
              <AiUsage onLoad={onLoadUsage} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PagedList({ dates, render }: { dates: string[]; render: (dates: string[]) => ReactNode }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  return (
    <div className={styles.notes}>
      {render(dates.slice(0, shown))}
      {dates.length > shown && (
        <button type="button" className={pageStyles.showMore} onClick={() => setShown(value => value + PAGE_SIZE)}>Show more</button>
      )}
    </div>
  );
}
