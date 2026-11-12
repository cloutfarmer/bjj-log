"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import TagChip from "../../atoms/TagChip/TagChip";
import styles from "./TagEditor.module.css";

interface TagEditorProps {
  /** Tags on this note. */
  tags: readonly { name: string; bucket: string | null; source?: "code" | "ai" | "user" }[];
  /** Existing tag names found in the note text and not yet on it. */
  suggestions?: readonly string[];
  /** Every existing tag: name -> bucket. */
  allTags: Readonly<Record<string, string>>;
  /** The fixed bucket list, passed in so this component holds no domain constants. */
  buckets: readonly string[];
  max?: number;
  busy?: boolean;
  onAdd: (name: string, bucket: string) => void;
  onRemove: (name: string) => void;
  /** When set, each chip links there. */
  hrefFor?: (name: string) => string;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function TagEditor({
  tags,
  suggestions = [],
  allTags,
  buckets,
  max = 5,
  busy = false,
  onAdd,
  onRemove,
  hrefFor,
}: TagEditorProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const defaultBucket = buckets.includes("other") ? "other" : (buckets[0] ?? "");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [chosenBucket, setChosenBucket] = useState(defaultBucket);

  const onNote = new Set(tags.map((tag) => tag.name.toLowerCase()));
  const full = tags.length >= max;
  const normalised = normalise(text);
  const existingName = Object.keys(allTags).find((name) => name.toLowerCase() === normalised);
  const isNew = normalised !== "" && existingName === undefined;
  const shownSuggestions = full ? [] : suggestions.filter((name) => !onNote.has(name.toLowerCase()));
  const datalistNames = Object.keys(allTags).filter((name) => !onNote.has(name.toLowerCase()));

  // Keep the input focused after each add so several tags can be typed in a row.
  useEffect(() => {
    if (editing && !busy) inputRef.current?.focus();
  }, [editing, busy, tags.length]);

  function open() {
    setText("");
    setChosenBucket(defaultBucket);
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setText("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || normalised === "") return;
    if (!onNote.has(normalised)) {
      if (existingName !== undefined) {
        onAdd(existingName, allTags[existingName]);
      } else {
        onAdd(normalised, chosenBucket);
      }
    }
    setText("");
    setChosenBucket(defaultBucket);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.editor}>
        {tags.length === 0 && <span className={styles.none}>No tags yet</span>}
        {tags.map((tag) => (
          <TagChip
            key={tag.name}
            tag={tag.name}
            bucket={tag.bucket}
            source={tag.source}
            href={hrefFor?.(tag.name)}
            disabled={busy}
            onRemove={() => onRemove(tag.name)}
          />
        ))}
        {full ? (
          <span className={styles.none}>{max} tags is the limit</span>
        ) : (
          !editing && (
            <button type="button" className={styles.button} disabled={busy} onClick={open}>
              + Add tag
            </button>
          )
        )}
      </div>

      {editing && !full && (
        <form className={styles.editor} onSubmit={submit} onKeyDown={onKeyDown}>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            aria-label="New tag"
            maxLength={40}
            list={listId}
            value={text}
            disabled={busy}
            autoFocus
            onChange={(event) => setText(event.target.value)}
          />
          <datalist id={listId}>
            {datalistNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {isNew && (
            <select
              className={styles.input}
              aria-label="Bucket"
              value={chosenBucket}
              disabled={busy}
              onChange={(event) => setChosenBucket(event.target.value)}
            >
              {buckets.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className={styles.save} disabled={busy || normalised === ""}>
            Add
          </button>
          <button type="button" className={styles.button} disabled={busy} onClick={close}>
            Done
          </button>
        </form>
      )}

      {shownSuggestions.length > 0 && (
        <div className={styles.editor}>
          <span className={styles.label}>Suggested</span>
          {shownSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.suggestion}
              aria-label={`Add tag ${name}`}
              disabled={busy}
              onClick={() => onAdd(name, allTags[name] ?? defaultBucket)}
            >
              + {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
