import { isAuthenticated, isSameOrigin } from "../../../../lib/auth";
import { apiKey, modelFor } from "../../../../lib/ai/config";
import { JOBS } from "../../../../lib/ai/jobs";
import { anthropicProvider } from "../../../../lib/ai/provider";
import { runJob } from "../../../../lib/ai/run";
import { pgStore, tagCounts } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAVAILABLE = "AI features are unavailable right now.";
const HEADERS = { "Cache-Control": "private, no-store" };

// Suggestions only: nothing merges until /api/ai/cleanup/merge is called. Tag names and
// counts go to the model, never note text.
export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  try {
    const counts = await tagCounts();
    if (counts.length < 2) return Response.json({ merges: [], called: false }, { headers: HEADERS });
    const key = apiKey();
    if (key === null) return new Response(UNAVAILABLE, { status: 503 });
    const result = await runJob(
      JOBS.tagCleanup,
      "all",
      { tags: counts },
      { store: pgStore, provider: anthropicProvider(key), model: modelFor("tagCleanup") },
    );
    if (!result.ok) return new Response(UNAVAILABLE, { status: 503 });
    return Response.json({ merges: result.output.merges, called: !result.cached }, { headers: HEADERS });
  } catch {
    return new Response(UNAVAILABLE, { status: 503 });
  }
}
