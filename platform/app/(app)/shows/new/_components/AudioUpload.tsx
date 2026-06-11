/**
 * Audio drop-zone / attached-track UI for the wizard.
 *
 * Renders one of two states: a dashed drop zone when no file is attached, or
 * a "track ready" panel when one is. Display-only — upload progress and
 * error state are owned by the parent (see `uploadAudioAndStartAnalysis` in
 * the wizard page).
 */
'use client';

import { Check, CloudUpload, Loader2, Music4, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { cn } from '@/lib/utils';
import type { AudioUploadState } from '../types';
import { formatBytes, formatDuration } from '../utils';

export function AudioUpload({
  file,
  duration,
  uploadState,
  error,
  inputRef,
  onFile,
  onClear,
}: {
  file: File | null;
  duration: number | null;
  uploadState: AudioUploadState;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  if (file) {
    const statusText =
      uploadState === 'uploading'
        ? 'Uploading track'
        : uploadState === 'error'
          ? (error ?? 'Upload failed')
          : 'Track ready';
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-4',
          uploadState === 'error'
            ? 'border-[color:var(--color-status-danger)]/40 bg-[color-mix(in_srgb,var(--color-status-danger)_8%,transparent)]'
            : 'border-[color:var(--color-status-success)]/40 bg-[color-mix(in_srgb,var(--color-status-success)_8%,transparent)]',
        )}
      >
        <span
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-bg-default)]',
            uploadState === 'error'
              ? 'text-[color:var(--color-status-danger)]'
              : 'text-[color:var(--color-status-success)]',
          )}
        >
          {uploadState === 'uploading' ? (
            <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
          ) : (
            <Music4 size={18} strokeWidth={1.75} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Check
              size={14}
              strokeWidth={2.5}
              className={cn(
                'shrink-0',
                uploadState === 'error'
                  ? 'text-[color:var(--color-status-danger)]'
                  : 'text-[color:var(--color-status-success)]',
              )}
            />
            <span className="truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
              {file.name}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">
            {formatBytes(file.size)}
            {duration ? ` · ${formatDuration(duration)}` : ''}
            {` · ${statusText}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            <Pencil size={13} />
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove track"
            onClick={onClear}
            className="h-8 w-8"
          >
            <Trash2 size={14} />
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
    <label className="group relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-subtle)]/40 p-6 text-center transition-colors hover:border-[color:var(--color-content-emphasis)]/45 hover:bg-[color:var(--color-bg-subtle)]">
      <CloudUpload
        size={28}
        strokeWidth={1.5}
        className="mb-3 text-[color:var(--color-content-subtle)]"
      />
      <span className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
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
