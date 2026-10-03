/** Workspace compositions: settings, metrics, list actions and inbox states. */
'use client';
import { useState } from 'react';
import { Store, MoreHorizontal } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { AutoField } from '@/ui/kit/field';
import { AddRow, ListRows, SettingsSection } from '@/ui/kit/list-settings';
import { StatCard } from '@/ui/kit/stat-card';
import { NotificationsInbox } from '@/ui/kit/notifications';
import { KeyboardShortcuts } from '@/ui/kit/shortcuts';
import { Switch } from '@/ui/kit/segmented-control';
import { Badge } from '@/ui/kit/feedback';
import { Example, Group } from './example';
import fixtures from './gallery-fixtures.json';

// Synthetic count trend for the compact metric examples.
const trend = fixtures.trend;
const notices = [
  {
    id: 'scans',
    title: 'Window poster scanned 14 times',
    description: 'Leeds',
    when: '2m ago',
    unread: true,
  },
  {
    id: 'stock',
    title: 'Violet Peony is low on stock',
    description: '3 left',
    when: '1h ago',
    unread: false,
  },
];
/** Reviews split settings, repeaters, metric sparklines and notification read state. */
export function WorkspaceExamples() {
  const [enabled, setEnabled] = useState(true);
  const [inbox, setInbox] = useState(notices);
  return (
    <Group id="workspace" title="Workspace">
      <Example
        id="settings"
        title="Settings sections"
        source="shadcn field composition"
        description="Explanation left, controls right, stacked on phones."
      >
        <SettingsSection
          title="Business details"
          description="Shown on labels and your shopper page."
        >
          <AutoField label="Business name">
            {(id) => <Input id={id} defaultValue="Hartley Fireworks" />}
          </AutoField>
        </SettingsSection>
        <SettingsSection
          title="Notifications"
          description="Keep track of stock and shopper activity."
        >
          <div className="flex items-center justify-between text-sm">
            Email notifications
            <Switch label="Email notifications" checked={enabled} onChange={setEnabled} />
          </div>
        </SettingsSection>
      </Example>
      <Example
        id="stats"
        title="Stat cards"
        source="Nivo line + shadcn card composition"
        description="Formatted value, semantic change and a decorative trend."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard title="QR scans" value="12.4k" change="+18%" series={trend} />
          <StatCard title="Show plays" value="8,920" change="+11%" series={trend} />
          <StatCard
            title="List adds"
            value="1,406"
            change="-4%"
            tone="danger"
            series={[...trend].reverse()}
          />
        </div>
      </Example>
      <ListExamples />
      <Example
        id="notifications"
        title="Notifications inbox"
        source="shadcn card composition"
        description="Unread, read and empty states with caller-owned state."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <NotificationsInbox
            items={inbox}
            onRead={(id) => {
              setInbox(inbox.map((item) => (item.id === id ? { ...item, unread: false } : item)));
            }}
          />
          <NotificationsInbox
            items={[]}
            onRead={() => {
              /* Empty state has no read actions. */
            }}
          />
        </div>
      </Example>
      <Example
        id="shortcuts"
        title="Keyboard shortcuts"
        source="shadcn Kbd"
        description="Reference panel for the kit's actual keyboard interactions."
      >
        <KeyboardShortcuts
          items={[
            { label: 'Next choice or tab', keys: ['→'] },
            { label: 'Previous choice or tab', keys: ['←'] },
            { label: 'Toggle checkbox', keys: ['Space'] },
            { label: 'Close dialog or menu', keys: ['Esc'] },
            { label: 'Commit a tag', keys: ['Enter'] },
          ]}
        />
      </Example>
    </Group>
  );
}

function ListExamples() {
  const [locations, setLocations] = useState(['Leeds', 'York']);
  return (
    <Example
      id="lists"
      title="List rows"
      source="shadcn card composition"
      description="Repeatable rows with an icon, two lines and contextual actions."
    >
      <ListRows
        items={locations.map((location) => ({
          id: location,
          title: `Hartley Fireworks, ${location}`,
          description:
            location === 'Leeds'
              ? 'Kirkstall Road · All-year licence'
              : 'Clifton Moor · Sale periods only',
          icon: <Store className="size-4" />,
          actions: (
            <>
              <Badge tone="success">Live</Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${location}`}
                onClick={() => {
                  setLocations(locations.filter((name) => name !== location));
                }}
              >
                <MoreHorizontal />
              </Button>
            </>
          ),
        }))}
      />
      <AddRow
        onClick={() => {
          setLocations([...new Set([...locations, 'New store'])]);
        }}
      >
        Add another store
      </AddRow>
    </Example>
  );
}
