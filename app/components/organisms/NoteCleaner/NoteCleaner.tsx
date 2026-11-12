"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyCorrection, findCorrections } from "../../../../lib/glossary";
import SuggestionRow from "../../molecules/SuggestionRow/SuggestionRow";
import styles from "./NoteCleaner.module.css";

interface NoteCleanerProps {
  /** The editor draft. */
  text: string;
  /** Called with the new draft when a suggestion is accepted. */
  onApply: (text: string) => void;
  /** Present only when the AI grammar check is available. Resolves to null on failure. */
  onCheckGrammar?: (text: string) => Promise<{ from: string; to: string }[] | null>;
}

type Edit = { from: string; to: string };
type Notice = { forText: string; message: string };

/** Lowercased `from` so a rejected pair stays hidden when the same word comes back capitalised. */
function rejectKey(from: string, to: string): string {
  return `${from.toLowerCase()}\u0000${to}`;
}

/* Suggestions only: accepting one hands a new draft to the editor, and the user still presses
 * Save. Nothing here writes a note. */
export default function NoteCleaner({ text, onApply, onCheckGrammar }: NoteCleanerProps) {
  const [rejected, setRejected] = useState<ReadonlySet<string>>(() => new Set());
  const [grammar, setGrammar] = useState<Edit[]>([]);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const spelling = useMemo(
    () => findCorrections(text).filter((c) => !rejected.has(rejectKey(c.from, c.to))),
    [text, rejected],
  );

  const grammarRows = useMemo(() => {
    // A spelling row for the same words already covers it, so listing both would be a duplicate.
    const covered = new Set(spelling.map((c) => c.from.toLowerCase()));
    const seen = new Set<string>();
    return grammar.filter((edit) => {
      const key = rejectKey(edit.from, edit.to);
      if (edit.from === "" || !text.includes(edit.from)) return false;
      if (rejected.has(key) || covered.has(edit.from.toLowerCase()) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [grammar, spelling, rejected, text]);

  function reject(from: string, to: string) {
    setRejected((prev) => new Set(prev).add(rejectKey(from, to)));
  }

  function acceptGrammar(edit: Edit) {
    const at = text.indexOf(edit.from);
    if (at === -1) return;
    onApply(text.slice(0, at) + edit.to + text.slice(at + edit.from.length));
  }

  async function check() {
    if (!onCheckGrammar || checking) return;
    const sent = text;
    setChecking(true);
    setNotice(null);
    const result = await onCheckGrammar(sent);
    if (!mounted.current) return;
    setChecking(false);
    const edits = result ?? [];
    setGrammar(edits);
    if (result === null) setNotice({ forText: sent, message: "Grammar check is unavailable right now." });
    else if (edits.length === 0) setNotice({ forText: sent, message: "No grammar suggestions." });
  }

  const message = notice !== null && notice.forText === text ? notice.message : null;
  if (spelling.length === 0 && grammarRows.length === 0 && !onCheckGrammar) return null;

  return (
    <section className={styles.cleaner} aria-label="Suggestions">
      {(spelling.length > 0 || grammarRows.length > 0) && (
        <ul className={styles.list}>
          {spelling.map((c) => (
            <SuggestionRow
              key={`s${c.index}\u0000${c.from}`}
              from={c.from}
              into={c.to}
              label="spelling"
              onAccept={() => onApply(applyCorrection(text, c))}
              onReject={() => reject(c.from, c.to)}
            />
          ))}
          {grammarRows.map((edit) => (
            <SuggestionRow
              key={`g${edit.from}\u0000${edit.to}`}
              from={edit.from}
              into={edit.to}
              label="grammar"
              onAccept={() => acceptGrammar(edit)}
              onReject={() => reject(edit.from, edit.to)}
            />
          ))}
        </ul>
      )}
      {onCheckGrammar && (
        <div className={styles.check}>
          <button
            type="button"
            className={styles.checkBtn}
            disabled={checking || text.trim() === ""}
            onClick={() => void check()}
          >
            {checking ? "Checking…" : "Check grammar"}
          </button>
          {message !== null && (
            <p role="status" className={styles.notice}>
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
