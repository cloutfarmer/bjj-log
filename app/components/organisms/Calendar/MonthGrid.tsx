"use client";

import { dateKey } from "../../../../lib/useJournal";
import CalendarLegend from "./CalendarLegend";
import styles from "./Calendar.module.css";

import type { Attire } from "../../../types";

interface MonthGridProps {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  entriesDates: ReadonlySet<string>;
  // Only the days whose attire was recorded appear here; the rest keep the plain dot.
  attireByDate: ReadonlyMap<string, Attire>;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A full month of days, for the calendar screen. */
export default function MonthGrid({
  year, month, selectedDate, onSelectDate, onPrevMonth, onNextMonth, onToday, entriesDates, attireByDate,
}: MonthGridProps) {
  const today = new Date();
  const todayStr = dateKey(today);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className={styles.emptyCell} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hasEntry = entriesDates.has(dateStr);
    const attire = attireByDate.get(dateStr);

    let className = styles.dayCell;
    if (dateStr === todayStr) className += ` ${styles.today}`;
    if (dateStr === selectedDate) className += ` ${styles.selected}`;
    if (hasEntry) className += ` ${styles.hasEntry}`;
    if (attire === "gi") className += ` ${styles.giDot}`;
    if (attire === "nogi") className += ` ${styles.nogiDot}`;

    // Colour is not the only signal, but this stays a title rather than an aria-label:
    // putting entry state in the accessible name would change it as entries are saved.
    const tooltip = `${MONTH_NAMES[month]} ${day}` +
      (attire === "gi" ? " — gi" : attire === "nogi" ? " — no-gi" : hasEntry ? " — entry" : "");

    cells.push(
      <button key={day} type="button" className={className} onClick={() => onSelectDate(dateStr)} title={tooltip}>
        {day}
      </button>
    );
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} aria-label="Previous month" onClick={onPrevMonth}>←</button>
        <h2 className={styles.monthTitle}>{MONTH_NAMES[month]} {year}</h2>
        <button type="button" className={styles.navBtn} aria-label="Next month" onClick={onNextMonth}>→</button>
      </div>

      <div className={styles.todayLabel}>
        Today: {MONTH_NAMES[today.getMonth()]} {today.getDate()}, {today.getFullYear()}
      </div>

      <div className={styles.grid}>
        {DAYS_OF_WEEK.map(day => <div key={day} className={styles.weekday}>{day}</div>)}
        {cells}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.navBtn} onClick={onToday}>Today</button>
        <CalendarLegend />
      </div>
    </div>
  );
}
