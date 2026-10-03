/** Review summaries combine budget warnings, exhaustive differences and actual usage. */
import type { Design } from '@showcrafter/fireworks';
import { authoredChecks } from '@/lib/studio/checks';
import { designChanges } from '@/lib/studio/diff';
import type { CatalogueUsage } from '@/lib/catalogue/types';
import { DesignChangeList } from './design-change-list';
import type { useStudioChecks } from './use-studio-checks';
function measurementMessage(peak: ReturnType<typeof useStudioChecks>): string {
  if (peak === null) return 'Measuring live particles...';
  if (peak.kind === 'error') return peak.message;
  return peak.peak.exceeded
    ? 'Publishing blocked: over the particle budget'
    : 'Within the particle budget';
}
/** Presents every stored change without truncating the review, and keeps advisory warnings visible. */
export function ReviewSummary({
  document,
  published,
  title,
  usage,
  peak,
}: {
  document: Design;
  published: Design | null;
  title: string;
  usage: CatalogueUsage[];
  peak: ReturnType<typeof useStudioChecks>;
}) {
  const changes = designChanges(published, document);
  const warnings = authoredChecks(document, title).filter((check) => !check.passed);
  return (
    <>
      <section aria-label="Publish checks" className="grid gap-2">
        <h2 className="font-semibold">Checks</h2>
        <p role="status">{measurementMessage(peak)}</p>
        {warnings.map((warning) => (
          <p key={warning.id} className="text-sm">
            Warning: {warning.message}
          </p>
        ))}
      </section>
      <section aria-label="Publish changes">
        <h2 className="mb-2 font-semibold">{changes.length} changes since publication</h2>
        <DesignChangeList changes={changes} />
      </section>
      <section aria-label="Used by">
        <h2 className="mb-2 font-semibold">Used by</h2>
        {usage.length > 0 ? (
          <ul className="grid gap-2 text-sm">
            {usage.map((item) => (
              <li key={item.id}>
                {item.name} · {item.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No products or saved shows use this firework.
          </p>
        )}
        <p className="mt-2 text-sm">
          Posters and thumbnails are rendered in your browser after publication.
        </p>
      </section>
    </>
  );
}
