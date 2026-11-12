/* Browser-side helpers for the AI routes. Every function resolves to null on any failure
 * (network error, non-2xx, bad JSON) and never throws, because tagging is optional: the
 * journal must work exactly as before when the routes are missing or unavailable. */

export type TagSource = "code" | "ai" | "user";
export type EntryTag = { name: string; source: TagSource };
export type EntryTags = { tags: EntryTag[]; byUser: boolean };
export type TagState = {
  available: boolean;
  entryTags: Record<string, EntryTags>;
  tags: Record<string, string>;
  pending: string[];
  pendingCount: number;
  cleanupDue: boolean;
};
export type TagResult = { tags: EntryTag[]; byUser: boolean; buckets: Record<string, string> };

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
  const { available, entryTags, tags, pending, pendingCount, cleanupDue } = value;
  if (typeof available !== "boolean" || typeof cleanupDue !== "boolean" || typeof pendingCount !== "number") return null;
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
  const cleanEntryTags: Record<string, EntryTags> = {};
  for (const [date, item] of Object.entries(entryTags)) {
    if (!isRecord(item) || typeof item.byUser !== "boolean") return null;
    const list = parseEntryTagList(item.tags);
    if (!list) return null;
    cleanEntryTags[date] = { tags: list, byUser: item.byUser };
  }
  return { available, entryTags: cleanEntryTags, tags: cleanTags, pending: cleanPending, pendingCount, cleanupDue };
}

function parseEntryTagList(value: unknown): EntryTag[] | null {
  if (!Array.isArray(value)) return null;
  const list: EntryTag[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== "string" || !isSource(item.source)) return null;
    list.push({ name: item.name, source: item.source });
  }
  return list;
}

function parseTagResult(value: unknown): TagResult | null {
  if (!isRecord(value) || typeof value.byUser !== "boolean" || !isRecord(value.buckets)) return null;
  const tags = parseEntryTagList(value.tags);
  if (!tags) return null;
  const buckets: Record<string, string> = {};
  for (const [name, bucket] of Object.entries(value.buckets)) {
    if (typeof bucket !== "string") return null;
    buckets[name] = bucket;
  }
  return { tags, byUser: value.byUser, buckets };
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

export type TextEdit = { from: string; to: string };

/** Asks for grammar fixes to suggest. It edits nothing: the caller shows each fix for the user to accept. */
export async function requestClean(date: string, text: string): Promise<TextEdit[] | null> {
  try {
    const response = await fetch("/api/ai/clean", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ date, text }) });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.edits)) return null;
    const edits: TextEdit[] = [];
    for (const item of body.edits) {
      if (!isRecord(item) || typeof item.from !== "string" || typeof item.to !== "string") return null;
      edits.push({ from: item.from, to: item.to });
    }
    return edits;
  } catch {
    return null;
  }
}

export function requestTag(date: string): Promise<TagResult | null> {
  return send("POST", { date });
}

/** Replaces the whole tag set by hand; an empty list removes every tag and no job re-tags the entry. */
export function saveUserTags(date: string, tags: { name: string; bucket?: string }[]): Promise<TagResult | null> {
  return send("PUT", { date, tags });
}

export type TagMerge = { from: string; into: string };

/** Asks which tags look like duplicates. It merges nothing: the caller shows each pair for the user to accept. */
export async function requestCleanup(): Promise<TagMerge[] | null> {
  try {
    const response = await fetch("/api/ai/cleanup", { method: "POST", headers: JSON_HEADERS, body: "{}" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.merges)) return null;
    const merges: TagMerge[] = [];
    for (const item of body.merges) {
      if (!isRecord(item) || typeof item.from !== "string" || typeof item.into !== "string") return null;
      merges.push({ from: item.from, into: item.into });
    }
    return merges;
  } catch {
    return null;
  }
}

/** Performs one merge the user approved. True only when the server answered 2xx. */
export async function mergeTags(from: string, into: string): Promise<boolean> {
  try {
    const response = await fetch("/api/ai/cleanup/merge", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ from, into }) });
    return response.ok;
  } catch {
    return false;
  }
}

type UsageCount = { runs: number; inputTokens: number; outputTokens: number };
export type AiUsage = { jobs: (UsageCount & { job: string })[]; total: UsageCount };

function parseCount(value: unknown): UsageCount | null {
  if (!isRecord(value)) return null;
  const { runs, inputTokens, outputTokens } = value;
  if (typeof runs !== "number" || typeof inputTokens !== "number" || typeof outputTokens !== "number") return null;
  return { runs, inputTokens, outputTokens };
}

export async function fetchUsage(): Promise<AiUsage | null> {
  try {
    const response = await fetch("/api/ai/usage", { cache: "no-store" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.jobs)) return null;
    const total = parseCount(body.total);
    if (!total) return null;
    const jobs: AiUsage["jobs"] = [];
    for (const item of body.jobs) {
      const count = parseCount(item);
      if (!count || !isRecord(item) || typeof item.job !== "string") return null;
      jobs.push({ job: item.job, ...count });
    }
    return { jobs, total };
  } catch {
    return null;
  }
}
