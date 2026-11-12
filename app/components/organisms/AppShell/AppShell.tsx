"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useJournal } from "../../../../lib/useJournal";
import LogoMark from "../../atoms/LogoMark/LogoMark";
import AppNav from "../AppNav/AppNav";
import pageStyles from "../../../page.module.css";
import styles from "./AppShell.module.css";

/** The frame every screen shares: brand, navigation, sign out, and the journal-wide messages. */
export default function AppShell({ children }: { children: ReactNode }) {
  const {
    signOut, ready, error, tagError, notice, clearNotice, retry,
    pendingImportCount, importNotes, busy, dirty, confirmLeave,
  } = useJournal();
  const pathname = usePathname();

  // A message such as "Saved" belongs to the screen it happened on.
  useEffect(() => {
    clearNotice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className={styles.shell}>
      <a href="#content" className={styles.skip}>Skip to content</a>
      <header className={pageStyles.appHeader}>
        <div className={pageStyles.brand}>
          <LogoMark className={pageStyles.logo} />
          <h1 className={pageStyles.title}>BJJ Log</h1>
        </div>
        <AppNav />
        {signOut ? (
          <form
            action="/api/logout"
            method="post"
            className={styles.signOutForm}
            onSubmit={event => { if (!confirmLeave()) event.preventDefault(); }}
          >
            <button className={pageStyles.signOut} type="submit">Sign out</button>
          </form>
        ) : (
          <span className={styles.signOutForm} />
        )}
      </header>
      <main id="content" tabIndex={-1} className={styles.content}>
        {(error || tagError) && <p role="alert" className={pageStyles.alert}>{error || tagError}</p>}
        {!ready && (
          <p className={pageStyles.loading} aria-busy={!error}>
            {error ? "Your notes did not load." : "Loading your notes…"}
            <button type="button" className={pageStyles.secondaryButton} onClick={retry}>Retry</button>
          </p>
        )}
        {notice && <p role="status" className={pageStyles.status}>{notice}</p>}
        {pendingImportCount > 0 && (
          <div className={pageStyles.importNotice}>
            <p>{pendingImportCount} browser {pendingImportCount === 1 ? "note is" : "notes are"} missing from your journal. Import keeps existing journal notes.</p>
            <button type="button" className={pageStyles.secondaryButton} disabled={busy || dirty || !ready} onClick={importNotes}>
              {busy ? "Importing…" : "Import browser notes"}
            </button>
          </div>
        )}
        {ready && children}
      </main>
    </div>
  );
}
