/** Admins render stale catalogue posters in a serial browser queue with visible progress. */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { RENDERER_VERSION } from '@showcrafter/fireworks';
import { renderVersionPosters, type PosterTask } from '@/lib/studio/render-posters';
import { runPosterQueue, type PosterOutcome } from '@/lib/studio/poster-queue';
import { DataGrid } from '@/ui/kit/data-grid';
import { Button } from '@/ui/primitives/button';

interface QueueRow {
  id: string;
  name: string;
  kind: string;
  number: number;
  status: string;
  message: string;
}
const columns: ColumnDef<QueueRow>[] = [
  { accessorKey: 'name', header: 'Firework or product' },
  { accessorKey: 'kind', header: 'Kind' },
  { accessorKey: 'number', header: 'Version' },
  { accessorKey: 'status', header: 'Posters' },
  {
    accessorKey: 'message',
    header: 'Failure',
    cell: ({ row }) => (
      <span className="break-words whitespace-normal">{row.original.message}</span>
    ),
  },
];
/** Runs one version at a time and retains failures for an explicit retry, without server WebGL. */
export function PosterQueue({ tasks, editable }: { tasks: PosterTask[]; editable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<PosterOutcome[]>([]);
  const [progress, setProgress] = useState('');
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);
  const remaining = tasks.filter(
    (task) => !outcomes.some((row) => row.id === task.id && row.status === 'ready'),
  );
  const isCancelled = () => cancelled.current;
  async function start(batch = remaining) {
    if (busy || !editable) return;
    cancelled.current = false;
    setBusy(true);
    try {
      await runPosterQueue(
        batch,
        async (task) => {
          setProgress(`Rendering ${task.name} · version ${String(task.number)}`);
          await renderVersionPosters(task);
        },
        (outcome) => {
          setOutcomes((current) => [...current.filter((row) => row.id !== outcome.id), outcome]);
        },
        () => cancelled.current,
      );
    } finally {
      if (!isCancelled()) {
        setBusy(false);
        setProgress('Queue complete. Failed versions can be retried.');
        router.refresh();
      }
    }
  }
  function renderTask(id: string) {
    const task = tasks.find((entry) => entry.id === id);
    if (task)
      start([task]).catch((failure: unknown) => {
        console.error('Poster retry failed', failure);
      });
  }
  const queueColumns = renderColumns(editable, busy, renderTask);
  const rows = queueRows(tasks, outcomes);
  return (
    <section aria-label="Poster render queue" className="grid min-w-0 gap-4">
      <p className="text-muted-foreground text-sm">
        Renderer {RENDERER_VERSION}. Old posters can stay visible until their replacements are
        ready.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!editable || busy || remaining.length === 0}
          onClick={() => {
            start().catch((error: unknown) => {
              console.error('Poster queue failed', error);
              setBusy(false);
              setProgress('Queue failed. Retry the remaining versions.');
            });
          }}
        >
          Re-render missing or stale posters
        </Button>
        <span role="status" aria-live="polite">
          {busy
            ? progress
            : `${String(outcomes.filter((row) => row.status === 'ready').length)} completed · ${String(remaining.length)} remaining`}
        </span>
      </div>
      {busy && (
        <progress
          aria-label="Poster queue progress"
          value={outcomes.length}
          max={Math.max(1, tasks.length)}
          className="w-full"
        />
      )}
      {tasks.length === 0 ? (
        <p>All published posters are up to date.</p>
      ) : (
        <DataGrid data={rows} columns={queueColumns} label="Posters" />
      )}
      {!busy && progress !== '' && <p role="status">{progress}</p>}
      {!editable && <p>Catalogue editor access is required to re-render posters.</p>}
    </section>
  );
}

function renderColumns(
  editable: boolean,
  busy: boolean,
  renderTask: (id: string) => void,
): ColumnDef<QueueRow>[] {
  return [
    ...columns,
    {
      id: 'actions',
      header: 'Render',
      cell: ({ row }) => (
        <Button
          data-poster-version={row.original.id}
          variant="outline"
          disabled={!editable || busy || row.original.status === 'ready'}
          onClick={() => {
            renderTask(row.original.id);
          }}
        >
          Re-render {row.original.name}
        </Button>
      ),
    },
  ];
}

function queueRows(tasks: PosterTask[], outcomes: PosterOutcome[]): QueueRow[] {
  return tasks.map((task) => {
    const outcome = outcomes.find((row) => row.id === task.id);
    return {
      id: task.id,
      name: task.name,
      kind: task.kind,
      number: task.number,
      status: outcome?.status ?? 'Missing or stale',
      message: outcome?.message ?? '',
    };
  });
}
