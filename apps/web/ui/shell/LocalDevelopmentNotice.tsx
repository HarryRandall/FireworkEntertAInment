import { getLocalIntegrationNotices } from '@/lib/local-integrations';

/** Development-only configuration help; never exposes credential values. */
export function LocalDevelopmentNotice() {
  if (process.env.NODE_ENV !== 'development') return null;
  const notices = getLocalIntegrationNotices(process.env);
  if (!notices.length) return null;

  return (
    <details className="bg-card text-card-foreground border-border fixed right-3 bottom-3 z-50 max-w-[calc(100vw-1.5rem)] rounded-lg border shadow-sm sm:w-96">
      <summary className="focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">
        Local development: optional service setup
      </summary>
      <div className="max-h-[60vh] space-y-3 overflow-auto px-4 pt-1 pb-4 text-sm">
        <p className="text-muted-foreground">
          Catalogue editing and replay work without these services. Configuration alone does not
          confirm a service is running.
        </p>
        {notices.map((notice) => (
          <div key={notice.feature}>
            <p className="font-medium">{notice.feature}</p>
            <p className="text-muted-foreground break-words">{notice.message}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
