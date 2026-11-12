import { notFound } from "next/navigation";
import CalendarScreen from "../../components/organisms/Calendar/CalendarScreen";

// Development only: see app/dev/layout.dev.tsx.
export default function Preview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CalendarScreen />;
}
