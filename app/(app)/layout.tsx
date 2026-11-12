import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isAuthenticated } from "../../lib/auth";
import { JournalProvider } from "../../lib/useJournal";
import AppShell from "../components/organisms/AppShell/AppShell";

/* One shell and one copy of the journal for every signed-in screen, so moving between
 * screens keeps the header, the loaded notes, and the selected day. A layout does not run
 * again on a client-side move, so each page below also checks the session itself. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");
  return (
    <JournalProvider>
      <AppShell>{children}</AppShell>
    </JournalProvider>
  );
}
