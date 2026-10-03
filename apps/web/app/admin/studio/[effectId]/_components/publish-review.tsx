/** Publish review exposes all authored changes and real catalogue dependencies. */
'use client';
import { useState } from 'react';
import type { Design } from '@showcrafter/fireworks';
import type { CatalogueUsage } from '@/lib/catalogue/types';
import { Modal } from '@/ui/kit/overlays';
import { Button } from '@/ui/primitives/button';
import { ReviewSummary } from './review-summary';
import { useStudioChecks } from './use-studio-checks';

/** Requires a passing measurement before publish; review requests can carry advisory warnings. */
export function PublishReview({
  document,
  published,
  title,
  number,
  usage,
  busy,
  error,
  onFinish,
}: {
  document: Design;
  published: Design | null;
  title: string;
  number: number;
  usage: CatalogueUsage[];
  busy: boolean;
  error: string;
  onFinish: (operation: 'publish' | 'review', note: string) => void;
}) {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const peak = useStudioChecks(document);
  const allowed = peak?.kind === 'ready' && !peak.peak.exceeded;
  return (
    <Modal
      title={`Publish ${title}`}
      description={`Version ${String(number)} replaces the published design everywhere it is used.`}
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
      wide
      trigger={
        <Button
          disabled={busy}
          onClick={() => {
            setOpen(true);
          }}
        >
          Review and publish
        </Button>
      }
    >
      <ReviewSummary
        document={document}
        published={published}
        title={title}
        usage={usage}
        peak={peak}
      />
      <label className="grid gap-2 text-sm">
        What changed
        <textarea
          className="border-input bg-background rounded-md border p-2"
          rows={2}
          value={note}
          disabled={busy}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </label>
      {error !== '' && <p role="alert">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            onFinish('review', note);
          }}
        >
          Ask for review
        </Button>
        <Button
          disabled={busy || !allowed}
          onClick={() => {
            onFinish('publish', note);
          }}
        >
          {busy ? 'Working...' : `Publish version ${String(number)}`}
        </Button>
      </div>
    </Modal>
  );
}
