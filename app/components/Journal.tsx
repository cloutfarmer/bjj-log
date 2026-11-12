"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { isDate, parseEntry } from "../../lib/entries";
import { BUCKETS } from "../../lib/ai/buckets";
import { fetchTagState, fetchUsage, mergeTags, requestCleanup, requestClean, requestTag, saveUserTag } from "../../lib/aiClient";
import Calendar from "./Calendar";
import JournalEntry from "./JournalEntry";
import LogoMark from "./atoms/LogoMark/LogoMark";
import TrainingStats from "./organisms/TrainingStats/TrainingStats";
import TagCleanup from "./organisms/TagCleanup/TagCleanup";
import AiUsage from "./organisms/AiUsage/AiUsage";
import styles from "../page.module.css";

import type { TagResult, TagState } from "../../lib/aiClient";
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
  // null hides all tag UI: the AI routes are missing, failed, or not loaded yet.
  const [tagState, setTagState] = useState<TagState | null>(null);
  const [tagBusy, setTagBusy] = useState(false);
  const aliveRef = useRef(false);
  // React strict mode runs mount effects twice in dev; the catch-up must run once.
  const catchUpStartedRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  /** Merges one tagging result; a new tag name also joins the suggestion list. */
  function mergeTag(date: string, result: TagResult) {
    if (!aliveRef.current) return;
    setTagState(previous => {
      if (!previous) return previous;
      const tags = result.tag && result.bucket && !Object.hasOwn(previous.tags, result.tag)
        ? { ...previous.tags, [result.tag]: result.bucket } : previous.tags;
      return {
        ...previous, tags,
        entryTags: { ...previous.entryTags, [date]: { tag: result.tag, source: result.source } },
        pending: previous.pending.filter(item => item !== date),
      };
    });
  }

  /** Tags notes saved while AI was unavailable, newest first and one at a time to keep provider load low. */
  async function catchUpTags() {
    if (catchUpStartedRef.current) return;
    catchUpStartedRef.current = true;
    const state = await fetchTagState();
    if (!state || !aliveRef.current) return;
    setTagState(state);
    for (const date of state.pending.slice(0, 5)) {
      const result = await requestTag(date);
      if (!result || !aliveRef.current) return;
      mergeTag(date, result);
    }
  }

  /** Runs one approved merge, then reloads the tag state so entry tags and the tag list match the server. */
  async function handleMerge(from: string, into: string) {
    const ok = await mergeTags(from, into);
    if (!ok) return false;
    const state = await fetchTagState();
    if (state && aliveRef.current) setTagState(state);
    return true;
  }

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
    refresh().then(() => { void catchUpTags(); }).catch((cause: Error) => setError(cause.message));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw !== "{}") setLocalNotes(raw);
    } catch { /* Cloud notes still work if browser storage is unavailable. */ }
    // Runs once on mount; catchUpTags is guarded by a ref and only uses stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Tagging is best effort and never delays or fails the save.
      if (entry.text.trim()) {
        if (tagState) void requestTag(dateStr).then(result => { if (result) mergeTag(dateStr, result); });
      } else {
        setTagState(previous => {
          if (!previous || !Object.hasOwn(previous.entryTags, dateStr)) return previous;
          const entryTags = { ...previous.entryTags };
          delete entryTags[dateStr];
          return { ...previous, entryTags };
        });
      }
    } finally { setBusy(false); }
  }

  async function updateTag(date: string, tag: string | null, bucket?: string) {
    setTagBusy(true);
    try {
      const result = await saveUserTag(date, tag, bucket);
      if (result) mergeTag(date, result);
      else setError("Could not save the tag. Please retry.");
    } finally { if (aliveRef.current) setTagBusy(false); }
  }
  const changeTag = (date: string, tag: string, bucket: string) => updateTag(date, tag, bucket);
  const removeTag = (date: string) => updateTag(date, null);

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

  const selectedEntry = selectedDate ? entries[selectedDate] : undefined;
  const selectedTag = selectedDate && tagState ? tagState.entryTags[selectedDate]?.tag ?? null : null;
  const tagging = tagState && selectedDate && selectedEntry?.text.trim() && !dirty ? {
    tag: selectedTag,
    bucket: selectedTag ? tagState.tags[selectedTag] ?? null : null,
    source: tagState.entryTags[selectedDate]?.source,
    tags: tagState.tags,
    buckets: BUCKETS,
    busy: tagBusy,
    onChange: (tag: string, bucket: string) => { void changeTag(selectedDate, tag, bucket); },
    onRemove: () => { void removeTag(selectedDate); },
  } : undefined;

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
          tagging={tagging}
          onCheckGrammar={tagState?.available ? requestClean : undefined}
        /></div><aside className={`${styles.recent} ${styles.card}`}><h2>Recent entries</h2>{Object.keys(entries).sort().reverse().slice(0,recentCount).map(date => <button key={date} className={styles.recentItem} onClick={() => selectDate(date)} aria-current={date === selectedDate ? "date" : undefined}><strong>{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}</strong><span>{entries[date].text || "Session logged"}</span><small>{[entries[date].attire === "gi" ? "Gi" : entries[date].attire === "nogi" ? "No-Gi" : "", ...entries[date].sessionTypes, tagState?.entryTags[date]?.tag ?? ""].filter(Boolean).join(" · ")}</small></button>)}{!Object.keys(entries).length && <p>Your training notes will appear here.</p>}{Object.keys(entries).length > recentCount && <button className={styles.showMore} onClick={() => setRecentCount(n=>n+5)}>Show more</button>}</aside>{tagState && <section aria-label="AI tools" className={`${styles.aiTools} ${styles.card}`}><TagCleanup due={tagState.cleanupDue} available={tagState.available} onFind={requestCleanup} onMerge={handleMerge} /><AiUsage onLoad={fetchUsage} /></section>}</div>
      </div>}
    </main>
  );
}
