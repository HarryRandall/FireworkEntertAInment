/**
 * Bounded catalogue reads.
 *
 * Each table is read on its own with batched primary-key `in()` filters, so no
 * single statement grows with the catalogue the way the old nested embed did.
 * Every request is a page: an explicit, unique ordering plus an inclusive
 * `range()` strictly smaller than the PostgREST row cap, read until a page
 * comes back short. Without this a batch of 100 cakes silently stopped at the
 * 1000-row cap and dropped products. One limiter per graph read caps the
 * requests in flight across all tables. Every failure is thrown: an empty
 * graph only ever means there is genuinely nothing listed.
 */
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { isSupabaseTransientNetworkError } from '@/lib/supabase/errors';
import {
  CATALOGUE_INVENTORY_SELECT,
  CATALOGUE_ITEM_SELECT,
  CATALOGUE_MULTISHOT_PREVIEW_SELECT,
  CATALOGUE_MULTISHOT_SELECT,
  CATALOGUE_SHOT_SELECT,
  chunkIds,
  type CatalogueFireworkRow,
  type CatalogueGraph,
  type CatalogueInventoryRow,
  type CatalogueItemRow,
  type CatalogueMultishotPreviewRow,
  type CatalogueMultishotRow,
  type CatalogueShotRow,
} from './catalogue-products';
import { CatalogueReadError, ShowsNetworkError } from './read-errors';

type AppSupabase = SupabaseClient<Database>;

/**
 * Rows requested per page. PostgREST silently truncates a response at its
 * configured `max-rows` (1000 on Supabase), so the page must stay below that
 * for a short page to mean "complete".
 */
export const CATALOGUE_PAGE_SIZE = 500;
/** Flat one-row-per-id lookups carry little data, so larger `in()` batches are cheap. */
export const CATALOGUE_ID_BATCH_SIZE = 100;
/** Firework rows carry renderer JSON, so keep each response moderate. */
export const CATALOGUE_FIREWORK_BATCH_SIZE = 50;
/**
 * Multishots per shot-row lookup. Listed cakes average under 30 shots, so a
 * batch usually fits in one page and the batches run side by side instead of
 * one long sequential page walk.
 */
export const CATALOGUE_SHOT_BATCH_SIZE = 20;
/** Upper bound on simultaneous PostgREST requests for one catalogue read, all tables included. */
export const CATALOGUE_READ_CONCURRENCY = 6;

export type CatalogueGraphInclude = {
  /** Supplier pricing for `minPriceCents`. */
  inventory?: boolean;
  /** `multishots.shot_count` for the declared shot count. */
  multishotMeta?: boolean;
  /** Multishot poster manifests for browse cards. */
  multishotPreviews?: boolean;
  /**
   * Skip loading the direct firework rows. Timing profiles only consume
   * multishot children, so paying for every direct renderer payload again
   * after `listFireworkProducts` would be wasted I/O. Items with a direct
   * firework are still treated as direct products.
   */
  multishotChildrenOnly?: boolean;
};

/** Runs tasks with a shared in-flight cap; tasks start in submission order. */
export type ReadLimiter = <T>(task: () => PromiseLike<T>) => Promise<T>;

export function createReadLimiter(limit: number = CATALOGUE_READ_CONCURRENCY): ReadLimiter {
  const cap = Math.max(1, Math.floor(limit));
  let active = 0;
  const waiting: Array<() => void> = [];
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };
  async function run<T>(task: () => PromiseLike<T>): Promise<T> {
    if (active >= cap) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  }
  return run;
}

function throwCatalogueRead(table: string, error: unknown): never {
  if (error instanceof ShowsNetworkError || error instanceof CatalogueReadError) throw error;
  // The user-facing message stays generic; the database code and message stay in the logs.
  const detail = (error ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
  console.error('[catalogue] read failed:', {
    table,
    code: detail.code,
    message: detail.message ?? String(error),
    details: detail.details,
  });
  if (isSupabaseTransientNetworkError(error)) throw new ShowsNetworkError(error);
  throw new CatalogueReadError(error, { table });
}

type PageRange = { from: number; to: number };
type PageRead = (range: PageRange) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * Reads every page of one query. `read` must apply a total ordering (a unique
 * column last) before `range`, otherwise pages can overlap or skip rows.
 */
async function readPaged<Row>(limiter: ReadLimiter, table: string, read: PageRead): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 0; ; page += 1) {
    const from = page * CATALOGUE_PAGE_SIZE;
    const { data, error } = await limiter(() => read({ from, to: from + CATALOGUE_PAGE_SIZE - 1 }));
    if (error) throwCatalogueRead(table, error);
    const pageRows = (data ?? []) as Row[];
    rows.push(...pageRows);
    if (pageRows.length < CATALOGUE_PAGE_SIZE) return rows;
  }
}

