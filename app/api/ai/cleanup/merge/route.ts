import { isAuthenticated, isSameOrigin } from "../../../../../lib/auth";
import { mergeTags } from "../../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validName = (v: unknown): v is string => typeof v === "string" && v.length >= 1 && v.length <= 40;

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
  let body;
  try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!validName(body?.from) || !validName(body?.into) || body.from === body.into) {
    return new Response("Invalid merge", { status: 400 });
  }
  try {
    const merged = await mergeTags(body.from, body.into);
    if (merged === null) return new Response("Unknown tag", { status: 404 });
    return Response.json({ merged }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("AI features are unavailable right now.", { status: 503 });
  }
}
