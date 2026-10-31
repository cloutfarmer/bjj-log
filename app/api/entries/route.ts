import { database } from "../../../lib/db";
import { isAuthenticated, isSameOrigin } from "../../../lib/auth";
import { isDate, parseEntry } from "../../../lib/entries";
import type { Attire, JournalEntryData } from "../../types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  try {
    const { rows } = await database().query<{ date: string; text: string; sessionTypes: string[]; attire: Attire | null }>(
      'SELECT entry_date::text AS date, text, session_types AS "sessionTypes", attire FROM bjj_entries ORDER BY entry_date DESC',
    );
    const entries: Record<string, JournalEntryData> = {};
    for (const { date, text, sessionTypes, attire } of rows) entries[date] = { text, sessionTypes, attire };
    return Response.json(entries, { headers: { "Cache-Control": "private, no-store" } });
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
  try {
    // Attire alone still counts as a logged session, so it keeps the day on the calendar.
    if (!entry.text.trim() && entry.sessionTypes.length === 0 && entry.attire === null) {
      await database().query("DELETE FROM bjj_entries WHERE entry_date = $1", [body.date]);
    } else {
      await database().query(
        `INSERT INTO bjj_entries (entry_date, text, session_types, attire) VALUES ($1, $2, $3, $4)
         ON CONFLICT (entry_date) DO UPDATE SET text = EXCLUDED.text, session_types = EXCLUDED.session_types, attire = EXCLUDED.attire, updated_at = now()`,
        [body.date, entry.text, entry.sessionTypes, entry.attire],
      );
    }
    return Response.json({ saved: true });
  } catch {
    return new Response("Could not save. Your draft is still open; please retry.", { status: 503 });
  }
}
