import { isAuthenticated } from "../../../../lib/auth";
import { usageByJob } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  try {
    const jobs = await usageByJob();
    const total = jobs.reduce(
      (sum, j) => ({ runs: sum.runs + j.runs, inputTokens: sum.inputTokens + j.inputTokens, outputTokens: sum.outputTokens + j.outputTokens }),
      { runs: 0, inputTokens: 0, outputTokens: 0 },
    );
    return Response.json({ jobs, total }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("AI features are unavailable right now.", { status: 503 });
  }
}
