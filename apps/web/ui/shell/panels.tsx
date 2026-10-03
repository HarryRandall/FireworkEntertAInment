/** Workspace command search and local inbox, help and profile panels. */
'use client';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from '@/ui/primitives/command';
import { NotificationsInbox, type NotificationItem } from '@/ui/kit/notifications';
import { KeyboardShortcuts } from '@/ui/kit/shortcuts';
import { ShellDialog } from './shell-dialog';
import type { AreaConfig, NavSection } from './config/types';

/** Panel names owned by the shared workspace chrome. */
export type ShellPanel = 'command' | 'notifications' | 'shortcuts' | 'profile' | 'navigation';
/** Opens a filtered, keyboard-selectable command menu confined to this area. */
function CommandMenu({
  config,
  sections,
  close,
}: {
  config: AreaConfig;
  sections: readonly NavSection[];
  close: () => void;
}) {
  const router = useRouter();
  const items = sections.flatMap((section) => [...section.items, ...section.shortcuts]);
  return (
    <Command label="Search destinations">
      <CommandInput placeholder={`Search ${config.label.toLowerCase()} destinations...`} />
      <CommandList>
        <CommandEmpty>No matching destinations.</CommandEmpty>
        {items.map((item) => (
          <CommandItem
            key={item.label + item.href}
            value={item.label + ' ' + item.href}
            onSelect={() => {
              close();
              router.push(item.href);
            }}
          >
            {item.label}
          </CommandItem>
        ))}
      </CommandList>
    </Command>
  );
}
/** Offers presentation preferences without pretending to have a signed-in identity. */
function ProfilePanel() {
  const { setTheme } = useTheme();
  return (
    <div className="grid gap-3">
      <p className="text-sm">Demo profile. Account actions are unavailable in this preview.</p>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Theme</legend>
        <div className="flex gap-2">
          {['light', 'dark', 'system'].map((theme) => (
            <button
              key={theme}
              type="button"
              className="border-border rounded border px-3 py-2 text-sm capitalize"
              onClick={() => {
                setTheme(theme);
              }}
            >
              {theme}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
/** Supplies controlled panels and keeps notification read state in the caller's preview. */
export function ShellPanels({
  panel,
  close,
  config,
  sections,
  notifications,
}: {
  panel: ShellPanel | null;
  close: () => void;
  config: AreaConfig;
  sections: readonly NavSection[];
  notifications: readonly NotificationItem[];
}) {
  const [readIds, setReadIds] = useState<readonly string[]>([]);
  const labels = {
    command: 'Search workspace',
    notifications: 'Notifications inbox',
    shortcuts: 'Keyboard shortcuts',
    profile: 'Profile menu',
    navigation: 'Navigation',
  };
  if (panel === null || panel === 'navigation') return null;
  return (
    <ShellDialog
      title={labels[panel]}
      description={
        panel === 'command'
          ? 'Find a destination in this area. Use arrow keys and Enter.'
          : 'Local workspace preview.'
      }
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {panel === 'command' && <CommandMenu config={config} sections={sections} close={close} />}
      {panel === 'notifications' && (
        <NotificationsInbox
          items={notifications.map((item) => ({
            ...item,
            unread: item.unread && !readIds.includes(item.id),
          }))}
          onRead={(id) => {
            setReadIds((ids) => [...ids, id]);
          }}
        />
      )}
      {panel === 'shortcuts' && (
        <KeyboardShortcuts
          items={[
            { label: 'Search workspace', keys: ['⌘ / Ctrl', 'K'] },
            { label: 'Keyboard shortcuts', keys: ['?'] },
            { label: 'Close panel', keys: ['Esc'] },
          ]}
        />
      )}
      {panel === 'profile' && <ProfilePanel />}
    </ShellDialog>
  );
}
