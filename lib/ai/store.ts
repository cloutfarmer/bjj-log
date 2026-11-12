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

export async function getEntryTag(date: string): Promise<{ tag: string | null; source: TagSource; textHash: string } | null> {
  const { rows } = await database().query<{ tag: string | null; source: TagSource; textHash: string }>(
    'SELECT tag, source, text_hash AS "textHash" FROM bjj_entry_tags WHERE entry_date = $1',
    [date],
  );
  return rows[0] ?? null;
}

export async function listTags(): Promise<Record<string, string>> {
  const { rows } = await database().query<{ name: string; bucket: string }>("SELECT name, bucket FROM bjj_tags");
  return Object.fromEntries(rows.map((r) => [r.name, r.bucket]));
}

export async function listEntryTags(): Promise<Record<string, { tag: string | null; source: TagSource }>> {
  const { rows } = await database().query<{ date: string; tag: string | null; source: TagSource }>(
    "SELECT entry_date::text AS date, tag, source FROM bjj_entry_tags",
  );
  return Object.fromEntries(rows.map((r) => [r.date, { tag: r.tag, source: r.source }]));
}

export async function listPendingDates(limit: number): Promise<string[]> {
  const { rows } = await database().query<{ date: string }>(
    `SELECT e.entry_date::text AS date FROM bjj_entries e
     LEFT JOIN bjj_entry_tags t ON t.entry_date = e.entry_date
     WHERE btrim(e.text) <> '' AND (t.entry_date IS NULL OR (t.source <> 'user' AND t.text_hash <> ${SQL_HASH}))
     ORDER BY e.entry_date DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.date);
}

const UPSERT_TAG = `INSERT INTO bjj_entry_tags (entry_date, tag, source, text_hash) VALUES ($1, $2, $3, $4)
  ON CONFLICT (entry_date) DO UPDATE SET tag = EXCLUDED.tag, source = EXCLUDED.source, text_hash = EXCLUDED.text_hash, updated_at = now()`;

const NEW_TAG = "INSERT INTO bjj_tags (name, bucket) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING";

export function saveJobTag(
  date: string,
  tag: string,
  source: "code" | "ai",
  textHash: string,
  newBucket: string | null,
): Promise<boolean> {
  return inTransaction(async (client) => {
    if (newBucket !== null) await client.query(NEW_TAG, [tag, newBucket]);
    // A hand-set row is never overwritten by a job.
    const result = await client.query(`${UPSERT_TAG} WHERE bjj_entry_tags.source <> 'user'`, [date, tag, source, textHash]);
    return (result.rowCount ?? 0) > 0;
  });
}

export async function saveUserTag(date: string, tag: string | null, textHash: string, newBucket: string | null): Promise<void> {
  await inTransaction(async (client) => {
    if (tag !== null && newBucket !== null) await client.query(NEW_TAG, [tag, newBucket]);
    await client.query(UPSERT_TAG, [date, tag, "user", textHash]);
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
    const moved = await client.query("UPDATE bjj_entry_tags SET tag = $2, updated_at = now() WHERE tag = $1", [from, into]);
    await client.query("DELETE FROM bjj_tags WHERE name = $1", [from]);
    return moved.rowCount ?? 0;
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
