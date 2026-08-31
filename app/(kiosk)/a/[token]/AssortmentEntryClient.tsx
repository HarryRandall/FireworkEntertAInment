'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Music2, Package, Sparkles } from 'lucide-react';
import { JamendoSongSearch } from '@/app/(app)/shows/new/_components/JamendoSongSearch';
import { Button } from '@/components/design-system/Button';
import { Card } from '@/components/design-system/Card';
import type { JamendoSearchTrack } from '@/lib/music-library.types';
import { formatBudget } from '@/lib/show-domain';
import { createClient } from '@/utils/supabase/client';
import type { PublicAssortmentItem } from '@/lib/assortments/public.server';

type AssortmentEntryClientProps = {
  token: string;
  assortment: {
    name: string;
    description: string | null;
    priceCents: number;
    items: PublicAssortmentItem[];
  };
};

type JsonResponse = {
  ok?: boolean;
  error?: string;
  selectionToken?: string;
  path?: string;
  uploadToken?: string;
  unavailable?: boolean;
};

function inferAudioType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'm4a') return 'audio/x-m4a';
  return '';
}

async function readJson(response: Response): Promise<JsonResponse> {
  const data = (await response.json().catch(() => null)) as JsonResponse | null;
  if (!response.ok || !data?.ok) {
    throw Object.assign(new Error(data?.error || 'Something went wrong.'), {
      unavailable: data?.unavailable === true,
    });
  }
  return data;
}

