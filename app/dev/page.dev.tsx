import { notFound } from "next/navigation";
import Journal from "../components/Journal";

// Development only: see app/dev/layout.dev.tsx.
export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Journal />;
}
