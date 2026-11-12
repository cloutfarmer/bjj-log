"use client";

import { useEffect } from "react";
import { isDate } from "../../lib/entries";
import { calendarMarks, useJournal } from "../../lib/useJournal";
import JournalEntry from "./JournalEntry";
import WeekStrip from "./organisms/Calendar/WeekStrip";
import RecentEntries from "./organisms/RecentEntries/RecentEntries";
import styles from "../page.module.css";

import type { JournalEntryData } from "../types";

const EMPTY_ENTRY: JournalEntryData = { text: "", sessionTypes: [], attire: null };

/** The Journal screen: pick a day of the week, read or write its entry, and reopen a recent one. */
export default function Journal() {
  const { entries, selectedDate, selectDate, busy, dirty, setDirty, save, adopt, tagState, editorProps, checkGrammar } = useJournal();

  useEffect(() => {
    // "Open in journal" links arrive as ?date=YYYY-MM-DD. The date is taken once, then removed,
    // so a later visit to this screen keeps whichever day is selected by then.
    const wanted = new URLSearchParams(window.location.search).get("date");
    if (wanted && isDate(wanted)) {
      selectDate(wanted);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // The editor below owns the draft, so leaving this screen closes it. A draft the user
    // did not agree to discard stays in browser storage and is restored on return.
    return () => setDirty(false);
    // Runs once per visit to this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { entriesDates, attireByDate } = calendarMarks(entries);
  const selectedEntry = selectedDate && Object.hasOwn(entries, selectedDate) ? entries[selectedDate] : undefined;
  const tagging = tagState && selectedDate && selectedEntry && !dirty ? editorProps(selectedDate, selectedEntry.text) : undefined;

  return (
    <div className={styles.layout}>
      <div className={styles.content}>
        <div className={styles.column}>
          <fieldset disabled={busy} className={`${styles.calendarControls} ${styles.card}`}>
            <WeekStrip
              selectedDate={selectedDate}
              onSelectDate={selectDate}
              entriesDates={entriesDates}
              attireByDate={attireByDate}
            />
          </fieldset>
          <div className={styles.card}>
            <JournalEntry
              selectedDate={selectedDate}
              savedEntry={selectedEntry ?? EMPTY_ENTRY}
              savedVersion={selectedEntry ? selectedEntry.version || undefined : null}
              onSave={save}
              onAdopt={adopt}
              onDirtyChange={setDirty}
              tagging={tagging}
              onCheckGrammar={checkGrammar}
            />
          </div>
        </div>
        <RecentEntries />
      </div>
    </div>
  );
}