export function AssortmentEntryClient({ token, assortment }: AssortmentEntryClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [song, setSong] = useState<File | null>(null);
  const [jamendoTrack, setJamendoTrack] = useState<JamendoSearchTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState('');
  const [pending, startTransition] = useTransition();
  const pieceCount = assortment.items.reduce((total, item) => total + item.quantity, 0);

  function generate() {
    if (!song && !jamendoTrack) {
      setError('Choose an MP3, WAV, AAC, or M4A song first.');
      return;
    }
    const contentType = song ? inferAudioType(song) : '';
    if (song && !contentType) {
      setError('Choose an MP3, WAV, AAC, or M4A song.');
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        let selectionToken: string;
        if (jamendoTrack) {
          setStage('Importing your selected song');
          const imported = await readJson(
            await fetch(`/api/assortments/${token}/music/jamendo`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trackId: jamendoTrack.trackId }),
            }),
          );
          if (!imported.selectionToken) {
            throw new Error('The selected song could not be prepared.');
          }
          selectionToken = imported.selectionToken;
        } else if (song) {
          setStage('Preparing your song');
          const prepared = await readJson(
            await fetch(`/api/assortments/${token}/music`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'prepare-upload',
                originalFilename: song.name,
                contentType,
                sizeBytes: song.size,
              }),
            }),
          );
          if (!prepared.path || !prepared.uploadToken || !prepared.selectionToken) {
            throw new Error('The song upload could not be prepared.');
          }

          setStage('Uploading your song');
          const supabase = createClient();
          const { error: uploadError } = await supabase.storage
            .from('audio')
            .uploadToSignedUrl(prepared.path, prepared.uploadToken, song, { contentType });
          if (uploadError) throw new Error('The song could not be uploaded.');

          setStage('Starting music analysis');
          await readJson(
            await fetch(`/api/assortments/${token}/music`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'analyse',
                selectionToken: prepared.selectionToken,
              }),
            }),
          );
          selectionToken = prepared.selectionToken;
        } else {
          throw new Error('Choose a song first.');
        }

        setStage('Starting your show');
        const created = await readJson(
          await fetch(`/api/assortments/${token}/shows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectionToken }),
          }),
        );
        if (!created.path) throw new Error('The generated show link was missing.');
        router.push(created.path);
      } catch (caught) {
        setStage('');
        if (
          typeof caught === 'object' &&
          caught !== null &&
          'unavailable' in caught &&
          caught.unavailable === true
        ) {
          setJamendoTrack(null);
        }
        setError(caught instanceof Error ? caught.message : 'The show could not be created.');
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="text-primary flex items-center gap-2 text-sm font-semibold">
          <Package size={17} aria-hidden="true" />
          Fixed assortment
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{assortment.name}</h1>
        {assortment.description ? (
          <p className="text-on-surface-variant mt-3 text-base leading-7">
            {assortment.description}
          </p>
        ) : null}

        <Card className="mt-6 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-on-surface-variant text-sm">Assortment price</p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {formatBudget(assortment.priceCents)}
              </p>
            </div>
            <span className="bg-surface-container text-on-surface-variant inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
              <LockKeyhole size={13} aria-hidden="true" />
              Locked
            </span>
          </div>
          <details className="border-border mt-4 border-t pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              {pieceCount} {pieceCount === 1 ? 'product' : 'products'} included
            </summary>
            <ul className="mt-3 space-y-2">
              {assortment.items.map((item) => (
                <li key={item.catalogueItemId} className="flex items-start gap-3 text-sm">
                  <span className="text-on-surface-variant w-8 shrink-0 font-mono tabular-nums">
                    {item.quantity}x
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-on-surface-variant block font-mono text-xs">
                      {item.partNumber}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </Card>

        <section aria-labelledby="song-heading" className="mt-8">
          <div className="flex items-center gap-2">
            <Music2 className="text-primary" size={20} aria-hidden="true" />
            <h2 id="song-heading" className="text-lg font-semibold">
              Choose your song
            </h2>
          </div>
          <p className="text-on-surface-variant mt-1 text-sm leading-6">
            Your show will use only the products and quantities in this assortment.
          </p>
          <div className="mt-4">
            <JamendoSongSearch
              apiEndpoint={`/api/assortments/${token}/music/jamendo`}
              disabled={pending}
              hasSelection={jamendoTrack !== null}
              onSelect={async (track) => {
                setJamendoTrack(track);
                setSong(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setError(null);
              }}
            />
          </div>
          {jamendoTrack ? (
            <div className="border-primary/35 bg-primary/5 mt-3 flex items-center gap-3 rounded-xl border px-4 py-3">
              <Music2 className="text-primary shrink-0" size={19} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{jamendoTrack.title}</span>
                <span className="text-on-surface-variant block truncate text-xs">
                  {jamendoTrack.artist}
                </span>
              </span>
            </div>
          ) : null}
          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="bg-border h-px flex-1" />
            <span className="text-on-surface-variant text-xs font-medium tracking-wide uppercase">
              or
            </span>
            <span className="bg-border h-px flex-1" />
          </div>
          <label
            htmlFor="assortment-song"
            className="border-border bg-surface-container-low hover:bg-surface-container flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
          >
            <Music2 size={19} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {song?.name || 'Upload your own audio'}
              </span>
              <span className="text-on-surface-variant block text-xs">MP3 / WAV / AAC / M4A</span>
            </span>
            <span className="text-on-surface-variant text-xs">Up to 50 MB</span>
          </label>
          <input
            ref={fileInputRef}
            id="assortment-song"
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/mp4,audio/x-m4a,.mp3,.wav,.aac,.m4a"
            className="sr-only"
            disabled={pending}
            onChange={(event) => {
              setSong(event.target.files?.[0] ?? null);
              setJamendoTrack(null);
              setError(null);
            }}
          />
          {error ? (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={generate}
            loading={pending}
            disabled={!song && !jamendoTrack}
            className="mt-5 min-h-12 w-full text-base"
          >
            <Sparkles size={18} aria-hidden="true" />
            {pending ? stage || 'Preparing your show' : 'Generate show'}
          </Button>
          <p aria-live="polite" className="text-on-surface-variant mt-3 text-center text-xs">
            {pending ? stage : 'No account or catalogue setup needed'}
          </p>
        </section>
      </div>
    </div>
  );
}
