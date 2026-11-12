"use client";

/* Development-only preview: the real journal components with made-up data, and no
 * database, auth, or network. Mounted at /dev by app/dev/page.dev.tsx, which
 * next.config.mjs leaves out of production builds. */
import { useEffect, useState } from "react";
import Calendar from "../app/components/Calendar";
import JournalEntry from "../app/components/JournalEntry";
import LogoMark from "../app/components/atoms/LogoMark/LogoMark";
import TrainingStats from "../app/components/organisms/TrainingStats/TrainingStats";
import pageStyles from "../app/page.module.css";
import { SaveConflictError } from "../lib/entrySync";
import { buildPreviewFixtures } from "./fixtures";
import styles from "./JournalPreview.module.css";

import type { JournalEntryData, SavedEntry } from "../app/types";

const EMPTY_ENTRY: JournalEntryData = { text: "", sessionTypes: [], attire: null };
const noop = () => undefined;

type Fixtures = ReturnType<typeof buildPreviewFixtures>;

export default function JournalPreview() {
  // Built after mount so the server and browser agree on "today".
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [entries, setEntries] = useState<Record<string, JournalEntryData>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  // Makes the next save answer as if the day had been changed on another device.
  const [conflictNext, setConflictNext] = useState(false);

  useEffect(() => {
    const built = buildPreviewFixtures(new Date());
    const [y, m] = built.featuredDate.split("-").map(Number);
    setFixtures(built);
    setEntries(built.entries);
    setSelectedDate(built.featuredDate);
    setYear(y);
    setMonth(m - 1);
  }, []);

  if (!fixtures) return null;

  // Saves stay in memory, so the editor can be tried without a server. An empty entry is
  // deleted, as in app/components/Journal.tsx.
  async function handleSave(date: string, entry: JournalEntryData) {
    if (conflictNext) {
      setConflictNext(false);
      throw new SaveConflictError({
        text: "Made-up note from another device.\nKnee cut: pin the far hip first.",
        sessionTypes: ["open-mat"],
        attire: "nogi",
        version: "",
      });
    }
    store(date, entry);
  }
  function store(date: string, entry: JournalEntryData | SavedEntry | null) {
    setEntries((previous) => {
      const updated = { ...previous };
      if (!entry || (!entry.text.trim() && !entry.sessionTypes.length && !entry.attire)) delete updated[date];
      else updated[date] = entry;
      return updated;
    });
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
                onAdopt={store}
                onDirtyChange={noop}
              />
            </div>
            <label className={styles.previewSwitch}>
              <input type="checkbox" checked={conflictNext} onChange={(event) => setConflictNext(event.target.checked)} />
              Next save conflicts
            </label>
            <button
              type="button"
              className={styles.previewSwitch}
              onClick={() => {
                if (selectedDate) store(selectedDate, { text: "Made-up background change.", sessionTypes: ["drilling"], attire: null });
              }}
            >
              Change the saved copy
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
