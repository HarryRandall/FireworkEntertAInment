/**
 * Pure assembly of catalogue products and replay shots from flat table rows.
 *
 * The catalogue used to be read through one deeply nested PostgREST embed
 * (`catalogue_items -> multishots -> multishot_fireworks -> fireworks`). With a
 * few hundred listed products that single statement exceeded the database's
 * statement timeout and the whole catalogue read failed. The server loader now
 * fetches each table with bounded, batched primary-key lookups and these
 * helpers join the rows in memory. Keeping the join pure makes the ordering,
 * pricing, multishot and preview rules testable without a database.
 */
import type { LaunchPosition } from '@showcrafter/fireworks/design';
import {
  parseReconstructionShotVariant,
  parseShotPositionOverride,
  parseShotSeedOverride,
} from '@/lib/firework-import/reconstruction-shot';
import { resolveFireworkPreviewImage } from '@/lib/firework-preview-image';
import { DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS } from '@/lib/replay-shot-timing';
import type { FireworkSpecification } from '@/lib/show-domain';
import { mapCatalogueFireworkCard, mapFireworkVariantSpecification } from './mappers';
import type { CatalogueFireworkCardProjection, FireworkVariantProjection } from './types';

/** Flat `catalogue_items` projection; the FK columns drive the follow-up reads. */
export type CatalogueItemRow = {
  id: string;
  name: string;
  part_number: string;
  manufacturer: string | null;
  description: string | null;
  duration_seconds: number | null;
  catalogue_item_kind: string;
  firework_id: string | null;
  multishot_id: string | null;
};

export const CATALOGUE_ITEM_SELECT =
  'id, name, part_number, manufacturer, description, duration_seconds, catalogue_item_kind, firework_id, multishot_id';

export type CatalogueInventoryRow = {
  catalogue_item_id: string | null;
  price_cents: number | null;
  available: boolean | null;
};

export const CATALOGUE_INVENTORY_SELECT = 'catalogue_item_id, price_cents, available';

export type CatalogueMultishotRow = {
  id: string;
  shot_count: number | null;
};

export const CATALOGUE_MULTISHOT_SELECT = 'id, shot_count';

export type CatalogueShotRow = {
  id: string;
  multishot_id: string;
  sequence_index: number;
  time_offset_seconds: number | string | null;
  caliber: string | null;
  firework_id: string | null;
  pan_degrees: number | null;
  tilt_degrees: number | null;
  position_override_json: unknown;
};

export const CATALOGUE_SHOT_SELECT =
  'id, multishot_id, sequence_index, time_offset_seconds, caliber, firework_id, pan_degrees, tilt_degrees, position_override_json';

export type CatalogueMultishotPreviewRow = {
  multishot_id: string | null;
  source_revision: number;
  renderer_version: string | null;
  storage_path: string | null;
};

export const CATALOGUE_MULTISHOT_PREVIEW_SELECT =
  'multishot_id, source_revision, renderer_version, storage_path';

export type CatalogueFireworkRow = FireworkVariantProjection | CatalogueFireworkCardProjection;

/** Every flat row set needed to assemble products or replay shots. */
export type CatalogueGraph<F extends { id: string } = CatalogueFireworkRow> = {
  items: CatalogueItemRow[];
  inventory: CatalogueInventoryRow[];
  multishots: CatalogueMultishotRow[];
  shots: CatalogueShotRow[];
  multishotPreviewImages: CatalogueMultishotPreviewRow[];
  fireworks: F[];
};

export type CatalogueItemShotSpec = {
  kind: 'direct' | 'multishot';
  sourceCueId: string;
  timeOffsetSeconds: number;
  panDegrees: number | null;
  tiltDegrees: number | null;
  positionOverride: LaunchPosition | null;
  seedOverride: number | null;
  firework: FireworkSpecification;
};

/** Split ids into PostgREST-friendly `in()` batches. */
export function chunkIds(ids: Iterable<string>, size: number): string[][] {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += size) {
    batches.push(unique.slice(offset, offset + size));
  }
  return batches;
}

/** Cheapest purchasable supplier price for a catalogue item; null when unlisted. */
export function cheapestAvailablePriceCents(
  rows: Array<{ price_cents: number | null; available: boolean | null }> | null | undefined,
): number | null {
  let cheapest: number | null = null;
  for (const row of rows ?? []) {
    if (!row.available || row.price_cents == null || !Number.isFinite(row.price_cents)) continue;
    if (cheapest == null || row.price_cents < cheapest) cheapest = row.price_cents;
  }
  return cheapest;
}

function finiteOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function groupBy<T>(
  rows: readonly T[],
  key: (row: T) => string | null | undefined,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    if (!id) continue;
    const group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

/** Shot rows for one multishot in firing order; a stable sort keeps ties deterministic. */
function orderedShots(shots: readonly CatalogueShotRow[] | undefined): CatalogueShotRow[] {
  return [...(shots ?? [])].sort((a, b) => a.sequence_index - b.sequence_index);
}

type CatalogueIndex<F extends { id: string }> = {
  fireworksById: Map<string, F>;
  inventoryByItem: Map<string, CatalogueInventoryRow[]>;
  multishotsById: Map<string, CatalogueMultishotRow>;
  shotsByMultishot: Map<string, CatalogueShotRow[]>;
  previewsByMultishot: Map<string, CatalogueMultishotPreviewRow[]>;
};

function indexGraph<F extends { id: string }>(graph: CatalogueGraph<F>): CatalogueIndex<F> {
  return {
    fireworksById: new Map(graph.fireworks.map((firework) => [firework.id, firework])),
    inventoryByItem: groupBy(graph.inventory, (row) => row.catalogue_item_id),
    multishotsById: new Map(graph.multishots.map((multishot) => [multishot.id, multishot])),
    shotsByMultishot: groupBy(graph.shots, (row) => row.multishot_id),
    previewsByMultishot: groupBy(graph.multishotPreviewImages, (row) => row.multishot_id),
  };
}

/**
 * Returns one {@link FireworkSpecification} per selectable catalogue item, in
 * the order of `graph.items`.
 *
 * Single-firework items read directly from `fireworks`. Multishots use their
 * first child firework for prompt/render preview data, while replay expands
 * the full sequence through `multishot_fireworks`. Items whose firework rows
 * are missing are skipped; a multishot with an unreadable child keeps its
 * entry but reports a design error so generation refuses to schedule it.
 */
export function assembleCatalogueProducts(
  graph: CatalogueGraph,
  options: { lightweight: boolean },
): FireworkSpecification[] {
  const index = indexGraph(graph);
  const mapFirework = (
    firework: CatalogueFireworkRow,
    sortOrder: number,
    caliber: string | null,
  ) =>
    options.lightweight
      ? mapCatalogueFireworkCard(firework as CatalogueFireworkCardProjection, sortOrder, caliber)
      : mapFireworkVariantSpecification(firework as FireworkVariantProjection, sortOrder, caliber);

  // Child specs are only inspected here (design validity and durations), never
  // handed out, so one mapping per firework and calibre serves every cake that
  // shares it. A listed catalogue has thousands of shots over a few hundred
  // fireworks, and mapping validates the renderer design each time.
  const childSpecs = new Map<string, FireworkSpecification>();
  const mapChild = (firework: CatalogueFireworkRow, caliber: string | null) => {
    const key = `${firework.id}\u0000${caliber ?? ''}`;
    let spec = childSpecs.get(key);
    if (!spec) {
      spec = mapFirework(firework, 0, caliber);
      childSpecs.set(key, spec);
    }
    return spec;
  };

  const mapped: FireworkSpecification[] = [];
  for (const item of graph.items) {
    const directFirework = item.firework_id ? index.fireworksById.get(item.firework_id) : undefined;
    const multishotShots = item.multishot_id
      ? orderedShots(index.shotsByMultishot.get(item.multishot_id))
      : [];
    const firstMultishotShot = multishotShots.find(
      (shot) => shot.firework_id != null && index.fireworksById.has(shot.firework_id),
    );
    const primary =
      directFirework ??
      (firstMultishotShot?.firework_id
        ? index.fireworksById.get(firstMultishotShot.firework_id)
        : undefined);
    if (!primary) continue;

    const isMultishot = item.catalogue_item_kind === 'multishot';
    const base = mapFirework(primary, mapped.length, firstMultishotShot?.caliber ?? null);
    const previewImage = isMultishot
      ? resolveFireworkPreviewImage(
          item.multishot_id ? index.previewsByMultishot.get(item.multishot_id) : null,
        )
      : {
          previewImagePath: base.previewImagePath ?? null,
          previewImageRevision: base.previewImageRevision ?? null,
        };
    const children = multishotShots.map((shot) => {
      const firework = shot.firework_id ? index.fireworksById.get(shot.firework_id) : undefined;
      if (!firework) return null;
      return {
        spec: mapChild(firework, shot.caliber),
        offset: finiteOrZero(shot.time_offset_seconds),
      };
    });
    const hasInvalidChild = children.some((child) => !child?.spec.design);
    const multishot = item.multishot_id ? index.multishotsById.get(item.multishot_id) : undefined;

    mapped.push({
      ...base,
      ...previewImage,
      id: item.id,
      slug: item.part_number,
      name: item.name,
      manufacturer: item.manufacturer,
      description: item.description ?? base.description,
      minPriceCents: cheapestAvailablePriceCents(index.inventoryByItem.get(item.id)),
      durationSeconds: isMultishot
        ? Math.max(
            0,
            ...children.map((child) =>
              child ? child.offset + (child.spec.durationSeconds ?? 0) : 0,
            ),
          )
        : base.durationSeconds,
      occupancyDurationSeconds: isMultishot
        ? Math.max(
            0,
            ...children.map((child) =>
              child ? child.offset + (child.spec.occupancyDurationSeconds ?? 0) : 0,
            ),
          )
        : base.occupancyDurationSeconds,
      designError: hasInvalidChild
        ? 'A multishot child has no valid renderer design.'
        : base.designError,
      shotCount: isMultishot ? (multishot?.shot_count ?? multishotShots.length) : 1,
    });
  }
  return mapped;
}

export type AssembleShotsOptions = {
  /** Timing analysis must distinguish a missing offset from a real zero. */
  preserveUnknownTiming?: boolean;
};

/**
 * Builds the per-catalogue-item shot list used by replay expansion and timing
 * profiles. A single firework becomes one shot; a multishot fans out into one
 * shot per ordered `multishot_fireworks` row.
 */
export function assembleCatalogueItemShots(
  graph: CatalogueGraph<FireworkVariantProjection>,
  options: AssembleShotsOptions = {},
): Map<string, CatalogueItemShotSpec[]> {
  const index = indexGraph(graph);
  const shotsByCatalogueItem = new Map<string, CatalogueItemShotSpec[]>();

  for (const item of graph.items) {
    const directFirework = item.firework_id ? index.fireworksById.get(item.firework_id) : undefined;
    if (directFirework) {
      const reconstructionShot = parseReconstructionShotVariant(directFirework.variant_json);
      shotsByCatalogueItem.set(item.id, [
        {
          kind: 'direct',
          sourceCueId: `${directFirework.id}-card-preview`,
          timeOffsetSeconds: DIRECT_SHOW_REPLAY_SHOT_OFFSET_SECONDS,
          panDegrees: reconstructionShot?.panDegrees ?? null,
          tiltDegrees: reconstructionShot?.tiltDegrees ?? null,
          positionOverride: reconstructionShot?.positionOverride ?? null,
          seedOverride: reconstructionShot?.seedOverride ?? null,
          firework: mapFireworkVariantSpecification(directFirework, 0),
        },
      ]);
      continue;
    }

    const shots: CatalogueItemShotSpec[] = [];
    for (const shot of orderedShots(
      item.multishot_id ? index.shotsByMultishot.get(item.multishot_id) : undefined,
    )) {
      const firework = shot.firework_id ? index.fireworksById.get(shot.firework_id) : undefined;
      if (!firework) continue;
      shots.push({
        kind: 'multishot',
        sourceCueId: shot.id,
        timeOffsetSeconds: options.preserveUnknownTiming
          ? shot.time_offset_seconds == null || String(shot.time_offset_seconds).trim() === ''
            ? Number.NaN
            : Number(shot.time_offset_seconds)
          : finiteOrZero(shot.time_offset_seconds),
        panDegrees: shot.pan_degrees == null ? null : Number(shot.pan_degrees),
        tiltDegrees: shot.tilt_degrees == null ? null : Number(shot.tilt_degrees),
        positionOverride: parseShotPositionOverride(shot.position_override_json),
        seedOverride: parseShotSeedOverride(shot.position_override_json),
        firework: mapFireworkVariantSpecification(firework, shots.length, shot.caliber),
      });
    }
    if (shots.length > 0) shotsByCatalogueItem.set(item.id, shots);
  }

  return shotsByCatalogueItem;
}
