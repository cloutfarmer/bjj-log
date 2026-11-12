"use client";

import Link from "next/link";
import LogoMark from "../../atoms/LogoMark/LogoMark";
import pageStyles from "../../../page.module.css";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  current: "journal" | "tags";
  /** Return false to cancel leaving the page (unsaved draft). Called for nav links and for sign out. */
  confirmLeave?: () => boolean;
  /** Hide the sign-out form (the /dev preview has no session). */
  signOut?: boolean;
}

const LINKS = [
  { id: "journal", label: "Journal", href: "/" },
  { id: "tags", label: "Tags", href: "/tags" },
] as const;

export default function AppHeader({ current, confirmLeave, signOut = true }: AppHeaderProps) {
  return (
    <header className={pageStyles.appHeader}>
      <div className={pageStyles.brand}>
        <LogoMark className={pageStyles.logo} />
        <h1 className={pageStyles.title}>BJJ Log</h1>
      </div>
      <nav aria-label="Main" className={styles.nav}>
        {LINKS.map(({ id, label, href }) => (
          <Link
            key={id}
            href={href}
            className={`${styles.link} ${id === current ? styles.current : ""}`}
            aria-current={id === current ? "page" : undefined}
            onClick={event => { if (confirmLeave && !confirmLeave()) event.preventDefault(); }}
          >
            {label}
          </Link>
        ))}
      </nav>
      {signOut && (
        <form
          action="/api/logout"
          method="post"
          className={styles.signOutForm}
          onSubmit={event => { if (confirmLeave && !confirmLeave()) event.preventDefault(); }}
        >
          <button className={pageStyles.signOut} type="submit">Sign out</button>
        </form>
      )}
    </header>
  );
}
