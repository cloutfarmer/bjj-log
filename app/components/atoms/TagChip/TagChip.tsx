import Link from "next/link";
import styles from "./TagChip.module.css";

interface TagChipProps {
  tag: string;
  /** Broad bucket the tag belongs to, shown smaller after the tag. */
  bucket?: string | null;
  /** Who set it. "user" gets a subtle marker so hand-set tags are recognisable. */
  source?: "code" | "ai" | "user";
  /** When set, the tag name links to this URL. */
  href?: string;
  /** When set, a remove button is shown inside the chip. */
  onRemove?: () => void;
  /** Disables the remove button. */
  disabled?: boolean;
}

export default function TagChip({ tag, bucket, source, href, onRemove, disabled = false }: TagChipProps) {
  const byUser = source === "user";
  return (
    <span className={byUser ? `${styles.chip} ${styles.user}` : styles.chip} title={byUser ? "Set by you" : undefined}>
      {href ? (
        <Link href={href} className={`${styles.tag} ${styles.link}`}>
          {tag}
        </Link>
      ) : (
        <span className={styles.tag}>{tag}</span>
      )}
      {bucket ? <span className={styles.bucket}>{bucket}</span> : null}
      {onRemove ? (
        <button type="button" className={styles.remove} aria-label={`Remove tag ${tag}`} disabled={disabled} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  );
}
