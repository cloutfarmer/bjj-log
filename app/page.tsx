import { redirect } from "next/navigation";
import { isAuthenticated } from "../lib/auth";
import Journal from "./components/Journal";

export default async function Home() {
  if (!(await isAuthenticated())) redirect("/login");
  return <Journal />;
}
