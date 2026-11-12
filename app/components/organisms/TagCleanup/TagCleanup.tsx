"use client";

import { useEffect, useRef, useState } from "react";
import SuggestionRow from "../../molecules/SuggestionRow/SuggestionRow";
import styles from "./TagCleanup.module.css";

interface TagCleanupProps {
  /** True when 10 or more tags were created since the last cleanup. */
  due: boolean;
  /** False when no API key is configured: the button is disabled with a short reason. */
  available: boolean;
  /** Asks for merge suggestions. Resolves to null on failure. */
  onFind: () => Promise<{ from: string; into: string }[] | null>;
  /** Performs one approved merge. Resolves to whether it worked. */
  onMerge: (from: string, into: string) => Promise<boolean>;
}

type Merge = { from: string; into: string };

/* Suggestions only: the call to the model happens on the button press, and a merge happens
 * only when the user accepts that row. */
export default function TagCleanup({ due, available, onFind, onMerge }: TagCleanupProps) {
  const [rows, setRows] = useState<Merge[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [merging, setMerging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function find() {
    if (finding || merging) return;
    setFinding(true);
    setNotice(null);
    const result = await onFind();
    if (!mounted.current) return;
    setFinding(false);
    setRows(result ?? []);
    if (result === null) setNotice("Tag cleanup is unavailable right now.");
    else if (result.length === 0) setNotice("No duplicates found.");
  }

  async function accept(row: Merge) {
    if (merging) return;
    setMerging(true);
    setNotice(null);
    const ok = await onMerge(row.from, row.into);
    if (!mounted.current) return;
    setMerging(false);
    if (!ok) {
      setNotice("Could not merge. Please retry.");
      return;
    }
    // The merged-away tag no longer exists, so a pending row that names it would fail.
    setRows((previous) => (previous ?? []).filter((r) => r.from !== row.from && r.into !== row.from));
  }

  function reject(row: Merge) {
    setRows((previous) => (previous ?? []).filter((r) => r !== row));
  }

  return (
    <div className={styles.cleanup}>
      <h2 className={styles.heading}>Tag cleanup</h2>
      <p className={styles.help}>Finds duplicate or misspelled tags. Nothing merges until you accept it.</p>
      {due && (
        <p role="status" className={styles.help}>
          10 or more new tags since the last check.
        </p>
      )}
      <div className={styles.check}>
        <button
          type="button"
          className={styles.checkBtn}
          disabled={finding || !available || merging}
          onClick={() => void find()}
        >
          {finding ? "Checking…" : "Find duplicate tags"}
        </button>
        {!available && <span className={styles.help}>Needs an AI key on the server.</span>}
      </div>
      {notice !== null && (
        <p role="status" className={styles.help}>
          {notice}
        </p>
      )}
      {rows !== null && rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <SuggestionRow
              key={`${row.from}\u0000${row.into}`}
              from={row.from}
              into={row.into}
              label="merge"
              busy={merging}
              onAccept={() => void accept(row)}
              onReject={() => reject(row)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
