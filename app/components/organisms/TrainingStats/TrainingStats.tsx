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
        <StatCard label="Week streak" value={stats.weekStreak} lead stripes={stats.weekStreak} />
        <StatCard label="All time" value={stats.total} />
      </div>
      {recorded > 0 && (
        <div className={styles.split}>
          <div className={styles.splitHeader}>
            <span><i className={styles.dotGi} />Gi <span className={styles.figure}>{stats.gi} · {giShare}%</span></span>
            <span><span className={styles.figure}>{100 - giShare}% · {stats.nogi}</span> No-Gi<i className={styles.dotNogi} /></span>
          </div>
          <div className={styles.bar} aria-hidden="true">
            {giShare > 0 && <div className={styles.barGi} style={{ flexGrow: giShare }} />}
            {giShare < 100 && <div className={styles.barNogi} style={{ flexGrow: 100 - giShare }} />}
          </div>
        </div>
      )}
    </section>
  );
}
