/**
 * Audio drop-zone / attached-track UI for the wizard.
 *
 * Renders one of two states: a dashed drop zone when no file is attached, or
 * a "track ready" panel when one is. Display-only — upload progress and
 * error state are owned by the parent (see `uploadAudioAndStartAnalysis` in
 * the wizard page).
 */
'use client';

import {
  AlertTriangle,
  Check,
  CloudUpload,
  ExternalLink,
  Loader2,
  Music4,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/design-system/Button';
import { cn } from '@/lib/utils';
import type { AudioUploadState } from '../types';
import { formatDuration } from '@/lib/show-domain';
import type { SoundtrackAttribution } from '@/lib/music-library.types';
import { formatBytes } from '../utils';

export function AudioUpload({
  track,
  duration,
  uploadState,
  error,
  inputRef,
  onFile,
  onClear,
}: {
  track: {
    name: string;
    sizeBytes: number | null;
    source?: SoundtrackAttribution;
  } | null;
  duration: number | null;
  uploadState: AudioUploadState;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  if (track) {
    const source = track.source;
    const statusLabel =
      uploadState === 'uploading'
        ? 'Uploading'
        : uploadState === 'error'
          ? 'Needs attention'
          : 'Ready';

    return (
      <div
        className={cn(
          'relative flex min-h-36 flex-col gap-4 overflow-hidden rounded-xl border bg-[color:var(--color-bg-elevated)] p-4 pl-5 shadow-sm sm:flex-row sm:items-center',
          uploadState === 'error'
            ? 'border-[color:var(--color-status-danger)]/40 bg-[color-mix(in_srgb,var(--color-status-danger)_8%,transparent)]'
            : 'border-[color:var(--color-border-default)]',
        )}
        role={uploadState === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        <span
          className={cn(
            'absolute inset-y-3 left-0 w-0.5 rounded-full',
            uploadState === 'error'
              ? 'bg-[color:var(--color-status-danger)]'
              : uploadState === 'uploading'
                ? 'bg-[color:var(--color-content-muted)]'
                : 'bg-[color:var(--color-status-success)]',
          )}
          aria-hidden="true"
        />

        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-subtle)] text-[color:var(--color-content-muted)]">
          <Music4 size={20} strokeWidth={1.75} aria-hidden="true" />
          {source?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
        </span>

        <div className="min-w-0 flex-1 self-stretch sm:self-center">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                uploadState === 'error'
                  ? 'border-[color:var(--color-status-danger)]/30 text-[color:var(--color-status-danger)]'
                  : uploadState === 'uploading'
                    ? 'border-[color:var(--color-border-default)] text-[color:var(--color-content-muted)]'
                    : 'border-[color:var(--color-status-success)]/30 bg-[color-mix(in_srgb,var(--color-status-success)_7%,transparent)] text-[color:var(--color-status-success)]',
              )}
            >
              {uploadState === 'uploading' ? (
                <Loader2
                  size={11}
                  strokeWidth={2}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : uploadState === 'error' ? (
                <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <Check size={11} strokeWidth={2.5} aria-hidden="true" />
              )}
              {statusLabel}
            </span>
          </div>

          {source ? (
            <>
              <h4 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 hover:underline"
                >
                  <span className="line-clamp-2">{source.title}</span>
                  <ExternalLink
                    size={11}
                    aria-hidden="true"
                    className="shrink-0 text-[color:var(--color-content-muted)]"
                  />
                </a>
              </h4>
              <p className="mt-0.5 truncate text-xs text-[color:var(--color-content-subtle)]">
                {source.artist}
              </p>
            </>
          ) : (
            <h4 className="truncate text-sm font-semibold text-[color:var(--color-content-emphasis)]">
              {track.name}
            </h4>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[color:var(--color-content-subtle)]">
            {duration ? (
              <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
            ) : null}
            {track.sizeBytes != null ? (
              <span className="font-mono tabular-nums">{formatBytes(track.sizeBytes)}</span>
            ) : null}
            {source ? (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[color:var(--color-border-default)] underline-offset-2 hover:text-[color:var(--color-content-emphasis)]"
              >
                Jamendo
              </a>
            ) : null}
            {source ? (
              <a
                href={source.licenceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-[color:var(--color-border-default)] underline-offset-2 hover:text-[color:var(--color-content-emphasis)]"
              >
                {source.licenceName}
              </a>
            ) : null}
          </div>
          {uploadState === 'error' ? (
            <p className="mt-2 text-xs text-[color:var(--color-status-danger)]">
              {error ?? 'Upload failed'}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
          {!source ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Pencil size={13} aria-hidden="true" />
              Replace file
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove track"
            onClick={onClear}
            className="h-8 w-8 hover:bg-[color-mix(in_srgb,var(--color-status-danger)_9%,transparent)] hover:text-[color:var(--color-status-danger)]"
          >
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="audio/*"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  return (
    <label className="group has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:ring-offset-background relative flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-elevated)] p-6 text-center shadow-sm transition-[border-color,box-shadow,transform] hover:border-[color:var(--color-content-emphasis)]/40 hover:shadow-md active:scale-[0.99] has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-offset-2">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-muted)] transition-colors group-hover:text-[color:var(--color-content-emphasis)]">
        <CloudUpload size={19} strokeWidth={1.75} />
      </span>
      <span className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
        Drop track or click to browse
      </span>
      <span className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
        MP3, WAV, AAC, or M4A · up to 50MB
      </span>
      <input
        ref={inputRef}
        className="absolute inset-0 cursor-pointer opacity-0"
        type="file"
        accept="audio/*"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
