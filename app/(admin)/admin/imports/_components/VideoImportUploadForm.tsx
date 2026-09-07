'use client';

/** Client upload form that kicks off a new supplier video import job. */

import { useActionState, useEffect, useRef, useState } from 'react';
import { FileVideo2, Trash2, UploadCloud } from 'lucide-react';
import {
  finalizeVideoImportJobAction,
  type ImportUploadActionState,
} from '@/app/actions/platform-admin';
import { Button } from '@/components/design-system/Button';
import { Field, FieldHint, FieldLabel } from '@/components/design-system/Field';
import { Input, Select } from '@/components/design-system/Input';
import {
  DEFAULT_OPENROUTER_MODEL,
  IMPORT_VIDEO_BUCKET,
  MAX_IMPORT_VIDEO_SECONDS,
  OPENROUTER_MODEL_OPTIONS,
} from '@/lib/import-jobs';
import { formatDuration } from '@/lib/show-domain';
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client';

const MAX_IMPORT_VIDEO_BYTES = 250 * 1024 * 1024;

type UploadPhase = 'idle' | 'uploading' | 'finalising';
type FinalisationCycle = 'none' | 'awaiting-start' | 'pending' | 'settled';

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
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [finalisationCycle, setFinalisationCycle] = useState<FinalisationCycle>('none');
  const [discarding, setDiscarding] = useState(false);
  // Holds the storage descriptor once the browser has finished pushing the
  // file to Supabase. The server action only ever receives metadata, never
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
  const videoProbeRef = useRef<{ element: HTMLVideoElement; objectUrl: string } | null>(null);

  useEffect(
    () => () => {
      const probe = videoProbeRef.current;
      if (!probe) return;
      probe.element.onloadedmetadata = null;
      probe.element.onerror = null;
      probe.element.removeAttribute('src');
      probe.element.load();
      URL.revokeObjectURL(probe.objectUrl);
      videoProbeRef.current = null;
    },
    [],
  );

  // Once direct upload to Storage finishes, submit the form synchronously so
  // the server action runs with the storage path the browser just wrote.
  // Clear the file input first. The original File is already
  // sitting in Supabase Storage, and leaving it attached re-includes the
  // bytes in the Server Action POST, which Vercel caps at ~4.5 MB and rejects
  // as an "unexpected response" with no log entry on the action.
  useEffect(() => {
    if (uploaded && !finalizing && !hasFinalizedRef.current) {
      hasFinalizedRef.current = true;
      if (fileRef.current) fileRef.current.value = '';
      setUploadPhase('finalising');
      setFinalisationCycle('awaiting-start');
      formRef.current?.requestSubmit();
    }
  }, [uploaded, finalizing]);

  useEffect(() => {
    if (finalizing && finalisationCycle === 'awaiting-start') {
      setFinalisationCycle('pending');
      return;
    }
    if (!finalizing && finalisationCycle === 'pending') {
      // A completed metadata attempt leaves the Storage object available for
      // an explicit retry or discard. Keeping this cycle separate prevents a
      // previous action error from leaking into a newly selected upload.
      setFinalisationCycle('settled');
      setUploadPhase('idle');
    }
  }, [finalisationCycle, finalizing]);

  useEffect(() => {
    const shouldWarnBeforeUnload =
      uploadPhase === 'uploading' || (Boolean(uploaded) && finalisationCycle === 'settled');
    if (!shouldWarnBeforeUnload) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [finalisationCycle, uploadPhase, uploaded]);

  function inspectVideo(file: File | undefined) {
    const previousProbe = videoProbeRef.current;
    if (previousProbe) {
      previousProbe.element.onloadedmetadata = null;
      previousProbe.element.onerror = null;
      previousProbe.element.removeAttribute('src');
      previousProbe.element.load();
      URL.revokeObjectURL(previousProbe.objectUrl);
      videoProbeRef.current = null;
    }
    setDuration(null);
    setError(null);
    setNotice(null);
    setUploaded(null);
    setFinalisationCycle('none');
    setSelectedFile(file ? { name: file.name, size: file.size } : null);
    hasFinalizedRef.current = false;
    if (!file) return;
    const looksLikeVideoByName = /\.(mp4|m4v|mov|webm|mkv)$/i.test(file.name);
    if (!file.type.startsWith('video/') && !looksLikeVideoByName) {
      setError('Choose a video file.');
      return;
    }
    if (file.size > MAX_IMPORT_VIDEO_BYTES) {
      setError('Video must be 250 MB or less.');
      return;
    }
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    videoProbeRef.current = { element: video, objectUrl };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      if (videoProbeRef.current?.element !== video) return;
      URL.revokeObjectURL(objectUrl);
      videoProbeRef.current = null;
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
      if (videoProbeRef.current?.element !== video) return;
      URL.revokeObjectURL(objectUrl);
      videoProbeRef.current = null;
      setNotice(
        "Browser couldn't decode this file's metadata (often MPEG-4 SP / HEVC). The worker will probe it server-side; the upload can still proceed.",
      );
    };
    video.src = objectUrl;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // If the file has already been uploaded directly to Storage, let the
    // <form action={formAction}> path post the metadata to the server action.
    if (uploaded) {
      setUploadPhase('finalising');
      setFinalisationCycle('awaiting-start');
      return;
    }

    event.preventDefault();
    if (error) return;

    const formEl = event.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a video file before uploading.');
      return;
    }

    setUploadPhase('uploading');
    setFinalisationCycle('none');
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

      const { error: uploadError } = await supabase.storage
        .from(IMPORT_VIDEO_BUCKET)
        .upload(storagePath, file, {
          contentType,
          upsert: false,
        });
      if (uploadError) {
        throw new Error(uploadError.message || 'Upload failed.');
      }

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
      setUploadPhase('idle');
    }
  }

  async function discardUploadedVideo() {
    if (!uploaded || discarding) return;
    setDiscarding(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: removeError } = await supabase.storage
        .from(IMPORT_VIDEO_BUCKET)
        .remove([uploaded.storagePath]);
      if (removeError) throw new Error(removeError.message);
      setUploaded(null);
      setFinalisationCycle('none');
      setSelectedFile(null);
      setDuration(null);
      setNotice(null);
      hasFinalizedRef.current = false;
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uploaded video could not be discarded.');
    } finally {
      setDiscarding(false);
    }
  }

  const busy = uploadPhase !== 'idle' || finalizing || discarding;
  const phaseLabel =
    uploadPhase === 'uploading'
      ? 'Uploading video…'
      : uploadPhase === 'finalising' || finalizing
        ? 'Creating import job…'
        : null;
  const actionError = uploaded && finalisationCycle === 'settled' ? state.error : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-5"
      aria-busy={busy}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="import-source-name">Working title</FieldLabel>
          <Input
            id="import-source-name"
            name="sourceName"
            placeholder="e.g. Silver tail to red peony…"
            autoComplete="off"
            maxLength={180}
            readOnly={busy}
            required
          />
          <FieldHint>Use the product name or supplier reference shown with the footage.</FieldHint>
        </Field>

        <Field>
          <FieldLabel>Reconstruction model</FieldLabel>
          <Select
            name="selectedModel"
            defaultValue={DEFAULT_OPENROUTER_MODEL}
            aria-label="Reconstruction model"
          >
            {OPENROUTER_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <FieldHint>The selected model is recorded with every reconstruction attempt.</FieldHint>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="import-video-file">Source video</FieldLabel>
        <div className="border-border bg-muted/25 rounded-lg border border-dashed p-3">
          <div className="flex items-start gap-3">
            <span className="bg-background text-muted-foreground border-border mt-0.5 grid size-10 shrink-0 place-items-center rounded-md border">
              <FileVideo2 size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                ref={fileRef}
                id="import-video-file"
                name="videoFile"
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                required={!uploaded}
                disabled={busy || Boolean(uploaded)}
                onChange={(event) => inspectVideo(event.currentTarget.files?.[0])}
                aria-describedby="import-video-help"
                className="border-input bg-background text-foreground file:bg-secondary file:text-secondary-foreground block min-h-11 w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium disabled:cursor-not-allowed disabled:opacity-60"
              />
              {selectedFile ? (
                <p className="text-foreground min-w-0 truncate text-xs font-medium">
                  {selectedFile.name}{' '}
                  <span className="text-muted-foreground font-mono tabular-nums">
                    ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <p id="import-video-help" className="text-muted-foreground text-xs leading-relaxed">
          MP4, MOV, WebM or MKV, up to 1 minute and 250 MB. H.264 video with AAC audio gives the
          most reliable browser comparison. Other supported codecs are normalised by the worker.
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
          <p className="text-destructive text-sm font-medium" role="alert">
            {error}
          </p>
        ) : duration != null ? (
          <p className="text-muted-foreground text-xs" role="status">
            Detected duration {formatDuration(duration)}.
          </p>
        ) : notice ? (
          <p className="text-muted-foreground text-xs" role="status">
            {notice}
          </p>
        ) : null}
      </Field>

      {phaseLabel ? (
        <div
          className="border-border bg-muted/35 space-y-2 rounded-lg border p-3"
          data-testid="upload-progress"
          role="status"
          aria-live="polite"
        >
          <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
            <span>{phaseLabel}</span>
            <span className="font-mono tabular-nums">Progress is indeterminate</span>
          </div>
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={phaseLabel}
            aria-valuetext="In progress"
          >
            <div className="bg-primary h-full w-1/3 animate-pulse rounded-full motion-reduce:animate-none" />
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div className="border-destructive/25 bg-destructive/5 rounded-lg border p-3" role="alert">
          <p className="text-destructive text-sm font-medium">{actionError}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            The video is already uploaded. Retry finalisation without uploading the file again.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            disabled={discarding || finalizing}
            onClick={discardUploadedVideo}
          >
            <Trash2 size={15} aria-hidden="true" />
            {discarding ? 'Discarding…' : 'Discard uploaded video'}
          </Button>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={Boolean(error) || busy} loading={busy}>
          <UploadCloud size={16} aria-hidden="true" />
          {busy
            ? uploadPhase === 'uploading'
              ? 'Uploading…'
              : 'Creating job…'
            : actionError
              ? 'Retry finalisation'
              : 'Upload and analyse'}
        </Button>
      </div>
    </form>
  );
}
