/** Honest empty route content for reviewing workspace navigation and local tabs. */
import { Tabs } from '@/ui/kit/overlays';

/** Shows an unpopulated destination with tabs that only change local panels. */
export function WorkspacePlaceholder({ title }: { title: string }) {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Workspace preview</p>
      </div>
      <Tabs
        defaultValue="overview"
        items={[
          {
            value: 'overview',
            label: 'Overview',
            content: (
              <div className="border-border bg-card rounded-xl border p-6">
                <h2 className="font-medium">No content yet</h2>
                <p className="text-muted-foreground mt-2">
                  This destination is a placeholder. No records have been loaded.
                </p>
              </div>
            ),
          },
          { value: 'activity', label: 'Activity', content: <p>No activity has been loaded.</p> },
        ]}
      />
    </div>
  );
}
