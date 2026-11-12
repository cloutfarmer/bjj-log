import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import TagsPreview from "../../../dev/TagsPreview";

// Development only. next.config.mjs compiles `page.dev.tsx` only under `next dev`; the
// guard is a second check. No session check: the page reads no journal data.
export const metadata: Metadata = { title: "BJJ Log tags preview", robots: { index: false } };

export default function DevTagsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense fallback={null}>
      <TagsPreview />
    </Suspense>
  );
}
