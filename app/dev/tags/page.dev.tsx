import { notFound } from "next/navigation";
import TagList from "../../components/organisms/TagIndex/TagList";

// Development only: see app/dev/layout.dev.tsx.
export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TagList />;
}
