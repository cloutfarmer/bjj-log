import { isAuthenticated, isSameOrigin } from "../../../../lib/auth";
import { isDate } from "../../../../lib/entries";
import { normalizeTerms } from "../../../../lib/glossary";
import { apiKey, modelFor } from "../../../../lib/ai/config";
import { hashText } from "../../../../lib/ai/hash";
import { isBucket } from "../../../../lib/ai/buckets";
import { JOBS } from "../../../../lib/ai/jobs";
import { anthropicProvider } from "../../../../lib/ai/provider";
import { runJob } from "../../../../lib/ai/run";
import { matchTag } from "../../../../lib/ai/tagMatch";
import { getEntryTag, getEntryText, listTags, pgStore, saveJobTag, saveUserTag } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "AI features are unavailable right now.";
const HEADERS = { "Cache-Control": "private, no-store" };

type Source = "code" | "ai" | "user";

function reply(tag: string | null, source: Source, tags: Record<string, string>, called: boolean, bucket?: string | null) {
  return Response.json(
    { tag, bucket: bucket ?? (tag === null ? null : (tags[tag] ?? null)), source, called },
    { headers: HEADERS },
  );
}

// The server reads the note itself; it never trusts text sent by the client here.
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!isDate(body?.date)) return new Response("Invalid date", { status: 400 });
  const date: string = body.date;
  try {
    const text = await getEntryText(date);
    if (text === null || !text.trim()) return new Response("No note to tag", { status: 404 });
    const hash = hashText(text);
    const tags = await listTags();
    const current = await getEntryTag(date);
    if (current && (current.source === "user" || current.textHash === hash)) {
      return reply(current.tag, current.source, tags, false);
    }

    const finish = async (tag: string, source: "code" | "ai", bucket: string | null, called: boolean) => {
      if (await saveJobTag(date, tag, source, hash, bucket)) return reply(tag, source, tags, called, bucket ?? tags[tag] ?? null);
      // A hand-set tag appeared meanwhile and wins.
      const latest = await getEntryTag(date);
      return reply(latest?.tag ?? null, latest?.source ?? "user", await listTags(), false);
    };

    const match = matchTag(text, Object.keys(tags), normalizeTerms);
    if (match) return await finish(match, "code", null, false);

    const key = apiKey();
    if (key === null) return new Response(UNAVAILABLE, { status: 503 });
    const result = await runJob(
      JOBS.tagNote,
      date,
      { text, tags: Object.keys(tags) },
      { store: pgStore, provider: anthropicProvider(key), model: modelFor("tagNote") },
    );
    if (!result.ok) return new Response(UNAVAILABLE, { status: 503 });
    return await finish(result.output.tag, "ai", result.output.bucket, !result.cached);
  } catch {
    return new Response(UNAVAILABLE, { status: 503 });
  }
}

// Manual override, stored as source "user" so no job ever replaces it.
export async function PUT(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!isDate(body?.date)) return new Response("Invalid date", { status: 400 });
  const date: string = body.date;
  const raw: unknown = body.tag;
  if (raw !== null && typeof raw !== "string") return new Response("Invalid tag", { status: 400 });
  const name = raw === null ? null : raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (name !== null && (name.length < 1 || name.length > 40)) return new Response("Invalid tag", { status: 400 });
  try {
    const text = await getEntryText(date);
    if (text === null) return new Response("No note to tag", { status: 404 });
    const hash = hashText(text);
    if (name === null) {
      await saveUserTag(date, null, hash, null);
      return Response.json({ tag: null, bucket: null, source: "user" }, { headers: HEADERS });
    }
    const tags = await listTags();
    const existing = Object.keys(tags).find((t) => t.toLowerCase() === name);
    if (existing !== undefined) {
      await saveUserTag(date, existing, hash, null);
      return Response.json({ tag: existing, bucket: tags[existing], source: "user" }, { headers: HEADERS });
    }
    if (!isBucket(body.bucket)) return new Response("Invalid bucket", { status: 400 });
    await saveUserTag(date, name, hash, body.bucket);
    return Response.json({ tag: name, bucket: body.bucket, source: "user" }, { headers: HEADERS });
  } catch {
    return new Response(UNAVAILABLE, { status: 503 });
  }
}
