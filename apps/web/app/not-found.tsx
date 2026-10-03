import Link from 'next/link';

/** Shows the missing-route state with navigation back to the app. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <p className="text-muted-foreground text-sm font-medium">404</p>
      <h1 className="text-3xl font-semibold">This page does not exist.</h1>
      <Link className="text-primary w-fit underline underline-offset-4" href="/">
        Return to ShowCrafter rebuild
      </Link>
    </main>
  );
}
