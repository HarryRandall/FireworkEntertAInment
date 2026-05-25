/**
 * Request-scoped Supabase client for the shows module.
 *
 * Mirrors the pattern in `lib/admin/supabase.ts` — wrapped in `cache()` so a
 * single request reuses one client across many server-component reads.
 */
import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export const getServerClient = cache(async () => createClient(await cookies()));
