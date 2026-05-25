/** Notifications preferences page under `/settings`. */

import { Bell, Mail, Radio } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Toggle } from '@/app/components/ui/Toggle';

const OPTIONS = [
  {
    name: 'showUpdates',
    icon: Mail,
    title: 'Show updates',
    body: 'Email me when generated shows, exports, or imports finish processing.',
  },
  {
    name: 'supplierAvailability',
    icon: Radio,
    title: 'Supplier availability',
    body: 'Notify me when recommended fireworks become available from suppliers.',
  },
  {
    name: 'productAnnouncements',
    icon: Bell,
    title: 'Product announcements',
    body: 'Send occasional updates about new catalogue and viewer capabilities.',
  },
];

export default function NotificationSettingsPage() {
  return (
    <Card elevation="low" radius="md" className="p-6">
      <h2 className="text-on-surface text-2xl font-bold">Notifications</h2>
      <div className="mt-6 space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Toggle
              key={option.name}
              name={option.name}
              defaultChecked
              icon={<Icon size={18} strokeWidth={1.85} />}
              label={option.title}
              description={option.body}
            />
          );
        })}
      </div>
    </Card>
  );
}
