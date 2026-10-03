/** Index of standalone developer review routes. */
import Link from 'next/link';

/** Lists review pages which do not require a database session. */
export default function DevPage() {
  return (
    <main className="mx-auto grid max-w-xl gap-4 px-6 py-8">
      <h1 className="text-3xl font-semibold">Developer routes</h1>
      <Link className="text-primary underline underline-offset-4" href="/dev/components">
        Component gallery
      </Link>
      <Link className="text-primary underline underline-offset-4" href="/dev/shell">
        Workspace shell
      </Link>
      <Link className="text-primary underline underline-offset-4" href="/dev/fireworks">
        Firework previews
      </Link>
    </main>
  );
}
