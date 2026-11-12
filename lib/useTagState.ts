"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import TagEditor from "../app/components/molecules/TagEditor/TagEditor";
import { BUCKETS } from "./ai/buckets";
import { MAX_TAGS_PER_ENTRY } from "./ai/tagMatch";
import { fetchTagState, requestTag, saveUserTags } from "./aiClient";
import { suggestTags } from "./tagIndex";

import type { TagResult, TagState } from "./aiClient";

export type TagEditorProps = ComponentProps<typeof TagEditor>;

const SAVE_ERROR = "Could not save the tag. Please retry.";

/** Owns the tag state of the journal and the calls that change it. The caller starts loading with reload(). */
export function useTagState() {
  // null hides all tag UI: the AI routes are missing, failed, or not loaded yet.
  const [tagState, setTagState] = useState<TagState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const aliveRef = useRef(false);
  // Always the latest state, so two quick edits build on each other.
  const stateRef = useRef<TagState | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const commit = useCallback((next: TagState | null) => {
    stateRef.current = next;
    if (aliveRef.current) setTagState(next);
  }, []);

  const apply = useCallback((date: string, result: TagResult) => {
    const previous = stateRef.current;
    if (!previous || !aliveRef.current) return;
    const tags = { ...previous.tags };
    for (const [name, bucket] of Object.entries(result.buckets)) {
      if (!Object.hasOwn(tags, name) && result.tags.some(tag => tag.name === name)) tags[name] = bucket;
    }
    const wasPending = previous.pending.includes(date);
    commit({
      ...previous,
      tags,
      entryTags: { ...previous.entryTags, [date]: { tags: result.tags, byUser: result.byUser } },
      pending: previous.pending.filter(item => item !== date),
      pendingCount: wasPending ? Math.max(0, previous.pendingCount - 1) : previous.pendingCount,
    });
  }, [commit]);

  const reload = useCallback(async () => {
    const state = await fetchTagState();
    if (!aliveRef.current) return null;
    commit(state);
    setLoaded(true);
    return state;
  }, [commit]);

  const autoTag = useCallback(async (date: string) => {
    const result = await requestTag(date);
    if (!result || !aliveRef.current) return false;
    apply(date, result);
    return true;
  }, [apply]);

  const saveList = useCallback(async (date: string, list: { name: string; bucket?: string }[]) => {
    if (list.length > MAX_TAGS_PER_ENTRY) return false;
    setBusy(true);
    setError("");
    try {
      const result = await saveUserTags(date, list);
      if (!aliveRef.current) return false;
      if (!result) {
        setError(SAVE_ERROR);
        return false;
      }
      apply(date, result);
      return true;
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [apply]);

  const addTag = useCallback((date: string, name: string, bucket: string) => {
    const current = stateRef.current?.entryTags[date]?.tags ?? [];
    if (current.some(tag => tag.name === name)) return Promise.resolve(true);
    return saveList(date, [...current.map(tag => ({ name: tag.name })), { name, bucket }]);
  }, [saveList]);

  const removeTag = useCallback((date: string, name: string) => {
    const current = stateRef.current?.entryTags[date]?.tags ?? [];
    return saveList(date, current.filter(tag => tag.name !== name).map(tag => ({ name: tag.name })));
  }, [saveList]);

  const forget = useCallback((date: string) => {
    const previous = stateRef.current;
    if (!previous || !Object.hasOwn(previous.entryTags, date)) return;
    const entryTags = { ...previous.entryTags };
    delete entryTags[date];
    commit({ ...previous, entryTags });
  }, [commit]);

  const editorProps = (date: string, noteText: string): TagEditorProps => {
    const allTags = tagState?.tags ?? {};
    const onNote = tagState?.entryTags[date]?.tags ?? [];
    const names = onNote.map(tag => tag.name);
    return {
      tags: onNote.map(tag => ({ name: tag.name, bucket: allTags[tag.name] ?? null, source: tag.source })),
      suggestions: suggestTags(noteText, Object.keys(allTags), names),
      allTags,
      buckets: BUCKETS,
      max: MAX_TAGS_PER_ENTRY,
      busy,
      onAdd: (name, bucket) => { void addTag(date, name, bucket); },
      onRemove: name => { void removeTag(date, name); },
    };
  };

  return { tagState, loaded, busy, error, reload, autoTag, addTag, removeTag, forget, editorProps };
}
