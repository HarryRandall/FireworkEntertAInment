/**
 * Request-scoped Supabase client for the shows module.
 *
 * Re-exports the canonical `getServerClient` from `utils/supabase/server-client`
 * so shows queries share one memoised client per request with admin and other
 * server modules, instead of each domain keeping its own `cache()` cell.
 */
import 'server-only';

export { getServerClient } from '@/utils/supabase/server-client';
