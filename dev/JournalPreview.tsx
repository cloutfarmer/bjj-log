"use client";

/* Development-only preview: the real journal components with made-up data, and no
 * database, auth, or network. Mounted at /dev by app/dev/page.dev.tsx, which
 * next.config.mjs leaves out of production builds. */
import { useEffect, useState } from "react";
import { BUCKETS } from "../lib/ai/buckets";
import Calendar from "../app/components/Calendar";
import JournalEntry from "../app/components/JournalEntry";
import LogoMark from "../app/components/atoms/LogoMark/LogoMark";
import TagCleanup from "../app/components/organisms/TagCleanup/TagCleanup";
import AiUsage from "../app/components/organisms/AiUsage/AiUsage";
import TrainingStats from "../app/components/organisms/TrainingStats/TrainingStats";
import pageStyles from "../app/page.module.css";
import { buildPreviewFixtures } from "./fixtures";
import styles from "./JournalPreview.module.css";

import type { JournalEntryData } from "../app/types";

const EMPTY_ENTRY: JournalEntryData = { text: "", sessionTypes: [], attire: null };
const noop = () => undefined;

type Fixtures = ReturnType<typeof buildPreviewFixtures>;

export default function JournalPreview() {
  // Built after mount so the server and browser agree on "today".
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [entries, setEntries] = useState<Record<string, JournalEntryData>>({});
  const [entryTags, setEntryTags] = useState<Fixtures["entryTags"]>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);

  useEffect(() => {
    const built = buildPreviewFixtures(new Date());
    const [y, m] = built.featuredDate.split("-").map(Number);
    setFixtures(built);
    setEntries(built.entries);
    setEntryTags(built.entryTags);
    setTags(built.tags);
    setSelectedDate(built.featuredDate);
    setYear(y);
    setMonth(m - 1);
  }, []);

  if (!fixtures) return null;

  // Saves stay in memory, so the editor can be tried without a server. An empty entry is
  // deleted, as in app/components/Journal.tsx.
  async function handleSave(date: string, entry: JournalEntryData) {
    setEntries((previous) => {
      const updated = { ...previous };
      if (!entry.text.trim() && !entry.sessionTypes.length && !entry.attire) delete updated[date];
      else updated[date] = entry;
      return updated;
    });
  }
  // Tag edits stay in memory too; a new tag joins the suggestions, as in the real journal.
  function setTag(date: string, tag: string | null, bucket: string | null) {
    if (tag && bucket) setTags((previous) => ({ ...previous, [tag]: previous[tag] ?? bucket }));
    setEntryTags((previous) => ({ ...previous, [date]: { tag, source: "user" } }));
  }
  // Cleanup fake: merging repoints the in-memory entry tags, as the real route does.
  async function handleMerge(from: string, into: string) {
    setTags((previous) => Object.fromEntries(Object.entries(previous).filter(([name]) => name !== from)));
    setEntryTags((previous) =>
      Object.fromEntries(Object.entries(previous).map(([date, item]) => [date, item.tag === from ? { ...item, tag: into } : item])),
    );
    return true;
  }
  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  }

  const entriesDates = new Set(Object.keys(entries));
  const attireByDate = new Map(
    Object.entries(entries).flatMap(([date, entry]) => (entry.attire ? [[date, entry.attire] as const] : [])),
  );

  const selectedEntry = selectedDate ? entries[selectedDate] : undefined;
  const selectedTag = selectedDate ? entryTags[selectedDate]?.tag ?? null : null;

  return (
    <main className={pageStyles.main}>
      <div className={styles.frame}>
        <header className={pageStyles.appHeader}>
          <div className={pageStyles.brand}>
            <LogoMark className={pageStyles.logo} />
            <h1 className={pageStyles.title}>BJJ Log</h1>
          </div>
        </header>
        <div className={styles.columns}>
          <div className={styles.column}>
            <TrainingStats entriesDates={entriesDates} attireByDate={attireByDate} />
            <div className={`${pageStyles.calendarControls} ${pageStyles.card}`}>
              <Calendar
                year={year}
                month={month}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onPrevMonth={() => shiftMonth(-1)}
                onNextMonth={() => shiftMonth(1)}
                entriesDates={entriesDates}
                attireByDate={attireByDate}
              />
            </div>
          </div>
          <div className={styles.column}>
            <div className={pageStyles.card}>
              <JournalEntry
                selectedDate={selectedDate}
                savedEntry={selectedDate ? entries[selectedDate] ?? EMPTY_ENTRY : EMPTY_ENTRY}
                onSave={handleSave}
                onDirtyChange={noop}
                tagging={selectedEntry?.text.trim() && selectedDate ? {
                  tag: selectedTag,
                  bucket: selectedTag ? tags[selectedTag] ?? null : null,
                  source: entryTags[selectedDate]?.source,
                  tags,
                  buckets: BUCKETS,
                  busy: false,
                  onChange: (tag, bucket) => setTag(selectedDate, tag, bucket),
                  onRemove: () => setTag(selectedDate, null, null),
                } : undefined}
              />
            </div>
            <section aria-label="AI tools" className={`${pageStyles.aiTools} ${pageStyles.card}`}>
              <TagCleanup
                due
                available
                onFind={async () => fixtures.cleanupMerges.filter((m) => m.from in tags && m.into in tags)}
                onMerge={handleMerge}
              />
              <AiUsage onLoad={async () => fixtures.usage} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
