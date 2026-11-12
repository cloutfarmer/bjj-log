"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchUsage, mergeTags, requestCleanup } from "../../../../lib/aiClient";
import { useTagState } from "../../../../lib/useTagState";
import pageStyles from "../../../page.module.css";
import AppHeader from "../AppHeader/AppHeader";
import TagIndexView from "./TagIndexView";

import type { JournalEntryData } from "../../../types";

const LOAD_ERROR = "Could not load notes. Check your connection and sign in again if needed.";

export default function TagIndex() {
  const [entries, setEntries] = useState<Record<string, JournalEntryData> | null>(null);
  const [error, setError] = useState("");
  const { tagState, error: tagError, reload, autoTag, editorProps } = useTagState();

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/entries", { cache: "no-store" });
      if (!response.ok) throw new Error(LOAD_ERROR);
      setEntries(await response.json());
    } catch {
      setError(LOAD_ERROR);
    }
  }, []);

  useEffect(() => {
    void load();
    void reload();
  }, [load, reload]);

  const onMerge = useCallback(async (from: string, into: string) => {
    const ok = await mergeTags(from, into);
    await reload();
    return ok;
  }, [reload]);

  return (
    <main className={pageStyles.main}>
      <AppHeader current="tags" />
      {error && (
        <div role="alert" className={pageStyles.alert}>
          {error}{" "}
          <button type="button" className={pageStyles.secondaryButton} onClick={() => { void load(); }}>Retry</button>
        </div>
      )}
      {tagError && <div role="alert" className={pageStyles.alert}>{tagError}</div>}
      {!entries && !error && <div className={pageStyles.loading}>Loading notes…</div>}
      {entries && (
        <div className={pageStyles.layout}>
          <TagIndexView
            entries={entries}
            tagState={tagState}
            editorProps={editorProps}
            autoTag={autoTag}
            onFindMerges={requestCleanup}
            onMerge={onMerge}
            onLoadUsage={fetchUsage}
            journalHref={date => `/?date=${date}`}
          />
        </div>
      )}
    </main>
  );
}
