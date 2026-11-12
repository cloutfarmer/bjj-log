import { isAuthenticated, isSameOrigin } from "../../../../lib/auth";
import { isDate } from "../../../../lib/entries";
import { apiKey, modelFor } from "../../../../lib/ai/config";
import { JOBS } from "../../../../lib/ai/jobs";
import { anthropicProvider } from "../../../../lib/ai/provider";
import { runJob } from "../../../../lib/ai/run";
import { pgStore } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "AI features are unavailable right now.";

// Runs only when the user presses the grammar button, on the editor draft.
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  const text: unknown = body?.text;
  if (!isDate(body?.date) || typeof text !== "string" || text.length < 1 || text.length > 50000 || !text.trim()) {
    return new Response("Invalid note", { status: 400 });
  }
  const key = apiKey();
  if (key === null) return new Response(UNAVAILABLE, { status: 503 });
  try {
    // Scope is the date, so an unchanged draft is served from the saved output at no cost.
    const result = await runJob(
      JOBS.cleanNote,
      body.date,
      { text },
      { store: pgStore, provider: anthropicProvider(key), model: modelFor("cleanNote") },
    );
    if (!result.ok) return new Response(UNAVAILABLE, { status: 503 });
    return Response.json(
      { edits: result.output.edits, called: !result.cached },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return new Response(UNAVAILABLE, { status: 503 });
  }
}
