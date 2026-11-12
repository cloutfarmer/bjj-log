import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "../../../lib/auth";
import UntaggedList from "../../components/organisms/TagIndex/UntaggedList";

export const metadata: Metadata = { title: "Untagged · BJJ Log" };

export default async function UntaggedPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return <UntaggedList />;
}
