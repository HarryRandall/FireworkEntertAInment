/** Honest loading boundary while Studio reads the caller's stored design. */
/** Announces pending document loading without claiming a saved editor session. */
export default function Loading() {
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Studio</h1>
      <p role="status">Loading firework design...</p>
    </main>
  );
}
