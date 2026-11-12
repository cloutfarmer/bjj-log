import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import PreviewProvider from "../../dev/PreviewProvider";
import AppShell from "../components/organisms/AppShell/AppShell";

// Development only. next.config.mjs compiles `*.dev.tsx` route files only under `next dev`;
// the guard is a second check. No session check: the previews read no journal data.
export const metadata: Metadata = { title: "BJJ Log preview", robots: { index: false } };

export default function DevPreviewLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <PreviewProvider>
      <AppShell>{children}</AppShell>
    </PreviewProvider>
  );
}
