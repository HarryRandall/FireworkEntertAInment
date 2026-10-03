/** Abortable music search ignores superseded responses and retains input on failure. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { musicSearchSchema } from '@/lib/shopper/music/client';
import type { MusicTrack } from '@/lib/shopper/music/contracts';

/** Loads configuration when opened, then searches explicitly, cancelling stale requests. */
export function useMusicSearch() {
  const [state, setState] = useState<{
    status: 'loading' | 'ok' | 'not_configured' | 'error';
    tracks: MusicTrack[];
    message?: string;
  }>({ status: 'loading', tracks: [] });
  const controller = useRef<AbortController | null>(null);
  async function search(query: string) {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setState({ status: 'loading', tracks: [] });
    try {
      const response = await fetch(`/api/shopper/music?q=${encodeURIComponent(query)}`, {
        signal: active.signal,
      });
      const result = musicSearchSchema.parse(await response.json());
      if (active.signal.aborted) return;
      if (result.status === 'invalid' || result.status === 'error')
        setState({ status: 'error', message: result.message, tracks: [] });
      else setState(result);
    } catch (error) {
      if (active.signal.aborted) return;
      console.error('Music search failed', error);
      setState({
        status: 'error',
        message: 'Music search could not load. Please try again.',
        tracks: [],
      });
    }
  }
  useEffect(() => {
    search('').catch(console.error);
    return () => controller.current?.abort();
  }, []);
  return { ...state, search };
}
