/**
 * Shared request-scoped Supabase client used by every admin server module.
 *
 * Re-exports the canonical `getServerClient` from `lib/supabase/server-client`
 * so admin modules share one memoised client per request with shows and other
 * server modules, instead of each domain keeping its own `cache()` cell.
 */
import 'server-only';

export { getServerClient } from '@/lib/supabase/server-client';
