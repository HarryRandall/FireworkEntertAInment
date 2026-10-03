/** Section destinations and shortcuts shared by desktop and mobile navigation. */
import Link from 'next/link';
import type { AreaConfig, NavSection, ShellVisibility } from './config/types';
import { AreaSwitcher, RetailerSwitcher, type OrganisationOption } from './switchers';

/** Lists the current section without turning page tabs into area navigation. */
export function Sidebar({
  config,
  section,
  pathname,
  visibility,
  organisations,
  onNavigate,
}: {
  config: AreaConfig;
  section: NavSection | undefined;
  pathname: string;
  visibility?: ShellVisibility;
  organisations: readonly OrganisationOption[];
  onNavigate?: () => void;
}) {
  return (
    <div className="sc-shell-sidebar-content">
      <AreaSwitcher config={config} visibility={visibility} />
      {config.area === 'retailer' && <RetailerSwitcher organisations={organisations} />}
      {section && (
        <>
          <h2>{section.label}</h2>
          <nav aria-label="Section pages">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {section.shortcuts.length > 0 && (
            <>
              <h3>Shortcuts</h3>
              <nav aria-label="Sidebar shortcuts">
                {section.shortcuts.map((item) => (
                  <Link key={item.label} href={item.href} onClick={onNavigate}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </>
      )}
      <p className="text-muted-foreground mt-auto pt-6 text-xs">Workspace preview</p>
    </div>
  );
}
