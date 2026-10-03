/** Read-only detail regions present current status, immutable versions and real dependencies. */
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { CatalogueUsage, CatalogueVersion } from '@/lib/catalogue/types';
import { Badge, EmptyState } from '@/ui/kit/feedback';
import { CataloguePoster } from './catalogue-poster';

/** Groups a detail region for accessible navigation and per-section visual captures. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="border-border bg-card grid min-w-0 gap-4 rounded-xl border p-4"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
/** Shows every saved version newest first, with its status and recorded change note. */
export function VersionHistory({ versions }: { versions: CatalogueVersion[] }) {
  return (
    <DetailSection title="Versions">
      {versions.length > 0 ? (
        <ol className="grid gap-4">
          {versions.map((version) => (
            <li key={version.id} className="border-border grid gap-2 border-b pb-4 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <b>Version {version.number}</b>
                <Badge>{version.status.replaceAll('_', ' ')}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Saved {new Date(version.created).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                {version.published !== null
                  ? ` · Published ${new Date(version.published).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`
                  : ''}
              </p>
              <p className="text-sm">{version.note ?? 'No change note recorded.'}</p>
              <div className="max-w-xs">
                <CataloguePoster preview={version.preview} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="No versions">
          Selection packs contain products rather than composition versions.
        </EmptyState>
      )}
    </DetailSection>
  );
}
/** Lists dependency names and catalogue links without fabricating unavailable show routes. */
export function UsageList({ rows }: { rows: CatalogueUsage[] }) {
  return rows.length > 0 ? (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.id} className="grid gap-1 text-sm">
          {row.href !== undefined ? (
            <Link href={row.href} className="font-medium underline">
              {row.name}
            </Link>
          ) : (
            <b>{row.name}</b>
          )}
          <span className="text-muted-foreground">{row.detail}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground text-sm">No current uses.</p>
  );
}
