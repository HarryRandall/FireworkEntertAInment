/** Cookie-bound public RPC reads retain failures and validate their limited data contracts. */
import 'server-only';
import { readShowSoundtrack } from './music/readers';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { qrSchema, storePageSchema, storeProductSchema, showPageSchema } from './contracts';

/** Reads a public store by slug; null means unavailable, while failed reads throw. */
export async function readStore(slug: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('store_page_by_slug', { p_slug: slug });
  if (error) throw error;
  return data === null ? null : storePageSchema.parse(data);
}
/** Reads one visible in-market product at a store, with published playback only. */
export async function readProduct(slug: string, id: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('product_for_store', { p_slug: slug, p_product: id });
  if (error) throw error;
  return data === null ? null : storeProductSchema.parse(data);
}
/** Reads a retailer show at its store with current documents and quantity-aware availability. */
export async function readShow(store: string, id: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('show_for_store', { p_store: store, p_show: id });
  if (error) throw error;
  return data === null
    ? null
    : { ...showPageSchema.parse(data), soundtrack: await readShowSoundtrack(store, id) };
}
/** Resolves a permanent QR code without reading raw retailer tables. */
export async function readQr(slug: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('resolve_qr', { p_slug: slug });
  if (error) throw error;
  return data === null ? null : qrSchema.parse(data);
}
/** Reads a visible store by its owned session's UUID through the public RPC boundary. */
export async function readStoreById(id: string) {
  const client = createClient(await cookies());
  const { data, error } = await client.rpc('store_page', { p_store: id });
  if (error) throw error;
  return data === null ? null : storePageSchema.parse(data);
}
