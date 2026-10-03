/** Prototype-style icon rail with labelled section links and shared utilities. */
import Link from 'next/link';
import { Bell, Search, CircleHelp, UserRound } from 'lucide-react';
import type { AreaConfig, NavSection } from './config/types';

/** Presents section navigation and exposes utility panels through labelled buttons. */
export function Rail({
  config,
  sections,
  active,
  onPanel,
}: {
  config: AreaConfig;
  sections: readonly NavSection[];
  active: string | undefined;
  onPanel: (panel: 'command' | 'notifications' | 'shortcuts' | 'profile') => void;
}) {
  return (
    <nav className="sc-shell-rail" aria-label="Workspace sections">
      <Link className="sc-shell-logo" href={config.href} aria-label={`${config.label} home`}>
        {config.initials}
      </Link>
      {sections.map((section) => (
        <Link
          key={section.label}
          href={section.items[0].href}
          aria-label={section.label}
          aria-current={section.label === active ? 'page' : undefined}
        >
          <section.icon aria-hidden="true" />
          <span className="sc-shell-tip">{section.label}</span>
        </Link>
      ))}
      <div className="sc-shell-utilities">
        <button
          aria-label="Notifications"
          type="button"
          onClick={() => {
            onPanel('notifications');
          }}
        >
          <Bell aria-hidden="true" />
        </button>
        <button
          aria-label="Search workspace"
          type="button"
          onClick={() => {
            onPanel('command');
          }}
        >
          <Search aria-hidden="true" />
        </button>
        <button
          aria-label="Keyboard shortcuts"
          type="button"
          onClick={() => {
            onPanel('shortcuts');
          }}
        >
          <CircleHelp aria-hidden="true" />
        </button>
        <button
          aria-label="Profile menu"
          type="button"
          onClick={() => {
            onPanel('profile');
          }}
        >
          <UserRound aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
