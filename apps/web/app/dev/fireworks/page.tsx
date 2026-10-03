/** Developer review surface for stored designs and the GPU-backed WebGL view. */
'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { effectTemplates } from '@showcrafter/fireworks';
import { entries } from './_components/review-catalogue';
import { ReviewStage } from './_components/review-stage';
import { DatabaseTemplate } from './_components/database-template';
import { TemplateLibrary } from './_components/template-library';
import { useReviewViewer } from './_components/use-review-viewer';
const PROTOTYPE_URL = 'http://localhost:8765/fireworks.html';

/** Shows all templates as shared-context stills with one selected, playable large view. */
export default function FireworksPage() {
  const host = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(entries[0]);
  const [large, setLarge] = useState(false);
  const [generation, setGeneration] = useState(0);

  const { viewer, posters, error, ready, state } = useReviewViewer(host, generation, setSelected);

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
      <ReviewStage
        selected={selected}
        host={host}
        viewer={viewer}
        large={large}
        setLarge={setLarge}
        ready={ready}
        error={error}
        state={state}
        generation={generation}
        setGeneration={setGeneration}
      />
      <DatabaseTemplate selected={selected} ready={ready} select={select} />
      <TemplateLibrary selected={selected} ready={ready} posters={posters} select={select} />
    </main>
  );
}
