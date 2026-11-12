import "server-only";

import { database } from "../db";

import type { PoolClient } from "pg";
import type { Store } from "./types";

export type TagSource = "code" | "ai" | "user";

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

export async function getEntryText(date: string): Promise<string | null> {
  const { rows } = await database().query<{ text: string }>("SELECT text FROM bjj_entries WHERE entry_date = $1", [date]);
  return rows[0]?.text ?? null;
}

export async function getEntryTags(
  date: string,
): Promise<{ tags: { name: string; source: TagSource }[]; byUser: boolean; textHash: string } | null> {
  const state = await database().query<{ byUser: boolean; textHash: string }>(
    'SELECT by_user AS "byUser", text_hash AS "textHash" FROM bjj_entry_tag_state WHERE entry_date = $1',
    [date],
  );
  if (!state.rows[0]) return null;
  const { rows } = await database().query<{ name: string; source: TagSource }>(
    "SELECT tag AS name, source FROM bjj_entry_tags WHERE entry_date = $1 ORDER BY created_at, tag",
    [date],
  );
  return { tags: rows, byUser: state.rows[0].byUser, textHash: state.rows[0].textHash };
}

export async function listTags(): Promise<Record<string, string>> {
  const { rows } = await database().query<{ name: string; bucket: string }>("SELECT name, bucket FROM bjj_tags");
  return Object.fromEntries(rows.map((r) => [r.name, r.bucket]));
}

export async function listEntryTags(): Promise<
  Record<string, { tags: { name: string; source: TagSource }[]; byUser: boolean }>
> {
  const states = await database().query<{ date: string; byUser: boolean }>(
    'SELECT entry_date::text AS date, by_user AS "byUser" FROM bjj_entry_tag_state',
  );
  const tagRows = await database().query<{ date: string; name: string; source: TagSource }>(
    "SELECT entry_date::text AS date, tag AS name, source FROM bjj_entry_tags ORDER BY created_at, tag",
  );
  const out: Record<string, { tags: { name: string; source: TagSource }[]; byUser: boolean }> = {};
  for (const s of states.rows) out[s.date] = { tags: [], byUser: s.byUser };
  for (const t of tagRows.rows) out[t.date]?.tags.push({ name: t.name, source: t.source });
  return out;
}

const PENDING_WHERE = `btrim(e.text) <> '' AND (s.entry_date IS NULL OR (s.by_user = false AND s.text_hash <> ${SQL_HASH}))`;

export async function listPendingDates(limit: number): Promise<string[]> {
  const { rows } = await database().query<{ date: string }>(
    `SELECT e.entry_date::text AS date FROM bjj_entries e
     LEFT JOIN bjj_entry_tag_state s ON s.entry_date = e.entry_date
     WHERE ${PENDING_WHERE}
     ORDER BY e.entry_date DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.date);
}

export async function countPending(): Promise<number> {
  const { rows } = await database().query<{ count: number }>(
    `SELECT count(*)::int AS count FROM bjj_entries e
     LEFT JOIN bjj_entry_tag_state s ON s.entry_date = e.entry_date
     WHERE ${PENDING_WHERE}`,
  );
  return rows[0]?.count ?? 0;
}

export interface NewTag {
  name: string;
  /** Set only for a name that is not in bjj_tags yet. */
  newBucket: string | null;
}

const NEW_TAG = "INSERT INTO bjj_tags (name, bucket) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING";
const ADD_ENTRY_TAG =
  "INSERT INTO bjj_entry_tags (entry_date, tag, source) VALUES ($1, $2, $3) ON CONFLICT (entry_date, tag) DO NOTHING";

async function ensureTags(client: PoolClient, tags: NewTag[]): Promise<void> {
  for (const tag of tags) {
    if (tag.newBucket !== null) await client.query(NEW_TAG, [tag.name, tag.newBucket]);
  }
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
    for (const tag of tags) await client.query(ADD_ENTRY_TAG, [date, tag.name, source]);
    return true;
  });
}

export async function saveUserTags(date: string, tags: NewTag[], textHash: string): Promise<void> {
  await inTransaction(async (client) => {
    await client.query(
      `INSERT INTO bjj_entry_tag_state (entry_date, text_hash, by_user) VALUES ($1, $2, true)
       ON CONFLICT (entry_date) DO UPDATE SET text_hash = EXCLUDED.text_hash, by_user = true, updated_at = now()`,
      [date, textHash],
    );
    await ensureTags(client, tags);
    const names = tags.map((t) => t.name);
    await client.query("DELETE FROM bjj_entry_tags WHERE entry_date = $1 AND NOT (tag = ANY($2::text[]))", [date, names]);
    // Rows that stay keep their original source.
    for (const name of names) await client.query(ADD_ENTRY_TAG, [date, name, "user"]);
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

export async function cleanupDue(): Promise<boolean> {
  // With no saved cleanup yet, every tag counts as new.
  const { rows } = await database().query<{ due: boolean }>(
    `SELECT count(*) >= 10 AS due FROM bjj_tags t
     WHERE t.created_at > COALESCE((SELECT updated_at FROM bjj_ai_outputs WHERE job = 'tagCleanup' AND scope = 'all'), '-infinity'::timestamptz)`,
  );
  return rows[0]?.due ?? false;
}

export async function usageByJob(): Promise<{ job: string; runs: number; inputTokens: number; outputTokens: number }[]> {
  const { rows } = await database().query<{ job: string; runs: number; inputTokens: number; outputTokens: number }>(
    `SELECT job, count(*)::int AS runs, COALESCE(sum(input_tokens), 0)::int AS "inputTokens", COALESCE(sum(output_tokens), 0)::int AS "outputTokens"
     FROM bjj_ai_runs GROUP BY job ORDER BY job`,
  );
  return rows;
}
