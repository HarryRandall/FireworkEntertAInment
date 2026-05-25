// Lift the serverless function budget for this route so the background music
// analysis started by startMusicAnalysisAction's `after()` callback has time to
// finish on Vercel. Requires Fluid Compute / Pro plan in production; harmless
// locally.
export const maxDuration = 300;

export default function NewShowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
