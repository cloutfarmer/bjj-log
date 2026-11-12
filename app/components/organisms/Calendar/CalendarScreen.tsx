"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { calendarMarks, dateKey, useJournal } from "../../../../lib/useJournal";
import TrainingStats from "../TrainingStats/TrainingStats";
import MonthGrid from "./MonthGrid";
import pageStyles from "../../../page.module.css";
import styles from "./Calendar.module.css";

/** The Calendar screen: a month at a glance and the training totals. Picking a day opens it in the journal. */
export default function CalendarScreen() {
  const { entries, selectedDate, selectDate, hrefs } = useJournal();
  const router = useRouter();
  const [view, setView] = useState(() => {
    const [year, month] = (selectedDate ?? dateKey(new Date())).split("-").map(Number);
    return { year, month: month - 1 };
  });
  const { entriesDates, attireByDate } = calendarMarks(entries);

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className={styles.screen}>
      <div className={pageStyles.card}>
        <MonthGrid
          year={view.year}
          month={view.month}
          selectedDate={selectedDate}
          onSelectDate={date => { if (selectDate(date)) router.push(hrefs.journal); }}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          onToday={() => { const now = new Date(); setView({ year: now.getFullYear(), month: now.getMonth() }); }}
          entriesDates={entriesDates}
          attireByDate={attireByDate}
        />
      </div>
      <TrainingStats entriesDates={entriesDates} attireByDate={attireByDate} />
    </div>
  );
}
