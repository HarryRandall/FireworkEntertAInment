/** Poster maintenance communicates its caller-RLS read while loading. */
/** Shows a pending queue instead of an empty success state. */
export default function Loading() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Posters</h1>
      <p role="status">Loading poster queue...</p>
    </section>
  );
}
