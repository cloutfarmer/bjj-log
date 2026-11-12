import { isAuthenticated } from "../../../../lib/auth";
import { apiKey } from "../../../../lib/ai/config";
import { cleanupDue, countPending, listEntryTags, listPendingDates, listTags } from "../../../../lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  try {
    const [entryTags, tags, pending, pendingCount, due] = await Promise.all([
      listEntryTags(),
      listTags(),
      listPendingDates(20),
      countPending(),
      cleanupDue(),
    ]);
    return Response.json(
      { available: apiKey() !== null, entryTags, tags, pending, pendingCount, cleanupDue: due },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return new Response("AI features are unavailable right now.", { status: 503 });
  }
}
