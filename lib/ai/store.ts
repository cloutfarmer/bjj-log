import "server-only";

import { database } from "../db";
import { INVALID_KEY } from "./run";

import type { PoolClient } from "pg";
import type { Store } from "./types";

export type TagSource = "code" | "ai" | "user";
export type EntryTagRow = { name: string; source: TagSource };

// Same value as hashText() in lib/ai/hash.ts, computed in SQL.
const SQL_HASH = "encode(sha256(convert_to(e.text, 'UTF8')), 'hex')";

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const pgStore: Store = {
  async getOutput(job, scope) {
    const { rows } = await database().query<{ inputHash: string; output: unknown }>(
      'SELECT input_hash AS "inputHash", output FROM bjj_ai_outputs WHERE job = $1 AND scope = $2',
      [job, scope],
    );
    return rows[0] ?? null;
  },
  async saveOutput(job, scope, inputHash, output) {
    await database().query(
      `INSERT INTO bjj_ai_outputs (job, scope, input_hash, output) VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (job, scope) DO UPDATE SET input_hash = EXCLUDED.input_hash, output = EXCLUDED.output, updated_at = now()`,
      [job, scope, inputHash, JSON.stringify(output)],
    );
  },
  async logRun({ job, model, inputTokens, outputTokens }) {
    await database().query(
      "INSERT INTO bjj_ai_runs (job, model, input_tokens, output_tokens) VALUES ($1, $2, $3, $4)",
      [job, model, inputTokens, outputTokens],
    );
  },
};

export async function getEntryTags(
  date: string,
): Promise<{ tags: EntryTagRow[]; byUser: boolean; textHash: string } | null> {
  const state = await database().query<{ byUser: boolean; textHash: string }>(
    'SELECT by_user AS "byUser", text_hash AS "textHash" FROM bjj_entry_tag_state WHERE entry_date = $1',
    [date],
  );
  if (!state.rows[0]) return null;
  const { rows } = await database().query<EntryTagRow>(
    "SELECT tag AS name, source FROM bjj_entry_tags WHERE entry_date = $1 ORDER BY created_at, tag",
    [date],
  );
  return { tags: rows, byUser: state.rows[0].byUser, textHash: state.rows[0].textHash };
}

export async function listTags(): Promise<Record<string, string>> {
  const { rows } = await database().query<{ name: string; bucket: string }>("SELECT name, bucket FROM bjj_tags ORDER BY name");
  return Object.fromEntries(rows.map((r) => [r.name, r.bucket]));
}

const PENDING_WHERE = `btrim(e.text) <> '' AND (s.entry_date IS NULL OR (s.by_user = false AND s.text_hash <> ${SQL_HASH}))`;

const TAGS_OF = (owner: string) =>
  `COALESCE((SELECT jsonb_agg(jsonb_build_object('name', t.tag, 'source', t.source) ORDER BY t.created_at, t.tag)
             FROM bjj_entry_tags t WHERE t.entry_date = ${owner}.entry_date), '[]'::jsonb)`;
const KNOWN_TAGS = "(SELECT COALESCE(jsonb_object_agg(name, bucket), '{}'::jsonb) FROM bjj_tags)";

export interface TagStateRow {
  entryTags: Record<string, { tags: EntryTagRow[]; byUser: boolean }>;
  tags: Record<string, string>;
  /** The newest notes that still need tagging, newest first. */
  pending: string[];
  pendingCount: number;
  cleanupDue: boolean;
}

/**
 * Everything the tag UI needs, in one statement on one connection. The pending set is
 * computed once and gives both the count and the newest dates, so each note's text is
 * hashed once per load.
 */
export async function getTagState(pendingLimit: number): Promise<TagStateRow> {
  const { rows } = await database().query<TagStateRow>(
    `WITH pending AS (
       SELECT e.entry_date FROM bjj_entries e
       LEFT JOIN bjj_entry_tag_state s ON s.entry_date = e.entry_date
       WHERE ${PENDING_WHERE}
     )
     SELECT
       ${KNOWN_TAGS} AS tags,
       (SELECT COALESCE(jsonb_object_agg(s.entry_date::text, jsonb_build_object('byUser', s.by_user, 'tags', ${TAGS_OF("s")})), '{}'::jsonb)
        FROM bjj_entry_tag_state s) AS "entryTags",
       (SELECT COALESCE(array_agg(p.date ORDER BY p.date DESC), '{}'::text[])
        FROM (SELECT entry_date::text AS date FROM pending ORDER BY entry_date DESC LIMIT $1) p) AS pending,
       (SELECT count(*)::int FROM pending) AS "pendingCount",
       -- With no saved cleanup yet, every tag counts as new. A cleanup whose reply was
       -- unusable is not a cleanup, so its marker row is ignored.
       (SELECT count(*) >= 10 FROM bjj_tags t
        WHERE t.created_at > COALESCE(
          (SELECT updated_at FROM bjj_ai_outputs WHERE job = 'tagCleanup' AND scope = 'all' AND output -> $2 IS NULL),
          '-infinity'::timestamptz)) AS "cleanupDue"`,
    [pendingLimit, INVALID_KEY],
  );
  return rows[0];
}

export interface TagContext {
  text: string;
  /** null when tagging has never looked at this note. */
  state: { tags: EntryTagRow[]; byUser: boolean; textHash: string } | null;
  known: Record<string, string>;
}

