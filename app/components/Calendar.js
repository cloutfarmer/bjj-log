"use client";

import styles from "./Calendar.module.css";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
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
}) {
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

    let className = styles.dayCell;
    if (isToday) className += ` ${styles.today}`;
    if (isSelected) className += ` ${styles.selected}`;
    if (hasEntry) className += ` ${styles.hasEntry}`;

    cells.push(
      <button
        key={day}
        className={className}
        onClick={() => onSelectDate(dateStr)}
      >
        {day}
      </button>
    );
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
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
    </div>
  );
}
