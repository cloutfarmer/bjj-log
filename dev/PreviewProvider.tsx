"use client";

/* Development-only stand-in for JournalProvider: the same context, filled with made-up
 * data, and no database, auth, or network. Mounted by app/dev/layout.dev.tsx, which
 * next.config.mjs leaves out of production builds. Saves and tag edits stay in memory. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BUCKETS } from "../lib/ai/buckets";
import { isEmptyEntry } from "../lib/entries";
import { SaveConflictError } from "../lib/entrySync";
import { MAX_TAGS_PER_ENTRY } from "../lib/ai/tagMatch";
import { suggestTags } from "../lib/tagIndex";
import { JournalContext, tagHref, useDraftGuard } from "../lib/useJournal";
import { buildPreviewFixtures } from "./fixtures";
import styles from "./PreviewProvider.module.css";

import type { EntryTags, TagState } from "../lib/aiClient";
import type { JournalValue, ScreenHrefs } from "../lib/useJournal";
import type { JournalEntryData, SavedEntry } from "../app/types";

type Fixtures = ReturnType<typeof buildPreviewFixtures>;

const PREVIEW_HREFS: ScreenHrefs = { journal: "/dev", calendar: "/dev/calendar", tags: "/dev/tags", untagged: "/dev/untagged" };

export default function PreviewProvider({ children }: { children: ReactNode }) {
  // Built after mount so the server and browser agree on "today".
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [entries, setEntries] = useState<Record<string, SavedEntry>>({});
  // Makes the next save answer as if the day had been changed on another device.
  const [conflictNext, setConflictNext] = useState(false);
  const pathname = usePathname();
  const [entryTags, setEntryTags] = useState<Record<string, EntryTags>>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { dirty, setDirty, confirmSwitch, confirmLeave } = useDraftGuard(selectedDate);
  const [notice, setNotice] = useState("");
  // Always the latest, so an auto-tag loop builds on its own earlier steps.
  const latest = useRef({ tags, entryTags });
  latest.current = { tags, entryTags };

  useEffect(() => {
    const built = buildPreviewFixtures(new Date());
    setFixtures(built);
    setEntries(Object.fromEntries(Object.entries(built.entries).map(([date, entry]) => [date, { ...entry, version: "" }])));
    setEntryTags(built.entryTags);
    setTags(built.tags);
    setSelectedDate(built.featuredDate);
  }, []);

  function selectDate(date: string) {
    if (date === selectedDate) return true;
    if (!confirmSwitch()) return false;
    setSelectedDate(date);
    return true;
  }

  // An empty entry is deleted, as in lib/useJournal.tsx.
  function store(date: string, entry: JournalEntryData | null) {
    setEntries(previous => {
      const updated = { ...previous };
      if (!entry || isEmptyEntry(entry)) delete updated[date];
      else updated[date] = { ...entry, version: "" };
      return updated;
    });
  }
  async function save(date: string, entry: JournalEntryData) {
    if (conflictNext) {
      setConflictNext(false);
      throw new SaveConflictError({
        text: "Made-up note from another device.\nKnee cut: pin the far hip first.",
        sessionTypes: ["open-mat"],
        attire: "nogi",
        version: "",
      });
    }
    store(date, entry);
    setNotice("Saved to your journal.");
  }

  // A new tag joins the suggestions, as in the real journal.
  function addTag(date: string, name: string, bucket: string) {
    setTags(previous => ({ ...previous, [name]: previous[name] ?? bucket }));
    setEntryTags(previous => {
      const current = previous[date]?.tags ?? [];
      if (current.some(tag => tag.name === name) || current.length >= MAX_TAGS_PER_ENTRY) return previous;
      return { ...previous, [date]: { tags: [...current, { name, source: "user" }], byUser: true } };
    });
  }
  function removeTag(date: string, name: string) {
    setEntryTags(previous => ({
      ...previous,
      [date]: { tags: (previous[date]?.tags ?? []).filter(tag => tag.name !== name), byUser: true },
    }));
  }
  async function autoTag(date: string) {
    const { tags: known, entryTags: current } = latest.current;
    const names = suggestTags(entries[date]?.text ?? "", Object.keys(known), []);
    const next = { ...current, [date]: { tags: names.map(name => ({ name, source: "code" as const })), byUser: false } };
    latest.current = { tags: known, entryTags: next };
    setEntryTags(next);
    return true;
  }
  // Merging repoints the in-memory entry tags, as the real route does.
  async function merge(from: string, into: string) {
    setTags(previous => Object.fromEntries(Object.entries(previous).filter(([name]) => name !== from)));
    setEntryTags(previous => Object.fromEntries(Object.entries(previous).map(([date, item]) => [
      date,
      {
        ...item,
        tags: item.tags
          .map(tag => (tag.name === from ? { ...tag, name: into } : tag))
          .filter((tag, index, all) => all.findIndex(other => other.name === tag.name) === index),
      },
    ])));
    return true;
  }

  const tagState: TagState = { available: true, entryTags, tags, pending: [], pendingCount: 0, cleanupDue: true };

  const value: JournalValue = {
    hrefs: PREVIEW_HREFS,
    signOut: false,
    entries,
    ready: fixtures !== null,
    error: "",
    notice,
    clearNotice: () => setNotice(""),
    retry: () => undefined,
    selectedDate,
    selectDate,
    busy: false,
    dirty,
    setDirty,
    confirmLeave,
    save,
    adopt: store,
    pendingImportCount: 0,
    importNotes: () => undefined,
    tagState,
    tagsLoaded: fixtures !== null,
    tagError: "",
    editorProps: (date, noteText) => {
      const onNote = entryTags[date]?.tags ?? [];
      return {
        tags: onNote.map(tag => ({ name: tag.name, bucket: tags[tag.name] ?? null, source: tag.source })),
        suggestions: suggestTags(noteText, Object.keys(tags), onNote.map(tag => tag.name)),
        allTags: tags,
        buckets: BUCKETS,
        max: MAX_TAGS_PER_ENTRY,
        busy: false,
        onAdd: (name, bucket) => addTag(date, name, bucket),
        onRemove: name => removeTag(date, name),
        hrefFor: name => tagHref(PREVIEW_HREFS, name),
      };
    },
    autoTag,
    findMerges: async () => (fixtures?.cleanupMerges ?? []).filter(item => item.from in tags && item.into in tags),
    merge,
    loadUsage: async () => fixtures?.usage ?? null,
  };

  return (
    <JournalContext.Provider value={value}>
      {children}
      {/* Imitate another device, to try the conflict and background-change handling. */}
      {pathname === PREVIEW_HREFS.journal && fixtures && (
        <div className={styles.controls}>
          <label className={styles.control}>
            <input type="checkbox" checked={conflictNext} onChange={event => setConflictNext(event.target.checked)} />
            Next save conflicts
          </label>
          <button
            type="button"
            className={styles.control}
            onClick={() => {
              if (selectedDate) store(selectedDate, { text: "Made-up background change.", sessionTypes: ["drilling"], attire: null });
            }}
          >
            Change the saved copy
          </button>
        </div>
      )}
    </JournalContext.Provider>
  );
}
