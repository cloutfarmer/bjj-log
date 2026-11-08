"use client";

import { useState } from "react";
import styles from "./Calendar.module.css";

import type { Attire } from "../types";

interface CalendarProps {
  year: number;
  month: number;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  entriesDates: ReadonlySet<string>;
  // Only the days whose attire was recorded appear here; the rest keep the plain dot.
  attireByDate: ReadonlyMap<string, Attire>;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function Calendar({
  year,
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  entriesDates,
  attireByDate,
}: CalendarProps) {
  const [expanded, setExpanded] = useState(false);
  const [offset, setOffset] = useState(0);
  const today = new Date();
  const todayStr =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const cells = [];
  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className={styles.emptyCell} />);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const hasEntry = entriesDates.has(dateStr);
    const attire = attireByDate.get(dateStr);

    let className = styles.dayCell;
    if (isToday) className += ` ${styles.today}`;
    if (isSelected) className += ` ${styles.selected}`;
    if (hasEntry) className += ` ${styles.hasEntry}`;
    if (attire === "gi") className += ` ${styles.giDot}`;
    if (attire === "nogi") className += ` ${styles.nogiDot}`;

    // Colour is not the only signal, but this stays a title rather than an aria-label:
    // putting entry state in the accessible name would change it as entries are saved.
    const tooltip = `${MONTH_NAMES[month]} ${day}` +
      (attire === "gi" ? " — gi" : attire === "nogi" ? " — no-gi" : hasEntry ? " — entry" : "");

    cells.push(
      <button
        key={day}
        className={className}
        onClick={() => { onSelectDate(dateStr); setOffset(0); setExpanded(false); }}
        title={tooltip}
      >
        {day}
      </button>
    );
  }

  const anchor = new Date(`${selectedDate || todayStr}T12:00:00`);
  anchor.setDate(anchor.getDate() - anchor.getDay() + offset * 7);
  const week = Array.from({length:7}, (_,i) => { const d = new Date(anchor); d.setDate(d.getDate()+i); return d; });
  return (
    <div className={styles.calendar}>
      <div className={styles.header}><button className={styles.navBtn} aria-label="Previous week" onClick={()=>setOffset(n=>n-1)}>←</button><strong>{anchor.toLocaleDateString("en-US",{month:"short",year:"numeric"})}</strong><button className={styles.navBtn} aria-label="Next week" onClick={()=>setOffset(n=>n+1)}>→</button></div>
      <div className={`${styles.grid} ${styles.weekStrip}`}>{week.map(d=>{const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;return <button key={key} aria-label={d.toDateString()} aria-pressed={key===selectedDate} className={`${styles.dayCell} ${key===selectedDate?styles.selected:""} ${key===todayStr?styles.today:""} ${entriesDates.has(key)?styles.hasEntry:""} ${attireByDate.get(key)==="gi"?styles.giDot:attireByDate.get(key)==="nogi"?styles.nogiDot:""}`} onClick={()=>{onSelectDate(key);setOffset(0);}}><span>{DAYS_OF_WEEK[d.getDay()]}<br/>{d.getDate()}</span></button>})}</div>
      <div className={styles.header}><button className={styles.navBtn} onClick={()=>{onSelectDate(todayStr);setOffset(0);}}>Today</button><button className={styles.navBtn} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"Collapse month":"Expand month"}</button></div>
      {expanded && <><div className={styles.header}>
        <button className={styles.navBtn} onClick={onPrevMonth}>
          &larr;
        </button>
        <h2 className={styles.monthTitle}>
          {MONTH_NAMES[month]} {year}
        </h2>
        <button className={styles.navBtn} onClick={onNextMonth}>
          &rarr;
        </button>
      </div>

      <div className={styles.todayLabel}>
        Today: {MONTH_NAMES[today.getMonth()]} {today.getDate()},{" "}
        {today.getFullYear()}
      </div>

      <div className={styles.grid}>
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className={styles.weekday}>
            {d}
          </div>
        ))}
        {cells}
      </div>

      </>}<div className={styles.legend}>
        <span><i className={styles.swatchGi} /> Gi</span>
        <span><i className={styles.swatchNogi} /> No-Gi</span>
        <span><i className={styles.swatchPlain} /> Not recorded</span>
      </div>
    </div>
  );
}
