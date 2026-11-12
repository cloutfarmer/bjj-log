"use client";

import { useState } from "react";
import { dateKey } from "../../../../lib/useJournal";
import CalendarLegend from "./CalendarLegend";
import styles from "./Calendar.module.css";

import type { Attire } from "../../../types";

interface WeekStripProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  entriesDates: ReadonlySet<string>;
  // Only the days whose attire was recorded appear here; the rest keep the plain dot.
  attireByDate: ReadonlyMap<string, Attire>;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One week of days around the selected date, for the journal screen. */
export default function WeekStrip({ selectedDate, onSelectDate, entriesDates, attireByDate }: WeekStripProps) {
  const [offset, setOffset] = useState(0);
  const todayStr = dateKey(new Date());

  const anchor = new Date(`${selectedDate || todayStr}T12:00:00`);
  anchor.setDate(anchor.getDate() - anchor.getDay() + offset * 7);
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(anchor);
    day.setDate(day.getDate() + i);
    return day;
  });

  return (
    <div className={styles.strip}>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} aria-label="Previous week" onClick={() => setOffset(n => n - 1)}>←</button>
        <strong>{anchor.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</strong>
        <button type="button" className={styles.navBtn} aria-label="Next week" onClick={() => setOffset(n => n + 1)}>→</button>
      </div>
      <div className={`${styles.grid} ${styles.weekStrip}`}>
        {week.map(day => {
          const key = dateKey(day);
          const attire = attireByDate.get(key);
          let className = styles.dayCell;
          if (key === selectedDate) className += ` ${styles.selected}`;
          if (key === todayStr) className += ` ${styles.today}`;
          if (entriesDates.has(key)) className += ` ${styles.hasEntry}`;
          if (attire === "gi") className += ` ${styles.giDot}`;
          if (attire === "nogi") className += ` ${styles.nogiDot}`;
          return (
            <button
              key={key}
              type="button"
              aria-label={day.toDateString()}
              aria-pressed={key === selectedDate}
              className={className}
              onClick={() => { onSelectDate(key); setOffset(0); }}
            >
              <span>{DAYS_OF_WEEK[day.getDay()]}<br />{day.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.navBtn} onClick={() => { onSelectDate(todayStr); setOffset(0); }}>Today</button>
        <CalendarLegend />
      </div>
    </div>
  );
}
