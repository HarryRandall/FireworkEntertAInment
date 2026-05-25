'use client';

/** Client form for editing the signed-in user's display name and other profile fields. */

import { useEffect, useState, useTransition } from 'react';
import { useTheme } from 'next-themes';
import { Check, Laptop, LockKeyhole, Mail, Moon, Phone, Sun, User } from 'lucide-react';
import { updateProfileAction } from '@/app/actions/platform-admin';
import { Field, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { Input } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
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
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      setSelectedTheme(theme);
    }
  }, [theme]);

  const persist = (
    patch: { fullName?: string; phone?: string; themePreference?: ThemePreference },
    successMessage: string,
  ) => {
    startTransition(async () => {
      const result = await updateProfileAction(patch);
      if (result.ok) {
        toast.success(successMessage);
      } else {
        toast.error(result.error);
      }
    });
  };

  const commitFullName = () => {
    const next = fullName.trim();
    if (next === savedFullName.trim()) return;
    setSavedFullName(next);
    persist({ fullName: next }, 'Name updated');
  };

  const commitPhone = () => {
    const next = phone.trim();
    if (next === savedPhone.trim()) return;
    setSavedPhone(next);
    persist({ phone: next }, 'Phone updated');
  };

  const chooseTheme = (value: ThemePreference) => {
    if (value === selectedTheme) return;
    setSelectedTheme(value);
    setTheme(value);
    persist({ themePreference: value }, `Theme set to ${value}`);
  };

  return (
    <div className="border-outline-variant/45 bg-surface-container-low space-y-6 rounded-xl border p-5 shadow-[var(--shadow-card)] sm:p-6">
      <Field>
        <FieldLabel htmlFor="fullName">Full name</FieldLabel>
        <Input
          id="fullName"
          name="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={commitFullName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          iconLeft={<User size={17} />}
          placeholder="Your full name"
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="phone">Phone</FieldLabel>
        <Input
          id="phone"
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={commitPhone}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          iconLeft={<Phone size={17} />}
          placeholder="+61 ..."
        />
      </Field>

      <Field>
        <FieldLabel>Email</FieldLabel>
        <div className="border-outline/55 bg-surface text-on-surface-variant flex h-11 items-center gap-3 rounded-xl border px-4 text-sm">
          <Mail size={17} className="text-on-surface-variant" />
          <span className="truncate">{email || 'No email'}</span>
          <LockKeyhole size={14} className="text-on-surface-variant ml-auto" />
        </div>
        <FieldHint className="text-xs">Email changes go through the security tab.</FieldHint>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-on-surface-variant text-[11px] font-bold tracking-[0.18em] uppercase">
          Interface theme
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = mounted ? selectedTheme === option.value : initialTheme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseTheme(option.value)}
                className={cn(
                  'focus-glow-action flex min-h-24 flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:outline-none',
                  active
                    ? 'border-primary/50 bg-surface-container-high text-on-surface shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_18%,transparent),0_18px_48px_-34px_color-mix(in_srgb,var(--color-primary)_68%,transparent)]'
                    : 'border-outline-variant/55 bg-surface text-on-surface-variant hover:border-outline hover:bg-surface-container-low',
                )}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <Icon size={18} className={active ? 'text-on-surface' : ''} />
                  {active ? <Check size={16} className="text-primary" /> : null}
                </span>
                <span>
                  <span className="text-on-surface block text-sm font-bold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
