import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isAuthenticated } from "../../../lib/auth";
import CalendarScreen from "../../components/organisms/Calendar/CalendarScreen";

export const metadata: Metadata = { title: "Calendar · BJJ Log" };

export default async function CalendarPage() {
  if (!(await isAuthenticated())) redirect("/login");
  return <CalendarScreen />;
}
