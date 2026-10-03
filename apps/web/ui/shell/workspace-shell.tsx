/** One workspace composition for route areas, with an optional editor frame. */
'use client';
import { useCallback, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { NotificationItem } from '@/ui/kit/notifications';
import type { OrganisationOption } from './switchers';
import { areaConfigs } from './config';
import type { WorkspaceArea, ShellVisibility, ShellIdentity } from './config/types';
import { shellNavigation, identityVisibility } from './navigation';
import { Rail } from './rail';
import { Sidebar } from './sidebar';
import { ShellHeader } from './shell-header';
import { MobileNavigation } from './mobile-navigation';
import { ShellPanels, type ShellPanel } from './panels';
import { useShellShortcuts } from './use-shell-shortcuts';
import { useShellReady } from './use-shell-ready';

/** Save and overflow actions supplied by an editor, with no implicit persistence. */
export interface EditorFrameOptions {
  title: string;
  breadcrumb?: { label: string; href: string };
  status?: ReactNode;
  centre?: ReactNode;
  controls?: ReactNode;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  actions: readonly { label: string; onSelect: () => void; disabled?: boolean }[];
}
/** Config-driven route chrome; visibility controls presentation and never authorisation. */
export function WorkspaceShell({
  area,
  children,
  visibility: previewVisibility,
  identity,
  organisations = [],
  notifications = [],
  editorFrame,
  pathname: previewPathname,
}: {
  area: WorkspaceArea;
  children: ReactNode;
  visibility?: ShellVisibility;
  identity?: ShellIdentity;
  organisations?: readonly OrganisationOption[];
  notifications?: readonly NotificationItem[];
  editorFrame?: EditorFrameOptions;
  pathname?: string;
}) {
  const routePathname = usePathname();
  const ready = useShellReady();
  const config = areaConfigs[area];
  const visibility = identityVisibility(identity, previewVisibility);
  const pathname = previewPathname ?? routePathname;
  const { sections, section, title } = shellNavigation(config, pathname, visibility);
  const [panel, setPanel] = useState<ShellPanel | null>(null);
  const openPanel = useCallback((next: ShellPanel) => {
    setPanel(next);
  }, []);
  const closePanel = useCallback(() => {
    setPanel(null);
  }, []);
  useShellShortcuts(openPanel);
  return (
    <div
      className={`sc-shell ${editorFrame ? 'sc-shell-editor' : ''}`}
      // Links work before hydration; this only tells tests when client handlers are attached.
      data-hydrated={String(ready)}
    >
      <a className="sc-shell-skip" href="#workspace-main">
        Skip to content
      </a>
      <Rail config={config} sections={sections} active={section?.label} onPanel={openPanel} />
      {editorFrame === undefined && (
        <aside className="sc-shell-sidebar" aria-label="Section navigation">
          <Sidebar
            config={config}
            section={section}
            pathname={pathname}
            visibility={visibility}
            organisations={organisations}
          />
        </aside>
      )}
      <div className="sc-shell-column">
        <ShellHeader
          config={config}
          title={editorFrame?.title ?? title}
          editorFrame={editorFrame}
          openNavigation={() => {
            openPanel('navigation');
          }}
        />
        <main
          id="workspace-main"
          tabIndex={-1}
          className={editorFrame ? 'sc-shell-editor-body' : 'sc-shell-main'}
        >
          {children}
        </main>
      </div>
      <ShellPanels
        panel={panel}
        close={closePanel}
        config={config}
        sections={sections}
        notifications={notifications}
        identity={identity}
      />
      <MobileNavigation
        config={config}
        section={section}
        pathname={pathname}
        visibility={visibility}
        organisations={organisations}
        panel={panel}
        openPanel={openPanel}
        closePanel={closePanel}
      />
    </div>
  );
}
