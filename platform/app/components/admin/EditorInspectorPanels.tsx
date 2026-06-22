'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Maximize2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { EmptyState } from '@/app/components/ui/Feedback';
import type { AdminEditorVersion } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import { cn } from '@/lib/utils';

const CHANGE_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  family: 'Family',
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
  selectedVersionId,
  restoringVersionId,
  onPreview,
  onClearPreview,
  onRestore,
}: {
  versions: AdminEditorVersion[];
  selectedVersionId: string | null;
  restoringVersionId: string | null;
  onPreview: (version: AdminEditorVersion) => void;
  onClearPreview: () => void;
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
      {selectedVersionId ? (
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClearPreview}>
          Return to live version
        </Button>
      ) : null}
      {versions.length === 0 ? (
        <EmptyState title="No saved versions yet" className="p-6">
          Saves and restores will appear here after the first saved change.
        </EmptyState>
      ) : null}
      <ol className="space-y-0">
        {versions.map((version, index) => {
          const selected = selectedVersionId === version.id;
          const initials = authorInitials(version.createdByLabel);
          return (
            <li
              key={version.id}
              className="grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)] gap-3 pb-7 last:pb-0"
            >
              <div className="relative flex justify-center">
                {index < versions.length - 1 ? (
                  <span className="absolute top-6 bottom-[-1.75rem] w-px bg-[color:var(--color-border-subtle)]" />
                ) : null}
                <span
                  className={cn(
                    'mt-2 h-3 w-3 rounded-full border-2 bg-[color:var(--color-bg-default)]',
                    selected
                      ? 'border-[color:var(--hl)]'
                      : 'border-[color:var(--color-border-strong)]',
                  )}
                  aria-hidden="true"
                />
              </div>

              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  selected
                    ? 'border-[color:var(--hl)] bg-[color:var(--hl-soft)] text-[color:var(--hl)]'
                    : 'border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] text-[color:var(--color-content-emphasis)]',
                )}
                aria-hidden="true"
              >
                {initials}
              </div>

              <div
                className={cn(
                  'min-w-0 rounded-lg',
                  selected ? 'bg-[color:var(--hl-soft)] p-3' : 'pt-1',
                )}
              >
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
                  {versionDetail(version)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[color:var(--color-bg-subtle)] px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-[color:var(--color-content-muted)] uppercase">
                    {version.action === 'restore' ? 'Restored' : 'Saved'}
                  </span>
                  {selected ? (
                    <span className="rounded-full border border-[color:var(--hl)] px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-[color:var(--hl)] uppercase">
                      Previewing
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full px-2.5"
                    onClick={() => onPreview(version)}
                  >
                    <Eye size={14} />
                    Preview
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full px-2.5"
                    loading={restoringVersionId === version.id}
                    onClick={() => onRestore(version)}
                  >
                    <RotateCcw size={14} />
                    Revert to here
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

export function JsonReadOnlyPanel({ value, label }: { value: Json; label: string }) {
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
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-[color:var(--color-content-subtle)]">{label}</p>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => setFullScreen(true)}
        >
          <Maximize2 size={14} />
          Fullscreen
        </Button>
      </div>
      <JsonCodeBlock formattedJson={formattedJson} />
      {fullScreen ? (
        <div
          className="fixed inset-0 z-[80] bg-[color:var(--color-bg-muted)]/95 p-3 backdrop-blur-sm sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Fullscreen JSON"
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border-subtle)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                  JSON
                </p>
                <p className="truncate text-xs text-[color:var(--color-content-subtle)]">{label}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close fullscreen JSON"
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
