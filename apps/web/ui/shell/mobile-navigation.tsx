/** Small-screen access to context and utilities hidden by the compact rail. */
import { Button } from '@/ui/primitives/button';
import { ShellDialog } from './shell-dialog';
import { Sidebar } from './sidebar';
import type { AreaConfig, NavSection, ShellVisibility } from './config/types';
import type { OrganisationOption } from './switchers';
import type { ShellPanel } from './panels';

const utilities = [
  { panel: 'command', label: 'Search workspace' },
  { panel: 'notifications', label: 'Notifications' },
  { panel: 'shortcuts', label: 'Keyboard shortcuts' },
  { panel: 'profile', label: 'Profile menu' },
] as const;
/** Makes every desktop destination and utility available in the mobile dialog. */
export function MobileNavigation({
  config,
  section,
  pathname,
  visibility,
  organisations,
  panel,
  openPanel,
  closePanel,
}: {
  config: AreaConfig;
  section: NavSection | undefined;
  pathname: string;
  visibility?: ShellVisibility;
  organisations: readonly OrganisationOption[];
  panel: ShellPanel | null;
  openPanel: (panel: ShellPanel) => void;
  closePanel: () => void;
}) {
  return (
    <ShellDialog
      title="Navigation"
      description="Choose a workspace, context or destination."
      open={panel === 'navigation'}
      onOpenChange={(open) => {
        if (!open) closePanel();
      }}
    >
      <Sidebar
        config={config}
        section={section}
        pathname={pathname}
        visibility={visibility}
        organisations={organisations}
        onNavigate={closePanel}
      />
      <div className="flex flex-wrap gap-2">
        {utilities.map((item) => (
          <Button
            key={item.panel}
            variant="outline"
            onClick={() => {
              openPanel(item.panel);
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </ShellDialog>
  );
}
