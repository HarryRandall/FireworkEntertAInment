'use client';

import { useEffect, useMemo, useState } from 'react';
import { Maximize2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { EmptyState, InlineAlert } from '@/components/design-system/Feedback';
import type { AdminEditorVersion } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import { cn } from '@/lib/utils';

const CHANGE_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  patternKey: 'Pattern',
  sortOrder: 'Sort order',
  fireworkEffectId: 'Base effect',
  caliber: 'Calibre',
  durationSeconds: 'Duration',
  heightMeters: 'Height',
  primaryColor: 'Primary colour',
  secondaryColor: 'Secondary colour',
  colorPalette: 'Palette',
  styleDefaultIds: 'Style defaults',
  modelJson: 'Model JSON',
  renderOverridesJson: 'Renderer overrides',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function isSameCalendarDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatDate(value: string, now: Date | null): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (now) {
    const elapsed = now.getTime() - date.getTime();
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (elapsed > -45_000 && elapsed < 45_000) return 'Just now';
    if (elapsed > 0 && elapsed < hour)
      return `${Math.max(1, Math.round(elapsed / minute))} min ago`;
    if (elapsed > 0 && elapsed < day) return `${Math.round(elapsed / hour)} hr ago`;

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameCalendarDay(date, yesterday)) return `Yesterday ${formatClock(date)}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function fieldLabel(field: string): string {
  return (
    CHANGE_LABELS[field] ??
    field
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (match) => match.toUpperCase())
  );
}

function authorInitials(label: string): string {
  const name = label.includes('@') ? label.split('@')[0] : label;
  const parts = name.match(/[a-zA-Z0-9]+/g) ?? [];
  const first = parts[0]?.[0];
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
  return `${first ?? 'A'}${second ?? ''}`.toUpperCase();
}

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  }
  if (typeof value === 'string') return value.length > 34 ? `${value.slice(0, 31)}...` : value;
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (isRecord(value)) return 'updated';
  return 'changed';
}

function versionDetail(version: AdminEditorVersion): string {
  const changes = isRecord(version.changesJson) ? Object.entries(version.changesJson) : [];
  const visibleChanges = changes.filter(([, change]) => isRecord(change) && 'after' in change);
  if (visibleChanges.length === 0) return version.summary;

  const [field, change] = visibleChanges[0] as [string, Record<string, unknown>];
  const before = formatChangeValue(change.before);
  const after = formatChangeValue(change.after);
  const suffix = visibleChanges.length > 1 ? ` +${visibleChanges.length - 1} more` : '';
  if (before === after || (before === 'updated' && after === 'updated')) {
    return `${fieldLabel(field)} updated${suffix}`;
  }
  return `${fieldLabel(field)} ${before} -> ${after}${suffix}`;
}

export function EditorHistoryPanel({
  versions,
  pendingVersionIds,
  warning,
  restoringVersionId,
  mutationPending = false,
  onRestore,
}: {
  versions: AdminEditorVersion[];
  pendingVersionIds?: ReadonlySet<string>;
  warning?: string | null;
  restoringVersionId: string | null;
  mutationPending?: boolean;
  onRestore: (version: AdminEditorVersion) => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-5">
      {warning ? (
        <InlineAlert tone="warning" title="Version history needs attention">
          {warning}
        </InlineAlert>
      ) : null}
      {versions.length === 0 ? (
        <EmptyState title="No saved versions yet" className="p-6">
          Saves and restores will appear here after the first saved change.
        </EmptyState>
      ) : null}
      <ol className="space-y-0">
        {versions.map((version, index) => {
          const initials = authorInitials(version.createdByLabel);
          const showTimelineMarker = versions.length > 1;
          const isPending = pendingVersionIds?.has(version.id) ?? false;
          return (
            <li
              key={version.id}
              className={cn(
                'grid gap-3 pb-7 last:pb-0',
                showTimelineMarker
                  ? 'grid-cols-[1.5rem_2.25rem_minmax(0,1fr)]'
                  : 'grid-cols-[2.25rem_minmax(0,1fr)]',
              )}
            >
              {showTimelineMarker ? (
                <div className="relative flex justify-center">
                  {index < versions.length - 1 ? (
                    <span className="absolute top-6 bottom-[-1.75rem] w-px bg-[color:var(--color-border-subtle)]" />
                  ) : null}
                  <span
                    className="mt-2 h-3 w-3 rounded-full border-2 border-[color:var(--color-border-strong)] bg-[color:var(--color-bg-default)]"
                    aria-hidden="true"
                  />
                </div>
              ) : null}

              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] text-xs font-semibold text-[color:var(--color-content-emphasis)]"
                aria-hidden="true"
              >
                {initials}
              </div>

              <div className="min-w-0 rounded-lg pt-1">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                    {version.createdByLabel}
                  </p>
                  <time
                    dateTime={version.createdAt}
                    className="shrink-0 text-xs text-[color:var(--color-content-muted)]"
                  >
                    {formatDate(version.createdAt, now)}
                  </time>
                </div>

                <p className="mt-1 text-sm leading-6 text-[color:var(--color-content-subtle)]">
                  {isPending ? 'Recording version history...' : versionDetail(version)}
                </p>

                <div className="mt-2 flex items-center gap-1.5">
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-hl-contrast h-7 rounded-md bg-[color:var(--hl)] px-2.5 text-xs font-semibold shadow-none hover:bg-[color:var(--hl)]/85"
                    loading={restoringVersionId === version.id}
                    disabled={isPending || mutationPending}
                    onClick={() => onRestore(version)}
                  >
                    <RotateCcw size={13} />
                    {isPending ? 'Recording...' : 'Revert to here'}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function JsonCodeBlock({
  formattedJson,
  className,
}: {
  formattedJson: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        'min-h-0 flex-1 overflow-auto rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] p-4 font-mono text-[11px] leading-6 text-[color:var(--color-content-emphasis)] tabular-nums',
        className,
      )}
    >
      <code>{formattedJson}</code>
    </pre>
  );
}

export function JsonReadOnlyPanel({ value, label }: { value: Json; label?: string }) {
  const [fullScreen, setFullScreen] = useState(false);
  const formattedJson = useMemo(() => JSON.stringify(value, null, 2), [value]);

  useEffect(() => {
    if (!fullScreen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFullScreen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullScreen]);

  return (
    <div className="flex min-h-[420px] flex-1 flex-col gap-3">
      {label ? (
        <p className="text-sm leading-relaxed text-[color:var(--color-content-subtle)]">{label}</p>
      ) : null}
      <div className="relative flex min-h-0 flex-1">
        <JsonCodeBlock formattedJson={formattedJson} className="pr-14" />
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-3 right-3 h-9 w-9 shadow-sm"
          aria-label="Expand JSON"
          title="Expand JSON"
          onClick={() => setFullScreen(true)}
        >
          <Maximize2 size={15} />
        </Button>
      </div>
      {fullScreen ? (
        <div
          className="fixed inset-0 z-[80] bg-[color:var(--color-bg-muted)]/95 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded JSON"
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                  JSON
                </p>
                {label ? (
                  <p className="truncate text-xs text-[color:var(--color-content-subtle)]">
                    {label}
                  </p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close expanded JSON"
                title="Close"
                onClick={() => setFullScreen(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <JsonCodeBlock
              formattedJson={formattedJson}
              className="rounded-none border-0 bg-[color:var(--color-bg-default)] p-5"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
