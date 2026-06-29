'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Moon, Sun } from 'lucide-react';
import { Component as RainbowMatrixShader } from '@/components/ui/rainbow-matrix-shader';
import { cn } from '@/lib/utils';

const RAINBOW_MATRIX_SOURCE_URL =
  'https://21st.dev/community/components/erikx/rainbow-matrix-shader/default';

type PreviewMode = 'dark' | 'light';

export function RainbowMatrixPreview() {
  const [mode, setMode] = useState<PreviewMode>('dark');
  const isLight = mode === 'light';

  return (
    <main
      className={cn(
        'min-h-[calc(100svh-49px)] overflow-hidden transition-colors duration-300',
        isLight ? 'bg-[#f7f9fc] text-[#0b1020]' : 'bg-black text-white',
      )}
    >
      <section
        className="relative isolate flex min-h-[calc(100svh-49px)] items-center justify-center overflow-hidden"
        aria-labelledby="rainbow-matrix-preview-title"
      >
        <div className="absolute inset-0 overflow-hidden">
          <RainbowMatrixShader className="h-full w-full" variant={mode} />
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_50%,transparent_0%,transparent_58%,rgba(0,0,0,0.14)_100%)]"
          aria-hidden="true"
        />

        <div
          className={cn(
            'absolute top-6 right-6 z-10 inline-flex rounded-full border p-1 shadow-2xl backdrop-blur-md',
            isLight
              ? 'border-[#d8e0ec]/70 bg-white/80 shadow-black/15'
              : 'border-white/15 bg-black/25 shadow-black/30',
          )}
          aria-label="Preview mode"
        >
          <button
            type="button"
            aria-pressed={!isLight}
            onClick={() => setMode('dark')}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-cyan-300/40 focus-visible:outline-none',
              !isLight ? 'bg-cyan-300 text-zinc-950' : 'text-[#344256] hover:bg-[#f1f5f9]',
            )}
          >
            <Moon size={15} aria-hidden="true" />
            Dark
          </button>
          <button
            type="button"
            aria-pressed={isLight}
            onClick={() => setMode('light')}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-cyan-300/40 focus-visible:outline-none',
              isLight ? 'bg-[#006ddb] text-white' : 'text-white/72 hover:bg-white/10',
            )}
          >
            <Sun size={15} aria-hidden="true" />
            Light
          </button>
        </div>

        <div
          className={cn(
            'absolute right-6 bottom-6 left-6 z-10 flex max-w-xl flex-col gap-4 rounded-2xl border px-5 py-5 shadow-2xl backdrop-blur-md transition-colors duration-300 sm:right-auto sm:left-8 sm:px-6',
            isLight
              ? 'border-[#d8e0ec]/75 bg-white/80 shadow-black/15'
              : 'border-cyan-300/20 bg-black/18 shadow-black/30',
          )}
        >
          <div className="space-y-1.5">
            <p
              className={cn(
                'text-xs font-semibold tracking-[0.24em] uppercase',
                isLight ? 'text-[#006ddb]' : 'text-cyan-200',
              )}
            >
              Loading preview
            </p>
            <h1
              id="rainbow-matrix-preview-title"
              className={cn(
                'text-2xl font-semibold sm:text-3xl',
                isLight ? 'text-[#0b1020]' : 'text-white',
              )}
            >
              Rainbow Matrix Shader
            </h1>
          </div>
          <div
            className={cn(
              'flex w-full items-center justify-between gap-4 text-xs',
              isLight ? 'text-[#344256]' : 'text-cyan-100/62',
            )}
          >
            <span className="font-mono tabular-nums">Project jYxrWzSRtsXNqZADHnVH</span>
            <Link
              href={RAINBOW_MATRIX_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'inline-flex items-center gap-1.5 font-medium hover:underline',
                isLight ? 'text-[#006ddb]' : 'text-cyan-200',
              )}
            >
              Source
              <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
