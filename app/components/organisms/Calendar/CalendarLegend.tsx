import styles from "./Calendar.module.css";

/** What the entry dots mean. Shown wherever the dots are. */
export default function CalendarLegend() {
  return (
    <div className={styles.legend}>
      <span><i className={styles.swatchGi} /> Gi</span>
      <span><i className={styles.swatchNogi} /> No-Gi</span>
      <span><i className={styles.swatchPlain} /> Not recorded</span>
    </div>
  );
}
