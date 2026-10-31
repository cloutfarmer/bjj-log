"use client";

import { useState, useEffect, useCallback } from "react";
import Calendar from "./Calendar";
import JournalEntry from "./JournalEntry";
import styles from "../page.module.css";

import type { Attire, JournalEntryData } from "../types";

const STORAGE_KEY = "bjj-log-entries";
const EMPTY_ENTRY: JournalEntryData = { text: "", sessionTypes: [], attire: null };

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, JournalEntryData>>({});
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [localNotes, setLocalNotes] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await fetch("/api/entries", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load notes. Check your connection and sign in again if needed.");
    const data: Record<string, JournalEntryData> = await response.json();
    setEntries(data);
    setMounted(true);
  }

  useEffect(() => {
    refresh().catch((cause: Error) => setError(cause.message));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw !== "{}") setLocalNotes(raw);
    } catch { /* Cloud notes still work if browser storage is unavailable. */ }
  }, []);

  const handlePrevMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setMonth((prev) => {
      if (prev === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  async function handleSave(dateStr: string, entry: JournalEntryData) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/entries", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateStr, entry }),
      });
      if (!response.ok) throw new Error("Could not save. Your draft is still open; check your connection or sign in again, then retry.");
      setEntries(previous => {
        const updated = { ...previous };
        // Must match the server's rule in app/api/entries/route.ts, attire included.
        if (!entry.text.trim() && !entry.sessionTypes.length && !entry.attire) delete updated[dateStr];
        else updated[dateStr] = entry;
        return updated;
      });
      setNotice("Saved to your journal.");
    } finally { setBusy(false); }
  }

  async function importNotes() {
    if (!localNotes) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/entries/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: localNotes,
      });
      if (!response.ok) throw new Error("Could not import notes. Your original browser notes are unchanged.");
      const result: { imported: number } = await response.json();
      await refresh();
      setLocalNotes(null);
      setNotice(`Imported ${result.imported} notes. Existing cloud notes were kept; browser originals remain untouched.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setBusy(false); }
  }

  const entriesDates = new Set(Object.keys(entries));
  const attireByDate = new Map(
    Object.entries(entries)
      .filter((pair): pair is [string, JournalEntryData & { attire: Attire }] => pair[1].attire !== null)
      .map(([date, entry]) => [date, entry.attire]),
  );

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>BJJ Log</h1>
      <form action="/api/logout" method="post"><button type="submit">Sign out</button></form>
      {error && <p role="alert">{error}</p>}
      {!mounted && <p>Loading your notes… <button onClick={() => { setError(""); refresh().catch((cause: Error) => setError(cause.message)); }}>Retry</button></p>}
      {notice && <p role="status">{notice}</p>}
      {localNotes && <div className={styles.importNotice}>
        <p>There are older notes in this browser. Import adds missing dates and keeps existing cloud notes.</p>
        <button disabled={busy || !mounted} onClick={importNotes}>Import browser notes</button>
      </div>}
      {mounted && <div className={styles.layout}>
        <fieldset disabled={busy} className={styles.calendarControls}>
        <Calendar
          year={year}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          entriesDates={entriesDates}
          attireByDate={attireByDate}
        />
        </fieldset>
        <JournalEntry
          selectedDate={selectedDate}
          savedEntry={selectedDate ? entries[selectedDate] ?? EMPTY_ENTRY : EMPTY_ENTRY}
          onSave={handleSave}
        />
      </div>}
    </main>
  );
}
