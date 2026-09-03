/**
 * Autosave to IndexedDB — plan §8 D1-8.
 *
 * What is stored is exactly `store.snapshot()`: the command log, the activity stream, and
 * the next version number. Not the derived document. Replaying the log reproduces the
 * document, its version history and its provenance, so a reload restores the *work*,
 * including what the agent did and when, rather than a flattened result.
 *
 * Privacy (§22.1, §4.6): this is the only place Vistect writes anything down, it writes to
 * the user's own browser, and nothing here contacts the network. The UI says so out loud.
 *
 * Every function degrades instead of throwing. IndexedDB is unavailable in some private
 * modes and can fail on quota, and losing autosave is not a reason to lose the session.
 */
import { openDB } from 'idb';
import type { PersistedSnapshot, Store } from '../core/store.js';

const DB_NAME = 'vistect';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const KEY = 'current';

/** Told to the user, so each case reads as a sentence rather than a status code. */
export type LoadOutcome =
  | { status: 'restored'; snapshot: PersistedSnapshot; summary: string }
  | { status: 'empty'; summary: string }
  | { status: 'unavailable'; summary: string }
  | { status: 'discarded'; summary: string };

const openDatabase = () =>
  openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });

const reason = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Checked here rather than trusted, because `store.hydrate()` throws on a snapshot it
 * cannot use and a corrupt autosave must not be able to stop the app from starting.
 */
const isSnapshot = (value: unknown): value is PersistedSnapshot => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PersistedSnapshot>;
  return (
    candidate.schema === 1 &&
    Array.isArray(candidate.log) &&
    Array.isArray(candidate.activity) &&
    typeof candidate.nextVersion === 'number'
  );
};

export async function loadSnapshot(): Promise<LoadOutcome> {
  let stored: unknown;
  try {
    const db = await openDatabase();
    stored = await db.get(STORE_NAME, KEY);
    db.close();
  } catch (error) {
    return {
      status: 'unavailable',
      summary: `This browser would not let Vistect open its local storage, so nothing was restored and nothing will be saved. Your work stays in this tab only. (${reason(error)})`,
    };
  }

  if (stored === undefined) {
    return {
      status: 'empty',
      summary: 'Starting a new document. Nothing was saved here before.',
    };
  }
  if (!isSnapshot(stored)) {
    return {
      status: 'discarded',
      summary:
        'The document saved in this browser was written by a different version of Vistect and could not be opened, so this session starts empty. The old data has been left untouched.',
    };
  }
  return {
    status: 'restored',
    snapshot: stored,
    summary: `Restored your document from this browser: ${stored.log.length} recorded ${stored.log.length === 1 ? 'change' : 'changes'}.`,
  };
}

export async function saveSnapshot(
  snapshot: PersistedSnapshot,
): Promise<{ ok: true } | { ok: false; summary: string }> {
  try {
    const db = await openDatabase();
    await db.put(STORE_NAME, snapshot, KEY);
    db.close();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      summary: `Vistect could not save to this browser, so changes since the last save are only in this tab. (${reason(error)})`,
    };
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await openDatabase();
    await db.delete(STORE_NAME, KEY);
    db.close();
  } catch {
    // Nothing to report: the caller asked for the saved copy to be gone and it is not there.
  }
}

export type AutosaveOptions = {
  /** Coalesces the bursts of changes one tool call produces into one write. */
  debounceMs?: number;
  /** Called once per distinct failure, so a broken quota does not announce on every keystroke. */
  onError?: (summary: string) => void;
  onSaved?: (snapshot: PersistedSnapshot) => void;
};

/**
 * Saves after every change, debounced, plus once more when the page is being hidden —
 * `pagehide` is the last event a mobile browser reliably fires before discarding the tab.
 * Returns a function that stops autosaving and flushes what is pending.
 */
export function attachAutosave(store: Store, options: AutosaveOptions = {}): () => void {
  const debounceMs = options.debounceMs ?? 250;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastError: string | undefined;
  let stopped = false;

  const write = () => {
    timer = undefined;
    void saveSnapshot(store.snapshot()).then((result) => {
      if (result.ok) {
        lastError = undefined;
        options.onSaved?.(store.snapshot());
        return;
      }
      if (result.summary !== lastError) {
        lastError = result.summary;
        options.onError?.(result.summary);
      }
    });
  };

  const schedule = () => {
    if (stopped) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  };

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      write();
    }
  };

  const unsubscribe = store.subscribe(schedule);
  window.addEventListener('pagehide', flush);

  return () => {
    stopped = true;
    unsubscribe();
    window.removeEventListener('pagehide', flush);
    flush();
  };
}
