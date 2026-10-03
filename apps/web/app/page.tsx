import Link from 'next/link';

/** Shows the rebuild application entry point and developer navigation. */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <p className="text-muted-foreground text-sm font-medium">ShowCrafter</p>
      <h1 className="text-4xl font-semibold tracking-tight">ShowCrafter rebuild</h1>
      <p className="text-muted-foreground">
        New developer routes will appear here as the rebuild progresses.
      </p>
      <Link className="text-primary w-fit underline underline-offset-4" href="/dev">
        Developer routes
      </Link>
    </main>
  );
}
