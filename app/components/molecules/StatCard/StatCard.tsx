import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: number;
  /** Marks the one figure on the panel that carries the accent. */
  lead?: boolean;
  /** Belt stripes under the figure, like the tape on a belt tip. Capped at four. */
  stripes?: number;
}

const MAX_STRIPES = 4;

export default function StatCard({ label, value, lead = false, stripes }: StatCardProps) {
  return (
    <div className={styles.card}>
      <span className={lead ? `${styles.value} ${styles.lead}` : styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {stripes !== undefined && (
        <span className={styles.beltTip} aria-hidden="true">
          {Array.from({ length: MAX_STRIPES }, (_, index) => (
            <i key={index} className={index < Math.min(stripes, MAX_STRIPES) ? styles.stripeOn : styles.stripe} />
          ))}
        </span>
      )}
    </div>
  );
}
