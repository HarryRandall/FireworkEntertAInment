/** Saved show playback reads immutable cues and pinned audio through existing owned readers. */
import { notFound } from 'next/navigation';
import { readAccount } from '@/lib/shopper/lists/readers';
import { readShow, readStore } from '@/lib/shopper/readers';
import { showShots } from '@/lib/shopper/playback';
import { Preview } from '@/ui/shopper/preview';
import { Callout } from '@/ui/kit/feedback';
/** Plays a saved owned show at its originating shop, reporting unavailable catalogue products. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await readAccount();
  const saved = account.shows.find((item) => item.id === id);
  if (!saved) notFound();
  const plan = account.plans.find((item) => item.id === saved.session_id);
  const store = plan ? await readStore(plan.store_slug) : null;
  const show = store ? await readShow(store.store.id, id) : null;
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-semibold">{saved.name}</h1>
      {show && store ? (
        <Preview
          title={show.name}
          event={{ store: store.store.id, context: { show_id: show.id } }}
          shots={showShots(show)}
          soundtrackUrl={show.soundtrack?.playback_url ?? undefined}
          soundtrackOffsetMs={show.soundtrack?.offset_ms}
        />
      ) : (
        <Callout title="Preview unavailable">
          Some products or the originating shop are no longer available. Your saved show remains in
          your account.
        </Callout>
      )}
    </div>
  );
}
