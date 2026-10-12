/** Unsaved editor drafts are kept in this browser so a reload or crash does not lose work. */

const STORAGE_PREFIX = 'showcrafter:editor-draft:';
const FORMAT_VERSION = 1;

/** What the editor needs to rebuild its fields; `signature` identifies the exact edit state. */
export interface DraftSnapshot {
  id: string;
  signature: string;
}

/** One stored draft and the saved record revision it started from. */
export interface StoredDraft<T extends DraftSnapshot> {
  version: typeof FORMAT_VERSION;
  savedAt: string;
  baseUpdatedAt: string;
  value: T;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Storage key for one record; editors of different kinds never share a draft. */
export function draftStorageKey(kind: string, id: string): string {
  return `${STORAGE_PREFIX}${kind}:${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a draft for this record, or null when there is none, it is unreadable or it belongs elsewhere. */
export function readDraft<T extends DraftSnapshot>(
  storage: DraftStorage | null,
  key: string,
  recordId: string,
): StoredDraft<T> | null {
  try {
    const text = storage?.getItem(key);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (
      !isRecord(parsed) ||
      parsed.version !== FORMAT_VERSION ||
      typeof parsed.savedAt !== 'string' ||
      typeof parsed.baseUpdatedAt !== 'string' ||
      !isRecord(parsed.value) ||
      parsed.value.id !== recordId ||
      typeof parsed.value.signature !== 'string'
    )
      return null;
    return parsed as unknown as StoredDraft<T>;
  } catch {
    return null;
  }
}

/** Writes a draft; returns false when the browser refuses (private mode, quota), so the UI can say so. */
export function writeDraft<T extends DraftSnapshot>(
  storage: DraftStorage | null,
  key: string,
  value: T,
  baseUpdatedAt: string,
  now = new Date(),
): boolean {
  if (!storage) return false;
  const draft: StoredDraft<T> = {
    version: FORMAT_VERSION,
    savedAt: now.toISOString(),
    baseUpdatedAt,
    value,
  };
  try {
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** Removes a draft; failures are ignored because a leftover draft is only offered, never applied. */
export function clearDraft(storage: DraftStorage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Blocked storage has nothing to remove.
  }
}
