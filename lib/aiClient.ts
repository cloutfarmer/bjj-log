/* Browser-side helpers for the AI routes. Every function resolves to null on any failure
 * (network error, non-2xx, bad JSON) and never throws, because tagging is optional: the
 * journal must work exactly as before when the routes are missing or unavailable. */

export type TagSource = "code" | "ai" | "user";
export type EntryTag = { tag: string | null; source: TagSource };
export type TagState = {
  available: boolean;
  entryTags: Record<string, EntryTag>;
  tags: Record<string, string>;
  pending: string[];
  cleanupDue: boolean;
};
export type TagResult = { tag: string | null; bucket: string | null; source: TagSource };

const JSON_HEADERS = { "Content-Type": "application/json" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSource(value: unknown): value is TagSource {
  return value === "code" || value === "ai" || value === "user";
}

/** Checks the response by hand: the server is trusted, but a stale deploy must not crash the page. */
function parseTagState(value: unknown): TagState | null {
  if (!isRecord(value)) return null;
  const { available, entryTags, tags, pending, cleanupDue } = value;
  if (typeof available !== "boolean" || typeof cleanupDue !== "boolean") return null;
  if (!isRecord(entryTags) || !isRecord(tags) || !Array.isArray(pending)) return null;
  const cleanPending: string[] = [];
  for (const date of pending) {
    if (typeof date !== "string") return null;
    cleanPending.push(date);
  }

  const cleanTags: Record<string, string> = {};
  for (const [name, bucket] of Object.entries(tags)) {
    if (typeof bucket !== "string") return null;
    cleanTags[name] = bucket;
  }
  const cleanEntryTags: Record<string, EntryTag> = {};
  for (const [date, item] of Object.entries(entryTags)) {
    if (!isRecord(item) || !isSource(item.source)) return null;
    if (item.tag !== null && typeof item.tag !== "string") return null;
    cleanEntryTags[date] = { tag: item.tag, source: item.source };
  }
  return { available, entryTags: cleanEntryTags, tags: cleanTags, pending: cleanPending, cleanupDue };
}

function parseTagResult(value: unknown): TagResult | null {
  if (!isRecord(value) || !isSource(value.source)) return null;
  if (value.tag !== null && typeof value.tag !== "string") return null;
  if (value.bucket !== null && typeof value.bucket !== "string") return null;
  return { tag: value.tag, bucket: value.bucket, source: value.source };
}

async function send(method: "POST" | "PUT", body: unknown): Promise<TagResult | null> {
  try {
    const response = await fetch("/api/ai/tag", { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!response.ok) return null;
    return parseTagResult(await response.json());
  } catch {
    return null;
  }
}

export async function fetchTagState(): Promise<TagState | null> {
  try {
    const response = await fetch("/api/ai/tags", { cache: "no-store" });
    if (!response.ok) return null;
    return parseTagState(await response.json());
  } catch {
    return null;
  }
}

export function requestTag(date: string): Promise<TagResult | null> {
  return send("POST", { date });
}

/** `tag: null` removes the tag; the server stores that as removed-by-user so it is never re-tagged. */
export function saveUserTag(date: string, tag: string | null, bucket?: string): Promise<TagResult | null> {
  return send("PUT", bucket === undefined ? { date, tag } : { date, tag, bucket });
}
