"use client";

import { useState, useEffect, useCallback } from "react";
import Calendar from "./components/Calendar";
import JournalEntry from "./components/JournalEntry";
import styles from "./page.module.css";

const STORAGE_KEY = "bjj-log-entries";

function loadEntries() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function Home() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [entries, setEntries] = useState({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEntries(loadEntries());
    setMounted(true);
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

  function handleSave(dateStr, text) {
    const updated = { ...entries };
    if (text.trim() === "") {
      delete updated[dateStr];
    } else {
      updated[dateStr] = text;
    }
    setEntries(updated);
    saveEntries(updated);
  }

  const entriesDates = new Set(Object.keys(entries));

  if (!mounted) return null;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>BJJ Log</h1>
      <div className={styles.layout}>
        <Calendar
          year={year}
          month={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          entriesDates={entriesDates}
        />
        <JournalEntry
          selectedDate={selectedDate}
          savedText={selectedDate ? entries[selectedDate] || "" : ""}
          onSave={handleSave}
        />
      </div>
    </main>
  );
}
