import { database } from "../../../../lib/db";
import { isAuthenticated, isSameOrigin } from "../../../../lib/auth";
import { isDate, parseEntry } from "../../../../lib/entries";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 10000) return new Response("Invalid import", { status: 400 });
  const entries = Object.entries(body).map(([date, value]) => ({ date, entry: parseEntry(value) }));
  if (entries.some(({ date, entry }) => !isDate(date) || !entry)) return new Response("Invalid entry in import; nothing imported.", { status: 400 });
  // A single SQL statement is atomic; existing cloud entries always win.
  // The same emptiness rule as PUT: text, tags, or attire alone makes a day worth keeping.
  const records = entries.filter(({ entry }) => entry!.text.trim() || entry!.sessionTypes.length || entry!.attire)
    .map(({ date, entry }) => ({ date, text: entry!.text, tags: entry!.sessionTypes, attire: entry!.attire }));
  try {
    const result = await database().query(
      `INSERT INTO bjj_entries (entry_date, text, session_types, attire)
       SELECT date::date, text, tags, attire FROM jsonb_to_recordset($1::jsonb) AS x(date text, text text, tags text[], attire text)
       ON CONFLICT (entry_date) DO NOTHING`, [JSON.stringify(records)],
    );
    return Response.json({ imported: result.rowCount });
  } catch {
    return new Response("Import failed. Your browser notes have not been changed.", { status: 503 });
  }
}
