import { database } from "../../../lib/db";
import { isAuthenticated, isSameOrigin } from "../../../lib/auth";
import { isDate, isEmptyEntry, parseEntry } from "../../../lib/entries";
import { collectionTag, isVersion, sameTag } from "../../../lib/entrySync";
import type { Attire, SavedEntry } from "../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Notes are never written to the browser's disk cache. The collection tag below lets the
// page ask "anything new?" without downloading them again.
const HEADERS = { "Cache-Control": "private, no-store" };

/** updated_at as exact text, so it survives JSON and compares without rounding. */
const versionOf = (column: string) => `to_char(${column} AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')`;
const VERSION = versionOf("updated_at");
const COLUMNS = `text, session_types AS "sessionTypes", attire, ${VERSION} AS version`;

type Row = { text: string; sessionTypes: string[]; attire: Attire | null; version: string };

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  try {
    const known = request.headers.get("if-none-match");
    if (known) {
      const { rows } = await database().query<{ count: number; newest: string | null }>(
        `SELECT count(*)::int AS count, ${versionOf("max(updated_at)")} AS newest FROM bjj_entries`,
      );
      const tag = collectionTag(rows[0].count, rows[0].newest);
      if (sameTag(known, tag)) return new Response(null, { status: 304, headers: { ...HEADERS, ETag: tag } });
    }
    const { rows } = await database().query<Row & { date: string }>(
      `SELECT entry_date::text AS date, ${COLUMNS} FROM bjj_entries ORDER BY entry_date DESC`,
    );
    const entries: Record<string, SavedEntry> = {};
    let newest: string | null = null;
    for (const { date, ...entry } of rows) {
      entries[date] = entry;
      if (newest === null || entry.version > newest) newest = entry.version;
    }
    // The tag is computed from the rows in this body, so the two always agree.
    return Response.json(entries, { headers: { ...HEADERS, ETag: collectionTag(rows.length, newest) } });
  } catch {
    return new Response("Unable to load your notes. Please retry.", { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const entry = parseEntry(body?.entry);
  if (!isDate(body?.date) || !entry) return new Response("Invalid entry", { status: 400 });
  // The version the editor started from: a string, null for "this day had no entry", or
  // absent from a page loaded before versions existed, which saves unconditionally.
  const base: unknown = body.baseVersion;
  if (base !== undefined && base !== null && !isVersion(base)) return new Response("Invalid version", { status: 400 });
  const date: string = body.date;
  try {
    const db = database();
    const current = async () =>
      (await db.query<Row>(`SELECT ${COLUMNS} FROM bjj_entries WHERE entry_date = $1`, [date])).rows[0] ?? null;
    const saved = (version: string | null) => Response.json({ saved: true, version }, { headers: HEADERS });
    // Nothing was written. The reply carries what the server holds so the editor can show it.
    const conflict = async () => Response.json({ conflict: true, current: await current() }, { status: 409, headers: HEADERS });

    if (isEmptyEntry(entry)) {
      if (base === undefined) {
        await db.query("DELETE FROM bjj_entries WHERE entry_date = $1", [date]);
        return saved(null);
      }
      if (base === null) return (await current()) ? await conflict() : saved(null);
      const removed = await db.query(`DELETE FROM bjj_entries WHERE entry_date = $1 AND ${VERSION} = $2`, [date, base]);
      // A day that is already gone is the result the editor asked for.
      return removed.rowCount || !(await current()) ? saved(null) : await conflict();
    }

    const values = [date, entry.text, entry.sessionTypes, entry.attire];
    const insert = "INSERT INTO bjj_entries (entry_date, text, session_types, attire) VALUES ($1, $2, $3, $4)";
    let result;
    if (base === undefined) {
      result = await db.query<{ version: string }>(
        `${insert} ON CONFLICT (entry_date) DO UPDATE SET text = EXCLUDED.text, session_types = EXCLUDED.session_types, attire = EXCLUDED.attire, updated_at = now()
         RETURNING ${VERSION} AS version`,
        values,
      );
    } else if (base === null) {
      result = await db.query<{ version: string }>(
        `${insert} ON CONFLICT (entry_date) DO NOTHING RETURNING ${VERSION} AS version`,
        values,
      );
    } else {
      result = await db.query<{ version: string }>(
        `UPDATE bjj_entries SET text = $2, session_types = $3, attire = $4, updated_at = now()
         WHERE entry_date = $1 AND ${VERSION} = $5 RETURNING ${VERSION} AS version`,
        [...values, base],
      );
    }
    return result.rows[0] ? saved(result.rows[0].version) : await conflict();
  } catch {
    return new Response("Could not save. Your draft is still open; please retry.", { status: 503 });
  }
}
