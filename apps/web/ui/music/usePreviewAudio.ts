/** Single-track audio preview: one element at a time, resumable, released on switch and unmount. */
'use client';

import { useEffect, useRef, useState } from 'react';

type PreviewStatus = 'loading' | 'playing' | 'paused';

export interface PreviewState {
  trackId: string;
  status: PreviewStatus;
  time: number;
  duration: number;
}

const START_FAILED = 'The song preview could not start. Try again.';
const PLAYBACK_FAILED = 'The song preview stopped unexpectedly. Try again.';

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isAutoplayBlocked(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

/** Detach handlers and drop the network stream so the browser stops buffering it. */
function release(audio: HTMLAudioElement) {
  audio.onloadedmetadata = null;
  audio.ontimeupdate = null;
  audio.onplaying = null;
  audio.onwaiting = null;
  audio.onpause = null;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

export function usePreviewAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (audioRef.current) release(audioRef.current);
      audioRef.current = null;
    },
    [],
  );

  function update(audio: HTMLAudioElement, patch: Partial<PreviewState>) {
    // Events from a released element can still be queued; ignore them.
    if (audioRef.current !== audio) return;
    setPreview((current) => (current ? { ...current, ...patch } : current));
  }

  function stop() {
    if (audioRef.current) release(audioRef.current);
    audioRef.current = null;
    setPreview(null);
  }

  function fail(audio: HTMLAudioElement, message: string) {
    if (audioRef.current !== audio) return;
    stop();
    setError(message);
  }

  function play(audio: HTMLAudioElement) {
    audio.play().catch((err: unknown) => {
      // Pausing or switching tracks rejects the pending play(); that is expected.
      if (audioRef.current !== audio || isAbort(err)) return;
      // Autoplay after an async gap can be refused; leave the track ready to play.
      if (isAutoplayBlocked(err)) update(audio, { status: 'paused' });
      else fail(audio, START_FAILED);
    });
  }

  function toggle(track: { trackId: string; previewUrl: string; durationSeconds: number }) {
    const current = audioRef.current;
    setError(null);
    if (current && preview?.trackId === track.trackId) {
      if (current.paused) {
        update(current, { status: 'loading' });
        play(current);
      } else {
        current.pause();
      }
      return;
    }

    if (current) release(current);
    const audio = new Audio(track.previewUrl);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        update(audio, { duration: audio.duration });
      }
    };
    audio.ontimeupdate = () => update(audio, { time: audio.currentTime });
    audio.onplaying = () => update(audio, { status: 'playing' });
    audio.onwaiting = () => update(audio, { status: 'loading' });
    audio.onpause = () => update(audio, { status: 'paused' });
    audio.onended = () => update(audio, { status: 'paused', time: 0 });
    audio.onerror = () => fail(audio, PLAYBACK_FAILED);
    audioRef.current = audio;
    setPreview({
      trackId: track.trackId,
      status: 'loading',
      time: 0,
      duration: track.durationSeconds,
    });
    play(audio);
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !preview) return;
    const total =
      Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : preview.duration;
    if (!total) return;
    const next = Math.min(Math.max(seconds, 0), total);
    audio.currentTime = next;
    update(audio, { time: next });
  }

  return { preview, error, clearError: () => setError(null), toggle, stop, seekTo };
}
