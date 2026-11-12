"use client";

/* Development-only preview of the Tags screen: the real components with made-up data, and
 * no database, auth, or network. Mounted at /dev/tags by app/dev/tags/page.dev.tsx. */
import { useEffect, useRef, useState } from "react";
import { BUCKETS } from "../lib/ai/buckets";
import { MAX_TAGS_PER_ENTRY } from "../lib/ai/tagMatch";
import { suggestTags } from "../lib/tagIndex";
import AppHeader from "../app/components/organisms/AppHeader/AppHeader";
import TagIndexView from "../app/components/organisms/TagIndex/TagIndexView";
import pageStyles from "../app/page.module.css";
import { buildPreviewFixtures } from "./fixtures";

import type { EntryTags, TagState } from "../lib/aiClient";
import type { TagEditorProps } from "../lib/useTagState";
import type { JournalEntryData } from "../app/types";

type Fixtures = ReturnType<typeof buildPreviewFixtures>;

export default function TagsPreview() {
  // Built after mount so the server and browser agree on "today".
  const [fixtures, setFixtures] = useState<Fixtures | null>(null);
  const [entries, setEntries] = useState<Record<string, JournalEntryData>>({});
  const [entryTags, setEntryTags] = useState<Record<string, EntryTags>>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  // Always the latest, so an auto-tag loop builds on its own earlier steps.
  const latest = useRef({ tags, entryTags });
  latest.current = { tags, entryTags };

  useEffect(() => {
    const built = buildPreviewFixtures(new Date());
    setFixtures(built);
    setEntries(built.entries);
    setEntryTags(built.entryTags);
    setTags(built.tags);
  }, []);

  if (!fixtures) return null;

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

  const tagState: TagState = {
    available: true,
    entryTags,
    tags,
    pending: [],
    pendingCount: 0,
    cleanupDue: true,
  };
  const editorProps = (date: string, noteText: string): TagEditorProps => {
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
    };
  };

  return (
    <main className={pageStyles.main}>
      <AppHeader current="tags" signOut={false} hrefs={{ journal: "/dev", tags: "/dev/tags" }} />
      <div className={pageStyles.layout}>
        <TagIndexView
          entries={entries}
          tagState={tagState}
          editorProps={editorProps}
          autoTag={autoTag}
          onFindMerges={async () => fixtures.cleanupMerges.filter(m => m.from in tags && m.into in tags)}
          onMerge={merge}
          onLoadUsage={async () => fixtures.usage}
          journalHref={date => `/dev?date=${date}`}
        />
      </div>
    </main>
  );
}
