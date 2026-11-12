"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AiUsage.module.css";

type Count = { runs: number; inputTokens: number; outputTokens: number };
type Usage = { jobs: (Count & { job: string })[]; total: Count };

interface AiUsageProps {
  /** Loads the totals. Resolves to null on failure. */
  onLoad: () => Promise<Usage | null>;
}

type View = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; usage: Usage };

const fmt = (n: number) => n.toLocaleString("en-US");

/* Read-only: shows what each AI feature has cost so far. It reloads on every open so the
 * numbers are fresh without polling. */
export default function AiUsage({ onLoad }: AiUsageProps) {
  const [view, setView] = useState<View | null>(null);
  const mounted = useRef(true);
  // A later open supersedes an earlier, slower load.
  const latest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function load() {
    const id = ++latest.current;
    setView({ kind: "loading" });
    const usage = await onLoad();
    if (!mounted.current || id !== latest.current) return;
    setView(usage ? { kind: "ready", usage } : { kind: "failed" });
  }

  return (
    <details
      className={styles.usage}
      onToggle={(event) => {
        if (event.currentTarget.open) void load();
      }}
    >
      <summary className={styles.summary}>AI usage</summary>
      {view?.kind === "loading" && <p className={styles.note}>Loading…</p>}
      {view?.kind === "failed" && <p className={styles.note}>Usage is unavailable right now.</p>}
      {view?.kind === "ready" &&
        (view.usage.total.runs === 0 ? (
          <p className={styles.note}>No AI calls yet.</p>
        ) : (
          <table className={styles.table}>
            <caption className={styles.caption}>Tokens used per job</caption>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col" className={styles.num}><abbr title="Calls">Calls</abbr></th>
                <th scope="col" className={styles.num}><abbr title="Input tokens">In</abbr></th>
                <th scope="col" className={styles.num}><abbr title="Output tokens">Out</abbr></th>
              </tr>
            </thead>
            <tbody>
              {view.usage.jobs.map((j) => (
                <tr key={j.job}>
                  <th scope="row">{j.job}</th>
                  <td className={styles.num}>{fmt(j.runs)}</td>
                  <td className={styles.num}>{fmt(j.inputTokens)}</td>
                  <td className={styles.num}>{fmt(j.outputTokens)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className={styles.num}>{fmt(view.usage.total.runs)}</td>
                <td className={styles.num}>{fmt(view.usage.total.inputTokens)}</td>
                <td className={styles.num}>{fmt(view.usage.total.outputTokens)}</td>
              </tr>
            </tfoot>
          </table>
        ))}
    </details>
  );
}
