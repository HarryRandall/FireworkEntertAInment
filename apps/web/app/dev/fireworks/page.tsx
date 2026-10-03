/** Developer review surface for stored designs and the CPU-backed WebGL view. */
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { effectTemplates, type Design } from '@showcrafter/fireworks';
import { reviewFixtures } from '@showcrafter/fireworks/fixtures';
import { Viewer, reviewTime } from '@showcrafter/fireworks/view';
import { Button } from '@/ui/primitives/button';
const entries: readonly { key: string; name: string; group: string; design: Design }[] = [
  ...effectTemplates,
  ...reviewFixtures.map((fixture) => ({
    ...fixture,
    key: `fixture-${fixture.key}`,
    group: 'Fixtures',
  })),
];
// Review thumbnails use a small fixed CSS viewport; the live viewport is restored afterwards.
const THUMB_WIDTH_PX = 320,
  THUMB_HEIGHT_PX = 200;
// Range granularity in seconds and thumbnail image ratio, chosen for review controls.
const SEEK_STEP_S = 0.01;
const PROTOTYPE_URL = 'http://localhost:8765/fireworks.html';

/** Shows all templates as shared-context stills with one selected, playable large view. */
export default function FireworksPage() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [selected, setSelected] = useState(entries[0]);
  const [posters, setPosters] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [state, setState] = useState({ t: 0, duration: 0, playing: false, count: 0, hdr: false });
  const [large, setLarge] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const element = host.current;
    if (!element || !entries[0]) return;
    let cancelled = false,
      rig: Viewer | null = null;
    let unsubscribe = () => {};
    setReady(false);
    setError('');
    setPosters({});
    async function initialise() {
      try {
        if (!element || !entries[0]) return;
        rig = new Viewer(element, {
          design: entries[0].design,
          autoplay: false,
          forceLdr: new URLSearchParams(location.search).has('ldr'),
        });
        viewer.current = rig;
        // Reuse the live context while generating stills. No card owns a renderer.
        const images: Record<string, string> = {};
        for (const entry of entries) {
          if (cancelled || !rig) return;
          rig.setDesign(entry.design);
          rig.seek(reviewTime(entry.design));
          images[entry.key] = rig.capture(THUMB_WIDTH_PX, THUMB_HEIGHT_PX);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        if (cancelled || !rig) return;
        setPosters(images);
        setReady(true);
        rig.setDesign(entries[0].design);
        rig.seek(reviewTime(entries[0].design));
        unsubscribe = rig.on((v) =>
          setState({
            t: v.t,
            duration: v.duration,
            playing: v.playing,
            count: v.count,
            hdr: v.output.hdr,
          }),
        );
        setSelected(entries[0]);
      } catch (cause) {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'The WebGL preview could not start.');
        rig?.dispose();
        viewer.current = null;
      }
    }
    void initialise();
    return () => {
      cancelled = true;
      unsubscribe();
      rig?.dispose();
      viewer.current = null;
    };
  }, [generation]);

  function select(entry: (typeof entries)[number]) {
    if (!ready || !viewer.current) return;
    setSelected(entry);
    viewer.current.setDesign(entry.design);
    viewer.current.seek(0);
    viewer.current.play();
    host.current?.scrollIntoView({ behavior: 'instant', block: 'center' });
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <p className="text-muted-foreground text-sm">ShowCrafter · Renderer review</p>
        <h1 className="text-3xl font-semibold">Firework previews</h1>
        <p className="text-muted-foreground">
          All {effectTemplates.length} templates and three fixtures. Choose a card to play it in the
          large view.
        </p>
        <a
          className="text-primary w-fit underline underline-offset-4"
          href={PROTOTYPE_URL}
          target="_blank"
          rel="noreferrer"
        >
          Open prototype alongside this viewer
        </a>
        <Link className="text-primary w-fit underline underline-offset-4" href="/dev">
          Developer routes
        </Link>
      </header>
      <section aria-label="Selected firework" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold" data-testid="selected-name">
            {selected?.name}
          </h2>
          <span className="text-muted-foreground">{selected?.group}</span>
          <Button variant="outline" onClick={() => setLarge(!large)} aria-pressed={large}>
            {large ? 'Standard view' : 'Open large'}
          </Button>
        </div>
        <div
          ref={host}
          data-testid="stage"
          className={`bg-muted overflow-hidden rounded-xl border ${large ? 'h-[75dvh]' : 'aspect-[16/10] max-h-[600px]'}`}
        />
        {error ? (
          <div role="alert">
            <p>Preview unavailable: {error}</p>
            <Button onClick={() => setGeneration(generation + 1)}>Try again</Button>
          </div>
        ) : !ready ? (
          <p role="status">Preparing shared-context previews...</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!ready} onClick={() => viewer.current?.toggle()}>
            {state.playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            disabled={!ready}
            variant="outline"
            onClick={() => {
              viewer.current?.seek(0);
              viewer.current?.play();
            }}
          >
            Restart
          </Button>
          <label className="flex min-w-40 flex-1 items-center gap-2">
            Time
            <input
              className="w-full"
              type="range"
              aria-label="Preview time"
              min={0}
              max={state.duration}
              step={SEEK_STEP_S}
              value={state.t}
              disabled={!ready}
              onChange={(event) => {
                viewer.current?.pause();
                viewer.current?.seek(Number(event.target.value));
              }}
            />
          </label>
          <output className="font-mono text-sm">
            {state.t.toFixed(2)} / {state.duration.toFixed(2)} s
          </output>
          <Button disabled={!ready} variant="outline" onClick={() => viewer.current?.resetCamera()}>
            Reset view
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">
          {state.hdr ? 'HDR' : '8-bit'} output · {state.count.toLocaleString('en-GB')} particles ·
          CPU sprays
        </p>
      </section>
      <section
        aria-label="Template library"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {entries.map((entry) => (
          <button
            key={entry.key}
            type="button"
            data-template={entry.key}
            disabled={!ready}
            aria-pressed={selected?.key === entry.key}
            aria-label={`Play ${entry.name}`}
            onClick={() => select(entry)}
            className="bg-card text-card-foreground focus-visible:ring-ring aria-pressed:border-primary overflow-hidden rounded-xl border text-left focus-visible:ring-2"
          >
            {posters[entry.key] ? (
              <Image
                unoptimized
                src={posters[entry.key]}
                alt=""
                width={THUMB_WIDTH_PX}
                height={THUMB_HEIGHT_PX}
                className="aspect-[16/10] w-full"
              />
            ) : (
              <div className="bg-muted aspect-[16/10]" />
            )}
            <span className="grid gap-1 p-3">
              <span className="font-medium">{entry.name}</span>
              <span className="text-muted-foreground text-sm">{entry.group}</span>
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}
