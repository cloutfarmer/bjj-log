import { isAuthenticated, isSameOrigin } from "../../../../lib/auth";
import { isDate } from "../../../../lib/entries";
import { GLOSSARY, normalizeTerms } from "../../../../lib/glossary";
import { apiKey, modelFor } from "../../../../lib/ai/config";
import { hashText } from "../../../../lib/ai/hash";
import { isBucket } from "../../../../lib/ai/buckets";
import { JOBS } from "../../../../lib/ai/jobs";
import { anthropicProvider } from "../../../../lib/ai/provider";
import { runJob } from "../../../../lib/ai/run";
import { MAX_TAGS_PER_ENTRY, matchTags, needsModel } from "../../../../lib/ai/tagMatch";
import { getEntryTags, listTags, loadTagContext, pgStore, saveJobTags, saveUserTags } from "../../../../lib/ai/store";

import type { NewTag } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "AI features are unavailable right now.";
const HEADERS = { "Cache-Control": "private, no-store" };

type Source = "code" | "ai" | "user";
type Tagged = { name: string; source: Source }[];

function reply(tags: Tagged, byUser: boolean, known: Record<string, string>, extra: Record<string, string> = {}, called?: boolean) {
  const buckets: Record<string, string> = {};
  for (const { name } of tags) {
    const bucket = Object.prototype.hasOwnProperty.call(known, name) ? known[name] : extra[name];
    if (bucket !== undefined) buckets[name] = bucket;
  }
  const body: { tags: Tagged; byUser: boolean; buckets: Record<string, string>; called?: boolean } = { tags, byUser, buckets };
  if (called !== undefined) body.called = called;
  return Response.json(body, { headers: HEADERS });
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 40 ? name : null;
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
    const context = await loadTagContext(date);
    if (context === null || !context.text.trim()) return new Response("No note to tag", { status: 404 });
    const { text, known, state: current } = context;
    const hash = hashText(text);
    // Sorted, so the same tags always build the same model input and reuse its saved output.
    const knownNames = Object.keys(known).sort();
    if (current && (current.byUser || current.textHash === hash)) {
      return reply(current.tags, current.byUser, known, {}, false);
    }

    const finish = async (tags: NewTag[], source: "code" | "ai", called: boolean) => {
      if (await saveJobTags(date, tags, source, hash)) {
        const extra: Record<string, string> = {};
        for (const t of tags) if (t.newBucket !== null) extra[t.name] = t.newBucket;
        return reply(tags.map((t) => ({ name: t.name, source })), false, known, extra, called);
      }
      // A hand edit appeared meanwhile and wins.
      const latest = await getEntryTags(date);
      return reply(latest?.tags ?? [], latest?.byUser ?? true, await listTags(), {}, false);
    };

    // Code matches alone finish only when no glossary technique outweighs them; otherwise the
    // model reads the note too and its tags are added after the code matches.
    const matched = matchTags(text, knownNames, normalizeTerms);
    const fromCode: NewTag[] = matched.map((name) => ({ name, newBucket: null }));
    if (matched.length && !needsModel(text, knownNames, GLOSSARY, normalizeTerms)) {
      return await finish(fromCode, "code", false);
    }

    const key = apiKey();
    if (key === null) return new Response(UNAVAILABLE, { status: 503 });
    const result = await runJob(
      JOBS.tagNote,
      date,
      { text, tags: knownNames },
      { store: pgStore, provider: anthropicProvider(key), model: modelFor("tagNote") },
    );
    if (!result.ok) return new Response(UNAVAILABLE, { status: 503 });
    const merged: NewTag[] = [...fromCode];
    for (const t of result.output.tags) {
      if (!merged.some((m) => m.name === t.tag)) merged.push({ name: t.tag, newBucket: t.bucket });
    }
    // An empty list is saved too, so the note is not asked about again.
    return await finish(merged.slice(0, MAX_TAGS_PER_ENTRY), "ai", !result.cached);
  } catch {
    return new Response(UNAVAILABLE, { status: 503 });
  }
}

// Manual override of the whole set; the entry is then marked by-user so no job touches it.
export async function PUT(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!isDate(body?.date)) return new Response("Invalid date", { status: 400 });
  const date: string = body.date;
  const raw: unknown = body.tags;
  if (!Array.isArray(raw) || raw.length > MAX_TAGS_PER_ENTRY) return new Response("Invalid tags", { status: 400 });
  const wanted: { name: string; bucket: unknown }[] = [];
  for (const item of raw) {
    const name = normalizeName(typeof item === "object" && item !== null ? (item as { name?: unknown }).name : undefined);
    if (name === null) return new Response("Invalid tag", { status: 400 });
    wanted.push({ name, bucket: (item as { bucket?: unknown }).bucket });
  }
  try {
    const context = await loadTagContext(date);
    if (context === null) return new Response("No note to tag", { status: 404 });
    const hash = hashText(context.text);
    const known = context.known;
    const names = Object.keys(known);
    const tags: NewTag[] = [];
    const extra: Record<string, string> = {};
    for (const { name, bucket } of wanted) {
      const existing = names.find((t) => t.toLowerCase() === name);
      const final = existing ?? name;
      if (tags.some((t) => t.name === final)) continue;
      if (existing !== undefined) {
        tags.push({ name: existing, newBucket: null });
      } else {
        if (!isBucket(bucket)) return new Response("Invalid bucket", { status: 400 });
        tags.push({ name, newBucket: bucket });
        extra[name] = bucket;
      }
    }
    const saved = await saveUserTags(date, tags, hash);
    return reply(saved, true, known, extra);
  } catch {
    return new Response(UNAVAILABLE, { status: 503 });
  }
}
