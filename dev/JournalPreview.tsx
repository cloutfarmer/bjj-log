"use client";

/* Development-only preview: the real journal components with made-up data, and no
 * database, auth, or network. Mounted at /dev by app/dev/page.dev.tsx, which
 * next.config.mjs leaves out of production builds. */
import { useEffect, useState } from "react";
import { BUCKETS } from "../lib/ai/buckets";
import { MAX_TAGS_PER_ENTRY } from "../lib/ai/tagMatch";
import { isDate } from "../lib/entries";
import { suggestTags } from "../lib/tagIndex";
import Calendar from "../app/components/Calendar";
import JournalEntry from "../app/components/JournalEntry";
import AppHeader from "../app/components/organisms/AppHeader/AppHeader";
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
    const wanted = new URLSearchParams(window.location.search).get("date");
    const chosen = wanted && isDate(wanted) ? wanted : built.featuredDate;
    const [y, m] = chosen.split("-").map(Number);
    setFixtures(built);
    setEntries(built.entries);
    setEntryTags(built.entryTags);
    setTags(built.tags);
    setSelectedDate(chosen);
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
  function addTag(date: string, name: string, bucket: string) {
    setTags((previous) => ({ ...previous, [name]: previous[name] ?? bucket }));
    setEntryTags((previous) => {
      const current = previous[date]?.tags ?? [];
      if (current.some((tag) => tag.name === name) || current.length >= MAX_TAGS_PER_ENTRY) return previous;
      return { ...previous, [date]: { tags: [...current, { name, source: "user" }], byUser: true } };
    });
  }
  function removeTag(date: string, name: string) {
    setEntryTags((previous) => ({
      ...previous,
      [date]: { tags: (previous[date]?.tags ?? []).filter((tag) => tag.name !== name), byUser: true },
    }));
  }
  // Cleanup fake: merging repoints the in-memory entry tags, as the real route does.
  async function handleMerge(from: string, into: string) {
    setTags((previous) => Object.fromEntries(Object.entries(previous).filter(([name]) => name !== from)));
    setEntryTags((previous) =>
      Object.fromEntries(Object.entries(previous).map(([date, item]) => [
          date,
          { ...item, tags: item.tags.some((tag) => tag.name === from) ? item.tags.map((tag) => (tag.name === from ? { ...tag, name: into } : tag)).filter((tag, index, all) => all.findIndex((other) => other.name === tag.name) === index) : item.tags },
        ]),),
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

  return (
    <main className={pageStyles.main}>
      <div className={styles.frame}>
        <AppHeader current="journal" signOut={false} hrefs={{ journal: "/dev", tags: "/dev/tags" }} />
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
                tagging={selectedEntry && selectedDate ? {
                  tags: (entryTags[selectedDate]?.tags ?? []).map((tag) => ({ name: tag.name, bucket: tags[tag.name] ?? null, source: tag.source })),
                  suggestions: suggestTags(selectedEntry.text, Object.keys(tags), (entryTags[selectedDate]?.tags ?? []).map((tag) => tag.name)),
                  allTags: tags,
                  buckets: BUCKETS,
                  max: MAX_TAGS_PER_ENTRY,
                  busy: false,
                  onAdd: (name, bucket) => addTag(selectedDate, name, bucket),
                  onRemove: (name) => removeTag(selectedDate, name),
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
