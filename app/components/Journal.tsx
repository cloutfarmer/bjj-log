"use client";

import { useState, useEffect, useCallback } from "react";
import { isDate, parseEntry } from "../../lib/entries";
import Calendar from "./Calendar";
import JournalEntry from "./JournalEntry";
import LogoMark from "./atoms/LogoMark/LogoMark";
import TrainingStats from "./organisms/TrainingStats/TrainingStats";
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
  const [recentCount, setRecentCount] = useState(5);
  const [dirty, setDirty] = useState(false);
  function selectDate(date: string) {
    if (date === selectedDate) return;
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setDirty(false); setSelectedDate(date);
  }
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
    const date = new Date();
    setSelectedDate(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`);
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pendingImport),
      });
      if (!response.ok) throw new Error("Could not import notes. Your original browser notes are unchanged.");
      const result: { imported: number } = await response.json();
      await refresh();
      setLocalNotes(null);
      setNotice(`Imported ${result.imported} notes. Existing cloud notes were kept; browser originals remain untouched.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setBusy(false); }
  }

  // Offer only meaningful browser notes whose dates are absent from the cloud.
  let pendingImport: Record<string, JournalEntryData> = {};
  if (mounted && localNotes) {
    try {
      const parsed: unknown = JSON.parse(localNotes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        pendingImport = Object.fromEntries(Object.entries(parsed).flatMap(([date, value]) => {
          const entry = parseEntry(value);
          return isDate(date) && !Object.hasOwn(entries, date) && entry &&
            (entry.text.trim() || entry.sessionTypes.length || entry.attire) ? [[date, entry]] : [];
        }));
      }
    } catch { /* Invalid or empty browser data is not an importable note. */ }
  }
  const pendingCount = Object.keys(pendingImport).length;

  const entriesDates = new Set(Object.keys(entries));
  const attireByDate = new Map(
    Object.entries(entries)
      .filter((pair): pair is [string, JournalEntryData & { attire: Attire }] => pair[1].attire !== null)
      .map(([date, entry]) => [date, entry.attire]),
  );

  return (
    <main className={styles.main}>
      <header className={styles.appHeader}><div className={styles.brand}><LogoMark className={styles.logo} /><h1 className={styles.title}>BJJ Log</h1></div>
      <form action="/api/logout" method="post" onSubmit={event => { if (dirty && !window.confirm("Discard unsaved changes and sign out?")) event.preventDefault(); }}><button className={styles.signOut} type="submit">Sign out</button></form></header>
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      {!mounted && <p className={styles.loading}>Loading your notes… <button onClick={() => { setError(""); refresh().catch((cause: Error) => setError(cause.message)); }}>Retry</button></p>}
      {notice && <p role="status" className={styles.status}>{notice}</p>}
      {pendingCount > 0 && <div className={styles.importNotice}>
        <p>{pendingCount} browser {pendingCount === 1 ? "note is" : "notes are"} missing from your journal. Import keeps existing journal notes.</p>
        <button className={styles.secondaryButton} disabled={busy || dirty || !mounted} onClick={importNotes}>{busy ? "Importing…" : "Import browser notes"}</button>
      </div>}
      {mounted && <div className={styles.layout}>
        <TrainingStats entriesDates={entriesDates} attireByDate={attireByDate} />
        <fieldset disabled={busy} className={`${styles.calendarControls} ${styles.card}`}>
        <Calendar
          year={year}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          entriesDates={entriesDates}
          attireByDate={attireByDate}
        />
        </fieldset>
        <div className={styles.content}><div className={styles.card}><JournalEntry
          selectedDate={selectedDate}
          savedEntry={selectedDate ? entries[selectedDate] ?? EMPTY_ENTRY : EMPTY_ENTRY}
          onSave={handleSave}
          onDirtyChange={setDirty}
        /></div><aside className={`${styles.recent} ${styles.card}`}><h2>Recent entries</h2>{Object.keys(entries).sort().reverse().slice(0,recentCount).map(date => <button key={date} className={styles.recentItem} onClick={() => selectDate(date)} aria-current={date === selectedDate ? "date" : undefined}><strong>{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}</strong><span>{entries[date].text || "Session logged"}</span><small>{[entries[date].attire === "gi" ? "Gi" : entries[date].attire === "nogi" ? "No-Gi" : "", ...entries[date].sessionTypes].filter(Boolean).join(" · ")}</small></button>)}{!Object.keys(entries).length && <p>Your training notes will appear here.</p>}{Object.keys(entries).length > recentCount && <button className={styles.showMore} onClick={() => setRecentCount(n=>n+5)}>Show more</button>}</aside></div>
      </div>}
    </main>
  );
}
