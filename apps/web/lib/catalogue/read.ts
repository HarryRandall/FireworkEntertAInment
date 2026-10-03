/** Complete, paginated RLS reads keep catalogue results honest beyond PostgREST's row cap. */
import 'server-only';

const READ_PAGE_ROWS = 200; // Transport batch size in rows, chosen to bound document payloads.
/** Reads every page from a stably ordered query; database errors are never empty catalogues. */
export async function readRows<T>(
  query: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += READ_PAGE_ROWS) {
    const result = await query(start, start + READ_PAGE_ROWS - 1);
    if (result.error !== null && result.error !== undefined)
      throw new Error('Catalogue read failed', { cause: result.error });
    if (!result.data) throw new Error('Catalogue response has no records');
    rows.push(...result.data);
    if (result.data.length < READ_PAGE_ROWS) return rows;
  }
}
