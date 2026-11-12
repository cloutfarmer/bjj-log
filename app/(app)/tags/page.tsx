import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "../../../lib/auth";
import TagList from "../../components/organisms/TagIndex/TagList";

export const metadata: Metadata = { title: "Tags · BJJ Log" };

export default async function TagsPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return <TagList />;
}
