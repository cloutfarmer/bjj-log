"use client";

import { computeTrainingStats } from "../../../../lib/stats";
import StatCard from "../../molecules/StatCard/StatCard";
import styles from "./TrainingStats.module.css";

import type { Attire } from "../../../types";

interface TrainingStatsProps {
  entriesDates: ReadonlySet<string>;
  attireByDate: ReadonlyMap<string, Attire>;
}

export default function TrainingStats({ entriesDates, attireByDate }: TrainingStatsProps) {
  const stats = computeTrainingStats(entriesDates, attireByDate, new Date());
  const recorded = stats.gi + stats.nogi;
  const giShare = recorded ? Math.round((stats.gi / recorded) * 100) : 0;

  return (
    <section className={styles.stats} aria-label="Training stats">
      <div className={styles.grid}>
        <StatCard label="This week" value={stats.thisWeek} />
        <StatCard label="This month" value={stats.thisMonth} />
        <StatCard label="Week streak" value={stats.weekStreak} />
        <StatCard label="All time" value={stats.total} />
      </div>
      {recorded > 0 && (
        <div className={styles.split}>
          <div className={styles.splitHeader}>
            <span><b className={styles.giText}>Gi</b> {stats.gi} · {giShare}%</span>
            <span>{100 - giShare}% · {stats.nogi} <b className={styles.nogiText}>No-Gi</b></span>
          </div>
          <div className={styles.bar} aria-hidden="true">
            <div className={styles.barGi} style={{ width: `${giShare}%` }} />
            <div className={styles.barNogi} style={{ width: `${100 - giShare}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}
