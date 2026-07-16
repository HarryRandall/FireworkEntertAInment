'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

function formatDateTime(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat('en-AU', options).format(date);
}

function formatRelative(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.round(months / 12);
  return `${years} yr${years === 1 ? '' : 's'} ago`;
}

export function LocalSecurityEventTime({ value }: { value: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const absolute = formatDateTime(value, hydrated ? undefined : 'UTC');
  const relative = hydrated ? formatRelative(value) : null;

  return (
    <p className="text-muted-foreground mt-0.5 text-sm">
      <time dateTime={value} className="font-mono tabular-nums" suppressHydrationWarning>
        {absolute}
      </time>
      {relative ? <span className="ml-2 text-xs">{relative}</span> : null}
    </p>
  );
}
