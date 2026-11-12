"use client";

import { useEffect, useSyncExternalStore } from "react";
import { mergeEntries, parseSavedEntries } from "./entrySync";

import type { SavedEntry } from "../app/types";

/* The browser's one copy of the journal, shared by every screen. It lives in page memory
 * only: a full page load (such as sign-out) drops it, and nothing is written to disk.
 * A check for changes sends the collection tag, and the server answers 304 with no body
 * when nothing changed. */

export interface JournalSnapshot {
  /** True once the journal has loaded at least once. */
  ready: boolean;
  /** Set only while there is nothing to show; a failed background check keeps the old data. */
  error: string;
  entries: Record<string, SavedEntry>;
}

const LOAD_ERROR = "Could not load notes. Check your connection and sign in again if needed.";
const RECHECK_MS = 30_000;
const EMPTY: JournalSnapshot = { ready: false, error: "", entries: {} };

let snapshot: JournalSnapshot = EMPTY;
let etag: string | null = null;
let inFlight: Promise<void> | null = null;
let lastChecked = 0;
let paused = false;
const listeners = new Set<() => void>();

function publish(next: JournalSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

async function fetchEntries() {
  try {
    const response = await fetch("/api/entries", {
      cache: "no-store",
      headers: etag ? { "If-None-Match": etag } : undefined,
    });
    if (response.status === 304) {
      lastChecked = Date.now();
      return;
    }
    const entries = response.ok ? parseSavedEntries(await response.json()) : null;
    if (!entries) throw new Error(LOAD_ERROR);
    // A draft was opened while this check was in flight. Drop the result and check
    // again later, so the entry never changes under the editor.
    if (paused && snapshot.ready) return;
    lastChecked = Date.now();
    etag = response.headers.get("ETag");
    const merged = mergeEntries(snapshot.entries, entries);
    if (!snapshot.ready || snapshot.error || merged !== snapshot.entries) publish({ ready: true, error: "", entries: merged });
  } catch {
    if (!snapshot.ready) publish({ ...snapshot, error: LOAD_ERROR });
  }
}

/** Loads the journal, or checks it for changes when it is already loaded. Never rejects. */
export function loadEntries(options: { full?: boolean } = {}): Promise<void> {
  if (options.full) etag = null;
  if (!inFlight) {
    if (snapshot.error) publish({ ...snapshot, error: "" });
    inFlight = fetchEntries().finally(() => { inFlight = null; });
  }
  return inFlight;
}

function recheck() {
  if (paused || !snapshot.ready || document.visibilityState !== "visible") return;
  if (Date.now() - lastChecked < RECHECK_MS) return;
  void loadEntries();
}

/**
 * While a draft is open the journal is not rechecked, so an entry never changes under
 * the editor. The save itself still catches a change made elsewhere.
 */
export function pauseRechecks(value: boolean) {
  paused = value;
}

/** Records a save the server accepted. `entry` is null when the day was deleted. */
export function applySaved(date: string, entry: SavedEntry | null) {
  const entries = { ...snapshot.entries };
  if (entry) entries[date] = entry;
  else delete entries[date];
  // The collection changed, so the old tag no longer describes it.
  etag = null;
  publish({ ...snapshot, entries });
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    }
  };
}

export function useJournal(): JournalSnapshot {
  const current = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  useEffect(() => {
    if (snapshot.ready) recheck();
    else void loadEntries();
  }, []);
  return current;
}
