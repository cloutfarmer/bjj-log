import { notFound } from "next/navigation";
import type { Metadata } from "next";
import JournalPreview from "../../dev/JournalPreview";

// Development only. next.config.mjs compiles `page.dev.tsx` only under `next dev`; the
// guard is a second check. No session check: the page reads no journal data.
export const metadata: Metadata = { title: "BJJ Log preview", robots: { index: false } };

export default function DevPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <JournalPreview />;
}
