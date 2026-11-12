"use client";

import styles from "./SuggestionRow.module.css";

interface SuggestionRowProps {
  from: string;
  into: string;
  /** Optional small caption, e.g. "spelling" or "merge". */
  label?: string;
  busy?: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export default function SuggestionRow({ from, into, label, busy = false, onAccept, onReject }: SuggestionRowProps) {
  return (
    <li className={styles.row}>
      <span className={styles.change}>
        <span className={styles.from}>{from}</span>
        <span className={styles.arrow} aria-hidden="true">
          {"→"}
        </span>
        <span className={styles.into}>{into}</span>
        {label ? <span className={styles.label}>{label}</span> : null}
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.accept}
          disabled={busy}
          aria-label={`Accept: ${from} to ${into}`}
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          type="button"
          className={styles.reject}
          disabled={busy}
          aria-label={`Reject: ${from} to ${into}`}
          onClick={onReject}
        >
          Reject
        </button>
      </span>
    </li>
  );
}
