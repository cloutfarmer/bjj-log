import { isAuthenticated } from "../../../../lib/auth";
import { apiKey } from "../../../../lib/ai/config";
import { getTagState } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  try {
    const state = await getTagState(20);
    return Response.json(
      { available: apiKey() !== null, ...state },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return new Response("AI features are unavailable right now.", { status: 503 });
  }
}
