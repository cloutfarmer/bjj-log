import { notFound } from "next/navigation";
import UntaggedList from "../../components/organisms/TagIndex/UntaggedList";

// Development only: see app/dev/layout.dev.tsx.
export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UntaggedList />;
}
