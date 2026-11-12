import styles from "./TagChip.module.css";

interface TagChipProps {
  tag: string;
  /** Broad bucket the tag belongs to, shown smaller after the tag. */
  bucket?: string | null;
  /** Who set it. "user" gets a subtle marker so hand-set tags are recognisable. */
  source?: "code" | "ai" | "user";
}

export default function TagChip({ tag, bucket, source }: TagChipProps) {
  const byUser = source === "user";
  return (
    <span className={byUser ? `${styles.chip} ${styles.user}` : styles.chip} title={byUser ? "Set by you" : undefined}>
      <span className={styles.tag}>{tag}</span>
      {bucket ? <span className={styles.bucket}>{bucket}</span> : null}
    </span>
  );
}
