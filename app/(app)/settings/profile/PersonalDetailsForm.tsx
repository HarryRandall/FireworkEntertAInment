'use client';

/** Client form for editing the signed-in user's display name and other profile fields. */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import { Check, Laptop, LockKeyhole, Mail, Moon, Phone, Sun, User } from 'lucide-react';
import { updateProfileAction } from '@/app/actions/platform-admin';
import { Field, FieldHint, FieldLabel } from '@/components/design-system/Field';
import { Input } from '@/components/design-system/Input';
import { toast } from '@/components/design-system/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ThemePreference } from '@/lib/admin.types';

type Props = {
  initialFullName: string;
  initialPhone: string;
  email: string;
  initialTheme: ThemePreference;
};

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Moon;
}[] = [
  { value: 'dark', label: 'Dark', description: 'Layered black workspace', icon: Moon },
  { value: 'light', label: 'Light', description: 'Bright production view', icon: Sun },
  { value: 'system', label: 'System', description: 'Match this device', icon: Laptop },
];

export function PersonalDetailsForm({ initialFullName, initialPhone, email, initialTheme }: Props) {
  const { setTheme, theme } = useTheme();
  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone);
  const [savedFullName, setSavedFullName] = useState(initialFullName);
  const [savedPhone, setSavedPhone] = useState(initialPhone);
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(initialTheme);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const selectedThemeRef = useRef<ThemePreference>(initialTheme);
  const savedThemeRef = useRef<ThemePreference>(initialTheme);

  useEffect(() => {
    setMounted(true);
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      setSelectedTheme(theme);
      selectedThemeRef.current = theme;
    }
  }, [theme]);

  const queueProfileUpdate = (patch: {
    fullName?: string;
    phone?: string;
    themePreference?: ThemePreference;
  }) => {
    const result = mutationQueueRef.current
      .then(() => updateProfileAction(patch))
      .catch(() => ({ ok: false as const, error: 'Could not save changes' }));
    mutationQueueRef.current = result.then(() => undefined);
    return result;
  };

  const commitFullName = () => {
    const next = fullName.trim();
    if (next === savedFullName.trim()) return;
    startTransition(async () => {
      const result = await queueProfileUpdate({ fullName: next });
      if (result.ok) {
        const canonical = result.saved.fullName ?? '';
        setSavedFullName(canonical);
        setFullName((current) => (current.trim() === next ? canonical : current));
        toast.success('Name updated');
      } else {
        toast.error(result.error);
      }
    });
  };

  const commitPhone = () => {
    const next = phone.trim();
    if (next === savedPhone.trim()) return;
    startTransition(async () => {
      const result = await queueProfileUpdate({ phone: next });
      if (result.ok) {
        const canonical = result.saved.phone ?? '';
        setSavedPhone(canonical);
        setPhone((current) => (current.trim() === next ? canonical : current));
        toast.success('Phone updated');
      } else {
        toast.error(result.error);
      }
    });
  };

  const chooseTheme = (value: ThemePreference) => {
    if (value === selectedTheme) return;
    setSelectedTheme(value);
    selectedThemeRef.current = value;
    setTheme(value);
    startTransition(async () => {
      const result = await queueProfileUpdate({ themePreference: value });
      if (!result.ok) {
        if (selectedThemeRef.current === value) {
          selectedThemeRef.current = savedThemeRef.current;
          setSelectedTheme(savedThemeRef.current);
          setTheme(savedThemeRef.current);
        }
        toast.error(result.error);
        return;
      }

      const canonical = result.saved.themePreference;
      savedThemeRef.current = canonical;
      if (selectedThemeRef.current === value) {
        selectedThemeRef.current = canonical;
        setSelectedTheme(canonical);
        setTheme(canonical);
        toast.success(`Theme set to ${canonical}`);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Update your name, contact details, and interface theme.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={commitFullName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              iconLeft={<User aria-hidden size={17} />}
              placeholder="Your full name…"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={commitPhone}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              iconLeft={<Phone aria-hidden size={17} />}
              placeholder="+61…"
            />
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel>Email</FieldLabel>
            <div className="border-input bg-background text-muted-foreground flex h-10 items-center gap-3 rounded-md border px-3 text-sm shadow-xs">
              <Mail aria-hidden size={17} />
              <span className="truncate">{email || 'No email'}</span>
              <LockKeyhole aria-hidden size={14} className="ml-auto" />
            </div>
            <FieldHint>Email changes are handled through account security.</FieldHint>
          </Field>
        </div>

        <Separator />

        <fieldset className="space-y-3">
          <legend className="text-foreground text-sm font-medium">Interface theme</legend>
          <div className="grid gap-3 md:grid-cols-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = mounted
                ? selectedTheme === option.value
                : initialTheme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  disabled={isPending}
                  onClick={() => chooseTheme(option.value)}
                  className={cn(
                    'focus-visible:ring-ring flex min-h-28 flex-col items-start gap-3 rounded-xl border p-4 text-left shadow-xs transition-[border-color,background-color,color,box-shadow,opacity] focus:outline-none focus-visible:ring-3 disabled:cursor-wait disabled:opacity-60',
                    active
                      ? 'border-primary bg-primary/10 text-foreground ring-primary/20 ring-1'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg border',
                        active
                          ? 'border-primary/25 bg-background text-primary'
                          : 'border-border bg-muted/40',
                      )}
                    >
                      <Icon aria-hidden size={17} />
                    </span>
                    {active ? <Check aria-hidden size={16} className="text-primary" /> : null}
                  </span>
                  <span>
                    <span className="text-foreground block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="text-muted-foreground mt-1 block text-sm leading-relaxed">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
