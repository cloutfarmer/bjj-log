import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "../../../../lib/auth";
import { tagFromParam } from "../../../../lib/tagIndex";
import TagDetail from "../../../components/organisms/TagIndex/TagDetail";

export const metadata: Metadata = { title: "Tag · BJJ Log" };

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  if (!(await isAuthenticated())) redirect("/login");
  return <TagDetail name={tagFromParam((await params).tag)} />;
}
