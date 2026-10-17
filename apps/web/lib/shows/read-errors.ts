/**
 * Read failures raised by the shows module. Callers branch on the class, never
 * on the message, so the messages can stay user-safe.
 */

/**
 * Thrown when a shows read fails due to a network or connect issue, so the page
 * can render a real error state instead of a fake empty list. Previously
 * `listShowsForCurrentUser` returned `[]` on `fetch failed`, which made
 * `/shows?page=3` show an empty library after an 18s hang even when the user had
 * shows.
 */
export class ShowsNetworkError extends Error {
  constructor(cause: unknown) {
    super('Shows service is temporarily unavailable. Please retry.', { cause });
    this.name = 'ShowsNetworkError';
  }
}

/**
 * Thrown when the database rejects a catalogue read (statement timeout,
 * permission or schema failure). It is distinct from an empty catalogue: an
 * empty list means there are no listed products, this means we do not know.
 */
export class CatalogueReadError extends Error {
  /** Table whose read failed, for server logs; never shown to users. */
  readonly table: string | null;

  constructor(cause: unknown, context: { table?: string } = {}) {
    super('The firework catalogue could not be loaded.', { cause });
    this.name = 'CatalogueReadError';
    this.table = context.table ?? null;
  }
}
