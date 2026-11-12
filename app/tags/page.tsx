import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "../../lib/auth";
import TagIndex from "../components/organisms/TagIndex/TagIndex";

export const metadata: Metadata = { title: "Tags · BJJ Log" };

export default async function TagsPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return (
    <Suspense fallback={null}>
      <TagIndex />
    </Suspense>
  );
}
