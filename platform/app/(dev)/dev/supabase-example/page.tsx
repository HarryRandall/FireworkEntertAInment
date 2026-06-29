/** Developer scratch page demonstrating Supabase client usage. */

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

// Uses cookies() (a request-scoped dynamic API), so render on demand.
export const dynamic = 'force-dynamic';

// Tiny dev smoke test: confirms the typed Supabase client can fetch from a
// real table (`shows`) that's gated by RLS. Anonymous viewers will see an
// empty list — that's expected and proves RLS is working.
export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: shows, error } = await supabase
    .from('shows')
    .select('id, slug, title, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10);

  return (
    <div className="space-y-2 p-6">
      <h2 className="font-semibold">Supabase smoke test — your shows</h2>
      {error ? <p className="text-sm text-red-500">{error.message}</p> : null}
      <ul className="list-disc pl-6 text-sm">
        {(shows ?? []).map((show) => (
          <li key={show.id}>
            <code>{show.slug}</code> — {show.title}
          </li>
        ))}
      </ul>
      {shows && shows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No shows visible (sign in or create one to see your data here).
        </p>
      ) : null}
    </div>
  );
}
