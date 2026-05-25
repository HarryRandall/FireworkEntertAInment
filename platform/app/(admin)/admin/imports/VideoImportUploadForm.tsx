'use client';

/** Client upload form that kicks off a new supplier video import job. */

import { useActionState, useEffect, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import {
  finalizeVideoImportJobAction,
  type ImportUploadActionState,
} from '@/app/actions/platform-admin';
import { Button } from '@/app/components/ui/Button';
import { Input, Select } from '@/app/components/ui/Input';
import {
  DEFAULT_OPENROUTER_MODEL,
  IMPORT_VIDEO_BUCKET,
  MAX_IMPORT_VIDEO_SECONDS,
  OPENROUTER_MODEL_OPTIONS,
} from '@/lib/import-jobs';
import { formatDuration } from '@/lib/show-domain';
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client';

function sanitizeStorageName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'firework-video'
  );
}

function inferContentType(file: File): string {
  if (file.type && file.type.startsWith('video/')) return file.type;
  if (/\.mov$/i.test(file.name)) return 'video/quicktime';
  if (/\.webm$/i.test(file.name)) return 'video/webm';
  if (/\.mkv$/i.test(file.name)) return 'video/x-matroska';
  return 'video/mp4';
}

export function VideoImportUploadForm() {
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // Holds the storage descriptor once the browser has finished pushing the
  // file to Supabase — the server action only ever receives metadata, never
  // the file itself, sidestepping Vercel's 4.5 MB Server Action body cap.
  const [uploaded, setUploaded] = useState<{
    storagePath: string;
    originalName: string;
    sizeBytes: number;
    contentType: string;
  } | null>(null);
  const initialState: ImportUploadActionState = { ok: false, error: null };
  const [state, formAction, finalizing] = useActionState(
    finalizeVideoImportJobAction,
    initialState,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hasFinalizedRef = useRef(false);

  // Once direct upload to Storage finishes, submit the form synchronously so
  // the server action runs with the storage path the browser just wrote.
  // CRITICAL: clear the file input first — the original File is already
  // sitting in Supabase Storage, and leaving it attached re-includes the
  // bytes in the Server Action POST, which Vercel caps at ~4.5 MB and rejects
  // as an "unexpected response" with no log entry on the action.
  useEffect(() => {
    if (uploaded && !finalizing && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;
      if (fileRef.current) fileRef.current.value = '';
      formRef.current?.requestSubmit();
    }
  }, [uploaded, finalizing]);

  function inspectVideo(file: File | undefined) {
    setDuration(null);
    setError(null);
    setNotice(null);
    setUploaded(null);
    if (!file) return;
    const looksLikeVideoByName = /\.(mp4|m4v|mov|webm|mkv)$/i.test(file.name);
    if (!file.type.startsWith('video/') && !looksLikeVideoByName) {
      setError('Choose a video file.');
      return;
    }
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const seconds = video.duration;
      if (Number.isFinite(seconds) && seconds > 0) {
        setDuration(seconds);
        if (seconds > MAX_IMPORT_VIDEO_SECONDS) {
          setError(`Video must be ${MAX_IMPORT_VIDEO_SECONDS} seconds or less.`);
        }
      } else {
        setNotice('Browser could not read duration; the worker will probe it server-side.');
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setNotice(
        "Browser couldn't decode this file's metadata (often MPEG-4 SP / HEVC). The worker will probe it server-side; the upload can still proceed.",
      );
    };
    video.src = objectUrl;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // If the file has already been uploaded directly to Storage, let the
    // <form action={formAction}> path post the metadata to the server action.
    if (uploaded) return;

    event.preventDefault();
    if (error) return;

    const formEl = event.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a video file before uploading.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You are not signed in. Refresh and sign back in.');
      }
      const contentType = inferContentType(file);
      const storagePath = `${user.id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;

      // The supabase-js v2 client does not surface upload progress, so we
      // show indeterminate-style feedback by toggling between 0 and 99 until
      // it resolves. (XHR-based progress would require a custom signed PUT.)
      setUploadProgress(1);
      const tick = window.setInterval(() => {
        setUploadProgress((prev) => (prev == null ? 1 : Math.min(95, prev + 2)));
      }, 250);

      const { error: uploadError } = await supabase.storage
        .from(IMPORT_VIDEO_BUCKET)
        .upload(storagePath, file, {
          contentType,
          upsert: false,
        });
      window.clearInterval(tick);
      if (uploadError) {
        throw new Error(uploadError.message || 'Upload failed.');
      }

      setUploadProgress(100);
      setUploaded({
        storagePath,
        originalName: file.name,
        sizeBytes: file.size,
        contentType,
      });
      // The useEffect above will requestSubmit() once `uploaded` is set, which
      // re-enters this handler with `uploaded` truthy and falls through to
      // the server action with metadata only.
      void formEl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_1fr_auto]"
    >
      <Input name="sourceName" placeholder="Firework name or source" required />
      <Select name="selectedModel" defaultValue={DEFAULT_OPENROUTER_MODEL}>
        {OPENROUTER_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <div className="space-y-1">
        <input
          ref={fileRef}
          name="videoFile"
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          required={!uploaded}
          onChange={(event) => inspectVideo(event.currentTarget.files?.[0])}
          className="border-outline/55 bg-surface text-on-surface file:bg-primary-container file:text-on-primary-container block h-11 w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-bold"
        />
        <p className="text-on-surface-variant text-[11px] leading-snug">
          For reliable in-browser playback, upload H.264 (AVC) video with AAC audio in MP4 —
          MOV/HEVC from phones often decode as audio-only or a black image on desktop
          Linux/Chromium.
        </p>
        <input
          type="hidden"
          name="reportedDurationSeconds"
          value={duration == null ? '' : duration}
          readOnly
        />
        <input type="hidden" name="storagePath" value={uploaded?.storagePath ?? ''} readOnly />
        <input type="hidden" name="originalName" value={uploaded?.originalName ?? ''} readOnly />
        <input type="hidden" name="sizeBytes" value={uploaded?.sizeBytes ?? ''} readOnly />
        <input type="hidden" name="contentType" value={uploaded?.contentType ?? ''} readOnly />
        {error ? (
          <p className="text-error text-xs font-semibold">{error}</p>
        ) : duration != null ? (
          <p className="text-on-surface-variant text-xs">
            Detected duration {formatDuration(duration)}.
          </p>
        ) : notice ? (
          <p className="text-on-surface-variant text-xs">{notice}</p>
        ) : null}
        {uploadProgress != null ? (
          <div
            className="text-on-surface-variant mt-1 flex items-center gap-2 text-[11px]"
            data-testid="upload-progress"
          >
            <div className="bg-outline-variant/30 h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-[width] duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="font-mono tabular-nums">
              {uploadProgress < 100
                ? `Uploading ${uploadProgress}%`
                : finalizing
                  ? 'Finalizing…'
                  : 'Uploaded'}
            </span>
          </div>
        ) : null}
      </div>
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={Boolean(error) || uploading || finalizing}
        loading={uploading || finalizing}
      >
        <UploadCloud size={16} />
        Upload
      </Button>
      {state.error ? (
        <p className="text-error text-sm font-semibold lg:col-span-4">{state.error}</p>
      ) : null}
    </form>
  );
}
