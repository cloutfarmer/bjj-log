"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TagIndexView.module.css";

interface AutoTagBarProps {
  /** Untagged dates never checked before. */
  candidates: string[];
  available: boolean;
  autoTag: (date: string) => Promise<boolean>;
}

const MAX_FAILURES = 3;

export default function AutoTagBar({ candidates, available, autoTag }: AutoTagBarProps) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [message, setMessage] = useState("");
  const aliveRef = useRef(true);
  const stopRef = useRef(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  async function run() {
    if (running) return;
    const list = [...candidates];
    stopRef.current = false;
    setMessage("");
    setRunning(true);
    setProgress({ done: 0, total: list.length });
    let failures = 0;
    let matched = 0;
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current || !aliveRef.current) break;
      const ok = await autoTag(list[i]);
      if (!aliveRef.current) return;
      if (ok) matched++;
      failures = ok ? 0 : failures + 1;
      setProgress({ done: i + 1, total: list.length });
      if (available && failures >= MAX_FAILURES) {
        setMessage("Auto-tagging stopped. Please retry later.");
        break;
      }
    }
    if (!available && aliveRef.current) setMessage(`Matched ${matched} of ${list.length} notes.`);
    if (aliveRef.current) setRunning(false);
  }

  if (!candidates.length && !running && !message) return null;

  return (
    <div className={styles.autoTag}>
      {running ? (
        <div className={styles.autoTagRow}>
          <span role="status">{progress.done} / {progress.total}</span>
          <button type="button" className={styles.actionButton} onClick={() => { stopRef.current = true; }}>Stop</button>
        </div>
      ) : (
        candidates.length > 0 && (
          <button type="button" className={styles.actionButton} onClick={() => { void run(); }}>
            Auto-tag {candidates.length} {candidates.length === 1 ? "note" : "notes"}
          </button>
        )
      )}
      {message && <p role="status" className={styles.hint}>{message}</p>}
      <p className={styles.hint}>Matches your existing tags first. The AI model is used only for notes that mention none of them.</p>
      {!available && <p className={styles.hint}>No AI key on the server, so only existing tags can be matched.</p>}
    </div>
  );
}