/** Pages every `in()` batch; batches run side by side under the shared limiter. */
async function readBatched<Row>(
  limiter: ReadLimiter,
  table: string,
  ids: Iterable<string>,
  batchSize: number,
  read: (batch: string[], range: PageRange) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<Row[]> {
  const batches = chunkIds(ids, batchSize);
  if (batches.length === 0) return [];
  const results = await Promise.all(
    batches.map((batch) => readPaged<Row>(limiter, table, (range) => read(batch, range))),
  );
  return results.flat();
}

/**
 * Catalogue item metadata in name order. Without `ids` this is the whole
 * listed catalogue; with `ids` it is a batched lookup, optionally still
 * restricted to listed items.
 */
export async function readCatalogueItems(
  supabase: AppSupabase,
  params: { ids?: readonly string[]; listedOnly: boolean },
  limiter: ReadLimiter = createReadLimiter(),
): Promise<CatalogueItemRow[]> {
  const listed = <Q extends { eq(column: 'is_listed', value: boolean): Q }>(query: Q): Q =>
    params.listedOnly ? query.eq('is_listed', true) : query;
  if (params.ids) {
    const batches = chunkIds(params.ids, CATALOGUE_ID_BATCH_SIZE);
    const rows = await readBatched<CatalogueItemRow>(
      limiter,
      'catalogue_items',
      params.ids,
      CATALOGUE_ID_BATCH_SIZE,
      (batch, { from, to }) =>
        listed(supabase.from('catalogue_items').select(CATALOGUE_ITEM_SELECT).in('id', batch))
          .order('name', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    );
    // A single batch keeps the database's own ordering; several batches are
    // merged here so the scoped list still reads in name order.
    return batches.length > 1
      ? rows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      : rows;
  }
  return readPaged<CatalogueItemRow>(limiter, 'catalogue_items', ({ from, to }) =>
    listed(supabase.from('catalogue_items').select(CATALOGUE_ITEM_SELECT))
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );
}

/**
 * Loads every related row for `items`. Direct fireworks, inventory, multishot
 * metadata and shot rows are fetched concurrently under one limiter; the child
 * fireworks the shot rows point at follow in a second round so no firework row
 * is read twice.
 */
export async function readCatalogueGraph<F extends CatalogueFireworkRow>(
  supabase: AppSupabase,
  items: CatalogueItemRow[],
  fireworkSelect: string,
  include: CatalogueGraphInclude = {},
  limiter: ReadLimiter = createReadLimiter(),
): Promise<CatalogueGraph<F>> {
  const itemIds = items.map((item) => item.id);
  const multishotIds = items.flatMap((item) => (item.multishot_id ? [item.multishot_id] : []));
  const directFireworkIds = include.multishotChildrenOnly
    ? []
    : items.flatMap((item) => (item.firework_id ? [item.firework_id] : []));

  const readFireworks = (ids: Iterable<string>) =>
    readBatched<F>(
      limiter,
      'fireworks',
      ids,
      CATALOGUE_FIREWORK_BATCH_SIZE,
      (batch, { from, to }) =>
        supabase
          .from('fireworks')
          .select(fireworkSelect)
          .in('id', batch)
          .order('id', { ascending: true })
          .range(from, to),
    );

  const [directFireworks, inventory, multishots, shots, multishotPreviewImages] = await Promise.all(
    [
      readFireworks(directFireworkIds),
      include.inventory
        ? readBatched<CatalogueInventoryRow>(
            limiter,
            'supplier_inventory_items',
            itemIds,
            CATALOGUE_ID_BATCH_SIZE,
            (batch, { from, to }) =>
              supabase
                .from('supplier_inventory_items')
                .select(CATALOGUE_INVENTORY_SELECT)
                .in('catalogue_item_id', batch)
                .order('catalogue_item_id', { ascending: true })
                .order('id', { ascending: true })
                .range(from, to),
          )
        : Promise.resolve([] as CatalogueInventoryRow[]),
      include.multishotMeta
        ? readBatched<CatalogueMultishotRow>(
            limiter,
            'multishots',
            multishotIds,
            CATALOGUE_ID_BATCH_SIZE,
            (batch, { from, to }) =>
              supabase
                .from('multishots')
                .select(CATALOGUE_MULTISHOT_SELECT)
                .in('id', batch)
                .order('id', { ascending: true })
                .range(from, to),
          )
        : Promise.resolve([] as CatalogueMultishotRow[]),
      readBatched<CatalogueShotRow>(
        limiter,
        'multishot_fireworks',
        multishotIds,
        CATALOGUE_SHOT_BATCH_SIZE,
        (batch, { from, to }) =>
          supabase
            .from('multishot_fireworks')
            .select(CATALOGUE_SHOT_SELECT)
            .in('multishot_id', batch)
            .order('multishot_id', { ascending: true })
            .order('sequence_index', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to),
      ),
      include.multishotPreviews
        ? readBatched<CatalogueMultishotPreviewRow>(
            limiter,
            'firework_preview_images',
            multishotIds,
            CATALOGUE_ID_BATCH_SIZE,
            (batch, { from, to }) =>
              supabase
                .from('firework_preview_images')
                .select(CATALOGUE_MULTISHOT_PREVIEW_SELECT)
                .in('multishot_id', batch)
                .order('multishot_id', { ascending: true })
                .order('id', { ascending: true })
                .range(from, to),
          )
        : Promise.resolve([] as CatalogueMultishotPreviewRow[]),
    ],
  );

  const loaded = new Set(directFireworks.map((firework) => firework.id));
  const childFireworkIds = shots.flatMap((shot) =>
    shot.firework_id && !loaded.has(shot.firework_id) ? [shot.firework_id] : [],
  );
  const childFireworks = await readFireworks(childFireworkIds);

  return {
    items,
    inventory,
    multishots,
    shots,
    multishotPreviewImages,
    fireworks: [...directFireworks, ...childFireworks],
  };
}
