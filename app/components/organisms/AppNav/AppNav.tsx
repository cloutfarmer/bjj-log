"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useJournal } from "../../../../lib/useJournal";
import styles from "./AppNav.module.css";

import type { ReactNode } from "react";
import type { ScreenHrefs } from "../../../../lib/useJournal";

type ScreenId = keyof ScreenHrefs;

const ITEMS: { id: ScreenId; label: string; icon: ReactNode }[] = [
  {
    id: "journal",
    label: "Journal",
    icon: <><path d="M7 4h10a1 1 0 0 1 1 1v15H8a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z" /><path d="M9.5 8.5h5M9.5 12h5" /></>,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4" /></>,
  },
  {
    id: "tags",
    label: "Tags",
    icon: <><path d="M4 5.5v5.7a2 2 0 0 0 .6 1.4l6.8 6.8a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L12.6 4.6A2 2 0 0 0 11.2 4H5.5A1.5 1.5 0 0 0 4 5.5z" /><circle cx="8.5" cy="8.5" r="1.1" /></>,
  },
  {
    id: "untagged",
    label: "Untagged",
    icon: <><path d="M4 13.5l2.6-8h10.8l2.6 8V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" /><path d="M4 13.5h4.6a3.4 3.4 0 0 0 6.8 0H20" /></>,
  },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The one navigation: header links on wide screens, a bottom tab bar on phones. */
export default function AppNav() {
  const { hrefs, entries, tagState, confirmLeave } = useJournal();
  const pathname = usePathname();
  // The journal's path is a prefix of the others in the /dev previews, so it is the fallback.
  const current: ScreenId = ITEMS.slice(1).find(item => under(pathname, hrefs[item.id]))?.id ?? "journal";
  const untagged = tagState
    ? Object.keys(entries).filter(date => entries[date].text.trim() && !tagState.entryTags[date]?.tags.length).length
    : 0;

  return (
    <nav aria-label="Main" className={styles.nav}>
      {ITEMS.map(({ id, label, icon }) => (
        <Link
          key={id}
          href={hrefs[id]}
          className={`${styles.link} ${id === current ? styles.current : ""}`}
          aria-current={id === current ? "page" : undefined}
          onClick={event => { if (!confirmLeave()) event.preventDefault(); }}
        >
          <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icon}
          </svg>
          <span>{label}</span>
          {id === "untagged" && untagged > 0 && <span className={styles.count}>{untagged}</span>}
        </Link>
      ))}
    </nav>
  );
}
