'use client';

/** Local notification preference controls for the settings surface. */

import { useEffect, useState } from 'react';
import {
  Bell,
  Clock3,
  Mail,
  Megaphone,
  PackageCheck,
  Radio,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const STORAGE_KEY = 'showcrafter.notification-preferences.v1';

const DEFAULT_TOGGLES = {
  showUpdates: true,
  supplierAvailability: true,
  importReviews: true,
  productAnnouncements: false,
  weeklyDigest: true,
  browserToasts: true,
};

type ToggleKey = keyof typeof DEFAULT_TOGGLES;

type Preferences = {
  toggles: Record<ToggleKey, boolean>;
  digestCadence: 'instant' | 'daily' | 'weekly';
  quietHours: 'off' | 'evening' | 'overnight';
};

const DEFAULT_PREFERENCES: Preferences = {
  toggles: DEFAULT_TOGGLES,
  digestCadence: 'daily',
  quietHours: 'overnight',
};

const OPTIONS: {
  key: ToggleKey;
  icon: typeof Bell;
  title: string;
  body: string;
}[] = [
  {
    key: 'showUpdates',
    icon: Mail,
    title: 'Show updates',
    body: 'Generated shows, exports, and cue-building milestones.',
  },
  {
    key: 'supplierAvailability',
    icon: Radio,
    title: 'Supplier availability',
    body: 'Recommended fireworks, stock changes, and purchase readiness.',
  },
  {
    key: 'importReviews',
    icon: PackageCheck,
    title: 'Import reviews',
    body: 'Catalogue imports that need approval, edits, or another pass.',
  },
  {
    key: 'productAnnouncements',
    icon: Megaphone,
    title: 'Product announcements',
    body: 'Occasional notes about new viewer, catalogue, and AI features.',
  },
  {
    key: 'weeklyDigest',
    icon: Clock3,
    title: 'Weekly digest',
    body: 'A single summary of workspace activity and upcoming actions.',
  },
  {
    key: 'browserToasts',
    icon: Sparkles,
    title: 'In-app toasts',
    body: 'Small workspace alerts for quick background task feedback.',
  },
];

function safeParsePreferences(value: string | null): Preferences | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Preferences>;
    return {
      toggles: {
        ...DEFAULT_TOGGLES,
        ...(parsed.toggles ?? {}),
      },
      digestCadence:
        parsed.digestCadence === 'instant' ||
        parsed.digestCadence === 'daily' ||
        parsed.digestCadence === 'weekly'
          ? parsed.digestCadence
          : DEFAULT_PREFERENCES.digestCadence,
      quietHours:
        parsed.quietHours === 'off' ||
        parsed.quietHours === 'evening' ||
        parsed.quietHours === 'overnight'
          ? parsed.quietHours
          : DEFAULT_PREFERENCES.quietHours,
    };
  } catch {
    return null;
  }
}

function PreferenceSwitch({
  option,
  checked,
  onCheckedChange,
}: {
  option: (typeof OPTIONS)[number];
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  const Icon = option.icon;
  const id = `notification-${option.key}`;

  return (
    <label
      htmlFor={id}
      className="group hover:bg-muted/45 grid cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-4 px-6 py-4 transition-colors"
    >
      <span className="border-border bg-background text-muted-foreground group-hover:text-foreground flex size-9 shrink-0 items-center justify-center rounded-lg border shadow-xs">
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-medium">{option.title}</span>
        </span>
        <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
          {option.body}
        </span>
      </span>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={option.title}
      />
    </label>
  );
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPreferences(
      safeParsePreferences(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_PREFERENCES,
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [loaded, preferences]);

  const updateToggle = (key: ToggleKey, value: boolean) => {
    setPreferences((current) => ({
      ...current,
      toggles: {
        ...current.toggles,
        [key]: value,
      },
    }));
  };

  const reset = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose which updates you want to receive.</CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            <RotateCcw />
            Reset
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-border divide-y">
          {OPTIONS.map((option) => (
            <PreferenceSwitch
              key={option.key}
              option={option}
              checked={preferences.toggles[option.key]}
              onCheckedChange={(value) => updateToggle(option.key, value)}
            />
          ))}
        </div>

        <div className="border-border grid gap-4 border-t px-6 py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="digestCadence" className="text-foreground text-sm font-medium">
              Digest cadence
            </label>
            <Select
              value={preferences.digestCadence}
              onValueChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  digestCadence: value as Preferences['digestCadence'],
                }))
              }
            >
              <SelectTrigger id="digestCadence" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="daily">Daily digest</SelectItem>
                  <SelectItem value="weekly">Weekly digest</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="quietHours" className="text-foreground text-sm font-medium">
              Quiet hours
            </label>
            <Select
              value={preferences.quietHours}
              onValueChange={(value) =>
                setPreferences((current) => ({
                  ...current,
                  quietHours: value as Preferences['quietHours'],
                }))
              }
            >
              <SelectTrigger id="quietHours" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="evening">Evening focus</SelectItem>
                  <SelectItem value="overnight">Overnight muted</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
