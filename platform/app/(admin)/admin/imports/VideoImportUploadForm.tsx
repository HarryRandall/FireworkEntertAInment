"use client";

import { useActionState, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  createVideoImportJobAction,
  type ImportUploadActionState,
} from "@/app/actions/platform-admin";
import { Button } from "@/app/components/ui/Button";
import { Input, Select } from "@/app/components/ui/Input";
import {
  DEFAULT_OPENROUTER_MODEL,
  MAX_IMPORT_VIDEO_SECONDS,
  OPENROUTER_MODEL_OPTIONS,
} from "@/lib/imports";
import { formatDuration } from "@/lib/shows";

export function VideoImportUploadForm() {
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialState: ImportUploadActionState = { ok: false, error: null };
  const [state, formAction, pending] = useActionState(
    createVideoImportJobAction,
    initialState,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  function inspectVideo(file: File | undefined) {
    setDuration(null);
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Choose a video file.");
      return;
    }
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const seconds = video.duration;
      setDuration(seconds);
      if (seconds > MAX_IMPORT_VIDEO_SECONDS) {
        setError(`Video must be ${MAX_IMPORT_VIDEO_SECONDS} seconds or less.`);
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError("Could not read video metadata.");
    };
    video.src = objectUrl;
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (error || (duration ?? 0) > MAX_IMPORT_VIDEO_SECONDS) {
          event.preventDefault();
        }
      }}
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
          required
          onChange={(event) => inspectVideo(event.currentTarget.files?.[0])}
          className="block h-11 w-full rounded-lg border border-outline/55 bg-surface px-3 py-2 text-sm text-on-surface file:mr-3 file:rounded-md file:border-0 file:bg-primary-container file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-on-primary-container"
        />
        <p className="text-[11px] leading-snug text-on-surface-variant">
          For reliable in-browser playback, upload H.264 (AVC) video with AAC audio in MP4 —
          MOV/HEVC from phones often decode as audio-only or a black image on desktop Linux/Chromium.
        </p>
        <input
          type="hidden"
          name="reportedDurationSeconds"
          value={duration == null ? "" : duration}
          readOnly
        />
        {duration != null || error ? (
          <p className={error ? "text-xs font-semibold text-error" : "text-xs text-on-surface-variant"}>
            {error ?? `Detected duration ${formatDuration(duration)}.`}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="sm" disabled={Boolean(error) || pending} loading={pending}>
        <UploadCloud size={16} />
        Upload
      </Button>
      {state.error ? (
        <p className="text-sm font-semibold text-error lg:col-span-4">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
