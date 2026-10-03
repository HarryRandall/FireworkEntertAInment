/** Saved shows retain their immutable cue versions separately from editable planning history. */
import Link from 'next/link';
import { readAccount } from '@/lib/shopper/lists/readers';
import { EmptyState } from '@/ui/kit/feedback';
/** Lists owned shows created when saving a plan and links to their saved playback. */
export default async function Page() {
  const account = await readAccount();
  return (
    <div className="grid min-w-0 gap-6">
      <h1 className="text-2xl font-semibold">Saved shows</h1>
      {account.shows.length > 0 ? (
        <div data-section="saved-shows" className="grid gap-4 md:grid-cols-2">
          {account.shows.map((show) => (
            <Link
              key={show.id}
              href={`/account/shows/${show.id}`}
              className="bg-card grid gap-3 rounded-lg border p-4 hover:border-current"
            >
              <h2 className="text-lg font-semibold">{show.name}</h2>
              <span className="underline">Watch saved show</span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No saved shows yet">
          Save a planned show to a list to keep its cue and music snapshot here.
        </EmptyState>
      )}
    </div>
  );
}
