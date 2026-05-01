import { Bell, Mail, Radio } from "lucide-react";
import { Card } from "@/app/components/ui/Card";

const OPTIONS = [
  {
    icon: Mail,
    title: "Show updates",
    body: "Email me when generated shows, exports, or imports finish processing.",
  },
  {
    icon: Radio,
    title: "Supplier availability",
    body: "Notify me when recommended fireworks become available from suppliers.",
  },
  {
    icon: Bell,
    title: "Product announcements",
    body: "Send occasional updates about new catalogue and viewer capabilities.",
  },
];

export default function NotificationSettingsPage() {
  return (
    <Card elevation="high" radius="md" className="p-6">
      <h2 className="text-2xl font-bold text-on-surface">Notifications</h2>
      <div className="mt-6 space-y-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <label
              key={option.title}
              className="flex items-start gap-4 rounded-xl bg-surface-container-low p-4"
            >
              <Icon className="mt-1 text-primary" size={18} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-on-surface">
                  {option.title}
                </span>
                <span className="mt-1 block text-sm text-on-surface-variant">
                  {option.body}
                </span>
              </span>
              <input type="checkbox" defaultChecked className="mt-1 accent-primary" />
            </label>
          );
        })}
      </div>
    </Card>
  );
}
