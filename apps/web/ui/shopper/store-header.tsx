/** Public shop identity and safety footer outside the workspace shell. */
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/ui/primitives/button';
import { publicVisualUrl } from '@/lib/shopper/media';
import type { StorePage } from '@/lib/shopper/contracts';
import { storePath } from '@/lib/shopper/paths';

// Visual tuning: the kit size-10 logo tile is 40 CSS pixels square.
const STORE_LOGO_SIZE_PX = 40;

/** Displays the shop's public branding and a persistent route back to its range. */
export function StoreHeader({ store }: { store: StorePage }) {
  const logo = store.branding?.logo_path;
  const initials = store.organisation.name
    .split(' ')
    .map((part) => part[0])
    .join('');
  return (
    <header
      data-section="store-header"
      className="border-border bg-background flex items-center gap-3 border-b px-4 py-3"
    >
      <span
        style={{ borderColor: store.branding?.accent ?? undefined }}
        className="bg-highlight-soft text-highlight-foreground grid size-10 shrink-0 place-items-center rounded-xl border-2 text-xs font-bold"
        aria-hidden="true"
      >
        {logo !== undefined && logo !== null ? (
          <Image
            src={publicVisualUrl('brand', logo)}
            alt=""
            width={STORE_LOGO_SIZE_PX}
            height={STORE_LOGO_SIZE_PX}
            unoptimized
            className="size-full rounded-lg object-contain"
          />
        ) : (
          initials
        )}
      </span>
      <Link
        href={storePath(store.store.slug)}
        className="focus-visible:outline-ring min-w-0 flex-1 rounded focus-visible:outline-2"
      >
        <b className="block text-sm">{store.organisation.name}</b>
        <span className="text-muted-foreground block text-xs">{store.store.name}</span>
      </Link>
      <Button asChild variant="ghost" className="shrink-0">
        <Link href={`${storePath(store.store.slug)}/list`}>My list</Link>
      </Button>
    </header>
  );
}
/** Keeps the illustrative preview disclaimer visible on every public shop page. */
export function StoreFooter({ store }: { store: StorePage }) {
  return (
    <footer
      data-section="footer"
      className="border-border text-muted-foreground flex flex-wrap justify-between gap-3 border-t px-4 py-6 text-sm"
    >
      <p>Previews are illustrations. Real fireworks vary in height and timing.</p>
      <p>{store.branding?.footer ?? 'Read the instructions on each box.'}</p>
      <span>Made with ShowCrafter</span>
    </footer>
  );
}
