import { createHash } from 'node:crypto';

// Only reusable application content belongs in a fresh installation. Accounts,
// credit balances, jobs, logs, editor history and user shows are intentionally absent.
export const snapshotTables = [
  ['roles', 'id'],
  ['permissions', 'id'],
  ['role_permissions', 'role_id,permission_id'],
  ['firework_style_defaults', 'id'],
  ['firework_effects', 'id'],
  ['fireworks', 'id'],
  ['multishots', 'id'],
  ['multishot_fireworks', 'id'],
  ['catalogue_items', 'id'],
  ['supplier_profiles', 'id'],
  ['supplier_inventory_items', 'id'],
  ['assortments', 'id'],
  ['assortment_items', 'id'],
  ['prompt_configs', 'key'],
  ['generation_settings', 'key'],
  ['ai_credit_costs', 'key'],
  ['firework_preview_images', 'id'],
  ['show_presets', 'id'],
];

export function selectSnapshotContent(tables, selection) {
  const result = { ...tables };
  result.supplier_profiles = tables.supplier_profiles.filter(
    (row) => !selection.excludedSupplierIds.includes(row.id),
  );
  const suppliers = new Set(result.supplier_profiles.map((row) => row.id));
  result.supplier_inventory_items = tables.supplier_inventory_items.filter((row) =>
    suppliers.has(row.supplier_id),
  );
  result.assortments = tables.assortments.filter(
    (row) => !selection.excludedAssortmentIds.includes(row.id),
  );
  const assortments = new Set(result.assortments.map((row) => row.id));
  result.assortment_items = tables.assortment_items.filter((row) =>
    assortments.has(row.assortment_id),
  );
  result.show_presets = tables.show_presets.filter(
    (row) => selection.examplePresetSlugs.includes(row.slug) && row.is_published,
  );
  if (result.show_presets.length !== selection.examplePresetSlugs.length) {
    throw new Error('A selected example preset is missing or unpublished. Review the selection.');
  }
  return result;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function portableRow(table, row) {
  const result = { ...row };
  // These nullable audit references must not drag production accounts into a seed.
  for (const key of ['created_by', 'updated_by']) {
    if (Object.hasOwn(result, key)) result[key] = null;
  }
  if (table === 'show_presets') {
    result.source_show_id = null;
    delete result.composition_signature;
  }
  return result;
}

export async function readTable({ url, key, table, order, fetchImpl = fetch }) {
  const rows = [];
  let expectedTotal;
  for (let offset = 0; offset < 100_000; ) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.search = new URLSearchParams({
      select: '*',
      order,
      offset: String(offset),
      limit: '500',
    });
    const response = await fetchImpl(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Could not export ${table}: HTTP ${response.status}.`);
    const range = response.headers.get('content-range');
    const total = range?.match(/\/(\d+)$/)?.[1];
    if (total == null) throw new Error(`Missing exact row count for ${table}.`);
    if (expectedTotal != null && expectedTotal !== Number(total)) {
      throw new Error(`${table} changed during export. Stop catalogue edits and retry.`);
    }
    expectedTotal = Number(total);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`Invalid response for ${table}.`);
    rows.push(...batch);
    offset += batch.length;
    if (rows.length === expectedTotal) return rows;
    if (!batch.length || rows.length > expectedTotal)
      throw new Error(`Incomplete export of ${table}.`);
  }
  throw new Error(`${table} exceeds the snapshot row limit.`);
}

export function storageObjectPath(value) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\')) {
    throw new Error('Invalid Storage object path.');
  }
  if (value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid Storage object path.');
  }
  return value.split('/').map(encodeURIComponent).join('/');
}
