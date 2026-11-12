/** One fixed list so the model, the stored tag buckets and the counts agree. */
export const BUCKETS = [
  "guard",
  "passing",
  "leg locks",
  "takedowns",
  "submissions",
  "escapes",
  "pins",
  "other",
] as const;

export type Bucket = (typeof BUCKETS)[number];

export function isBucket(v: unknown): v is Bucket {
  return typeof v === "string" && (BUCKETS as readonly string[]).includes(v);
}
