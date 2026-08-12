/** Layout wrapping the new-show wizard route (`/shows/new`). */

// The final Generate action may start cue generation in `after()`. Music upload
// only submits a durable Modal call here and is not bound to this duration.
export const maxDuration = 300;

export default function NewShowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
