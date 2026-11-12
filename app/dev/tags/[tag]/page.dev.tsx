import { notFound } from "next/navigation";
import { tagFromParam } from "../../../../lib/tagIndex";
import TagDetail from "../../../components/organisms/TagIndex/TagDetail";

// Development only: see app/dev/layout.dev.tsx.
export default async function Preview({ params }: { params: Promise<{ tag: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TagDetail name={tagFromParam((await params).tag)} />;
}