/** What a tag request needs to decide anything, in one query. null when the day has no entry. */
export async function loadTagContext(date: string): Promise<TagContext | null> {
  const { rows } = await database().query<{
    text: string;
    byUser: boolean | null;
    textHash: string | null;
    tags: EntryTagRow[];
    known: Record<string, string>;
  }>(
    `SELECT e.text, s.by_user AS "byUser", s.text_hash AS "textHash", ${TAGS_OF("e")} AS tags, ${KNOWN_TAGS} AS known
     FROM bjj_entries e LEFT JOIN bjj_entry_tag_state s ON s.entry_date = e.entry_date
     WHERE e.entry_date = $1`,
    [date],
  );
  const row = rows[0];
  if (!row) return null;
  const state = row.byUser === null || row.textHash === null ? null : { tags: row.tags, byUser: row.byUser, textHash: row.textHash };
  return { text: row.text, state, known: row.known };
}

export interface NewTag {
  name: string;
  /** Set only for a name that is not in bjj_tags yet. */
  newBucket: string | null;
}

// One statement for any number of tags: the names arrive as arrays, not one query each.
const NEW_TAGS =
  "INSERT INTO bjj_tags (name, bucket) SELECT * FROM unnest($1::text[], $2::text[]) ON CONFLICT (name) DO NOTHING";
const ADD_ENTRY_TAGS =
  "INSERT INTO bjj_entry_tags (entry_date, tag, source) SELECT $1::date, name, $3 FROM unnest($2::text[]) AS name ON CONFLICT (entry_date, tag) DO NOTHING";

async function ensureTags(client: PoolClient, tags: NewTag[]): Promise<void> {
  const created = tags.filter((tag) => tag.newBucket !== null);
  if (created.length) await client.query(NEW_TAGS, [created.map((tag) => tag.name), created.map((tag) => tag.newBucket)]);
}

async function addEntryTags(client: PoolClient, date: string, names: string[], source: TagSource): Promise<void> {
  if (names.length) await client.query(ADD_ENTRY_TAGS, [date, names, source]);
}

export function saveJobTags(date: string, tags: NewTag[], source: "code" | "ai", textHash: string): Promise<boolean> {
  return inTransaction(async (client) => {
    // A hand-edited entry is never touched by a job.
    const state = await client.query(
      `INSERT INTO bjj_entry_tag_state (entry_date, text_hash) VALUES ($1, $2)
       ON CONFLICT (entry_date) DO UPDATE SET text_hash = EXCLUDED.text_hash, updated_at = now()
       WHERE bjj_entry_tag_state.by_user = false`,
      [date, textHash],
    );
    if ((state.rowCount ?? 0) === 0) return false;
    await client.query("DELETE FROM bjj_entry_tags WHERE entry_date = $1", [date]);
    await ensureTags(client, tags);
    await addEntryTags(client, date, tags.map((tag) => tag.name), source);
    return true;
  });
}

/** Returns the note's tags as saved, so the caller needs no second read. */
export function saveUserTags(date: string, tags: NewTag[], textHash: string): Promise<EntryTagRow[]> {
  return inTransaction(async (client) => {
    await client.query(
      `INSERT INTO bjj_entry_tag_state (entry_date, text_hash, by_user) VALUES ($1, $2, true)
       ON CONFLICT (entry_date) DO UPDATE SET text_hash = EXCLUDED.text_hash, by_user = true, updated_at = now()`,
      [date, textHash],
    );
    await ensureTags(client, tags);
    const names = tags.map((t) => t.name);
    await client.query("DELETE FROM bjj_entry_tags WHERE entry_date = $1 AND NOT (tag = ANY($2::text[]))", [date, names]);
    // Rows that stay keep their original source.
    await addEntryTags(client, date, names, "user");
    const { rows } = await client.query<EntryTagRow>(
      "SELECT tag AS name, source FROM bjj_entry_tags WHERE entry_date = $1 ORDER BY created_at, tag",
      [date],
    );
    return rows;
  });
}

export async function tagCounts(): Promise<{ name: string; count: number }[]> {
  const { rows } = await database().query<{ name: string; count: number }>(
    `SELECT t.name, count(e.entry_date)::int AS count FROM bjj_tags t
     LEFT JOIN bjj_entry_tags e ON e.tag = t.name GROUP BY t.name ORDER BY t.name`,
  );
  return rows;
}

export function mergeTags(from: string, into: string): Promise<number | null> {
  return inTransaction(async (client) => {
    const found = await client.query("SELECT name FROM bjj_tags WHERE name = ANY($1)", [[from, into]]);
    if ((found.rowCount ?? 0) < 2) return null;
    // An entry that already has the target keeps it; its source row for `from` just goes away.
    const dropped = await client.query(
      "DELETE FROM bjj_entry_tags WHERE tag = $1 AND entry_date IN (SELECT entry_date FROM bjj_entry_tags WHERE tag = $2)",
      [from, into],
    );
    const moved = await client.query("UPDATE bjj_entry_tags SET tag = $2 WHERE tag = $1", [from, into]);
    await client.query("DELETE FROM bjj_tags WHERE name = $1", [from]);
    return (dropped.rowCount ?? 0) + (moved.rowCount ?? 0);
  });
}

export async function usageByJob(): Promise<{ job: string; runs: number; inputTokens: number; outputTokens: number }[]> {
  const { rows } = await database().query<{ job: string; runs: number; inputTokens: number; outputTokens: number }>(
    `SELECT job, count(*)::int AS runs, COALESCE(sum(input_tokens), 0)::int AS "inputTokens", COALESCE(sum(output_tokens), 0)::int AS "outputTokens"
     FROM bjj_ai_runs GROUP BY job ORDER BY job`,
  );
  return rows;
}
