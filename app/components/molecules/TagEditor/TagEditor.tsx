"use client";

import { useId, useState, type FormEvent } from "react";
import TagChip from "../../atoms/TagChip/TagChip";
import styles from "./TagEditor.module.css";

interface TagEditorProps {
  /** Current tag, or null when the note is untagged or the tag was removed. */
  tag: string | null;
  bucket: string | null;
  source?: "code" | "ai" | "user";
  /** Existing tags: name -> bucket. Used for suggestions and to know if a typed tag is new. */
  tags: Readonly<Record<string, string>>;
  /** The fixed bucket list, passed in so this component holds no domain constants. */
  buckets: readonly string[];
  busy?: boolean;
  onChange: (tag: string, bucket: string) => void;
  onRemove: () => void;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function TagEditor({
  tag,
  bucket,
  source,
  tags,
  buckets,
  busy = false,
  onChange,
  onRemove,
}: TagEditorProps) {
  const listId = useId();
  const defaultBucket = buckets.includes("other") ? "other" : (buckets[0] ?? "");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [chosenBucket, setChosenBucket] = useState(defaultBucket);

  const normalised = normalise(text);
  const existingName = Object.keys(tags).find((name) => name.toLowerCase() === normalised);
  const isNew = normalised !== "" && existingName === undefined;

  function open() {
    setText(tag ?? "");
    setChosenBucket(defaultBucket);
    setEditing(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || normalised === "") return;
    if (existingName !== undefined) {
      onChange(existingName, tags[existingName]);
    } else {
      onChange(normalised, chosenBucket);
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className={styles.editor}>
        {tag === null ? (
          <span className={styles.none}>No tag</span>
        ) : (
          <TagChip tag={tag} bucket={bucket} source={source} />
        )}
        <button type="button" className={styles.button} disabled={busy} onClick={open}>
          {tag === null ? "Add tag" : "Change"}
        </button>
        {tag !== null && (
          <button type="button" className={styles.button} disabled={busy} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    );
  }

  return (
    <form className={styles.editor} onSubmit={submit}>
      <input
        className={styles.input}
        type="text"
        aria-label="Tag"
        maxLength={40}
        list={listId}
        value={text}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
      />
      <datalist id={listId}>
        {Object.keys(tags).map((name) => (
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
        Save
      </button>
      <button type="button" className={styles.button} disabled={busy} onClick={() => setEditing(false)}>
        Cancel
      </button>
      {tag !== null && (
        <button type="button" className={styles.button} disabled={busy} onClick={onRemove}>
          Remove
        </button>
      )}
    </form>
  );
}
