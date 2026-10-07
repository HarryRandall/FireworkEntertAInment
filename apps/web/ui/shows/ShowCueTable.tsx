'use client';

/** Compact cue list, isolated from the replay canvas and transport. */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';
import type { ReplayCue } from '@/lib/show-domain';
import { Button } from '@/ui/patterns/Button';
import { RowActionsMenu } from '@/ui/patterns/RowActionsMenu';
import { SelectField } from '@/ui/patterns/SelectField';
import { TablePagination } from '@/ui/patterns/TablePagination';
import { Badge } from '@/ui/primitives/badge';
import {
  DataTableShell,
  tableClasses,
  tableHeadClasses,
  tableHeaderCellClasses,
  tableCellClasses,
  tableRowClasses,
} from '@/ui/patterns/DataTable';
import { cn } from '@/lib/utils';
import { formatCueTime } from './show-display';

// Keep enough cues visible for review without mounting the entire show at once.
const DEFAULT_CUE_PAGE_SIZE = 25;
const CUE_PAGE_OPTIONS = [
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
];
const MORTAR_LABELS = ['Left', 'Centre', 'Right'];

type BuilderRow = { cue: ReplayCue; baseCueId: string; shotCount: number; endTimeSeconds: number };
type Props = {
  builderCues: BuilderRow[];
  productNameById: Map<string, string>;
  activeBaseCueIds: Set<string>;
  canEditFireworks: boolean;
  hasFireworkSpecifications: boolean;
  isPending: boolean;
  deletingCueId: string | null;
  playFrom: (time: number) => void;
  seekTo: (time: number, resume: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setInsertBeforeTime: (time: number) => void;
  openCueDialog: (tab: 'manual' | 'ai') => void;
  requestCueDeletion: (target: { cueId: string; fireworkName: string; timeLabel: string }) => void;
};

/** Show readable cue times and catalogue names with compact registry actions. */
export function ShowCueTable({
  builderCues,
  productNameById,
  activeBaseCueIds,
  canEditFireworks,
  hasFireworkSpecifications,
  isPending,
  deletingCueId,
  playFrom,
  seekTo,
  setIsPlaying,
  setInsertBeforeTime,
  openCueDialog,
  requestCueDeletion,
}: Props) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_CUE_PAGE_SIZE);
  const activeIndex = builderCues.findIndex((row) => activeBaseCueIds.has(row.baseCueId));
  useEffect(() => {
    if (activeIndex >= 0) setPage(Math.floor(activeIndex / pageSize) + 1);
  }, [activeIndex, pageSize]);
  const totalPages = Math.max(1, Math.ceil(builderCues.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = builderCues.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <div className="min-w-0 space-y-3 [--cue-table-height:35rem]">
      <div className="space-y-3">
        {builderCues.length > 0 ? (
          <div>
            <DataTableShell className="[&>div>div]:max-h-(--cue-table-height) [&>div>div]:overflow-y-auto">
              <table className={tableClasses('min-w-[520px] table-fixed')}>
                <colgroup>
                  <col className="w-[88px]" />
                  <col />
                  <col className="w-[110px]" />
                  <col className="w-[56px]" />
                </colgroup>
                <thead className={tableHeadClasses()}>
                  <tr>
                    <th className={tableHeaderCellClasses()}>Time</th>
                    <th className={tableHeaderCellClasses()}>Firework</th>
                    <th className={tableHeaderCellClasses()}>Mortar</th>
                    <th className={tableHeaderCellClasses('text-right')}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const { cue, baseCueId, shotCount } = row;
                    const mortarLabel =
                      MORTAR_LABELS[cue.launchPositionIndex] ??
                      `Mortar ${cue.launchPositionIndex + 1}`;
                    const fireworkName = productNameById.get(cue.productId) ?? cue.firework.name;
                    const cueTimeLabel = formatCueTime(cue.timeSeconds);
                    const isActive = activeBaseCueIds.has(baseCueId);
                    return (
                      <tr
                        key={baseCueId}
                        // Selecting a row plays the show live from that cue
                        // (the same as the row menu's "Play from here"). The
                        // time button and actions menu stop propagation so
                        // they keep their own seek/menu behaviour.
                        onClick={() => playFrom(cue.timeSeconds)}
                        title="Play from here"
                        className={tableRowClasses(
                          cn(
                            'cursor-pointer',
                            isActive && 'bg-muted shadow-[inset_3px_0_0_0_var(--primary)]',
                          ),
                        )}
                      >
                        <td className={tableCellClasses('py-2')}>
                          <Button
                            type="button"
                            aria-label={`Seek to ${fireworkName} at ${cueTimeLabel}`}
                            aria-current={isActive ? 'true' : undefined}
                            onClick={(event) => {
                              event.stopPropagation();
                              setIsPlaying(false);
                              seekTo(cue.timeSeconds, false);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground -ml-3 tabular-nums"
                          >
                            {cueTimeLabel}
                          </Button>
                        </td>
                        <td className={tableCellClasses('py-2')}>
                          <div className="font-medium break-words whitespace-normal">
                            {fireworkName}
                          </div>
                          {shotCount > 1 && (
                            <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-widest uppercase">
                              {shotCount} shots
                            </div>
                          )}
                        </td>
                        <td className={tableCellClasses('py-2')}>
                          <Badge variant="secondary">{mortarLabel}</Badge>
                        </td>
                        <td
                          className={tableCellClasses('py-2 text-right')}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <RowActionsMenu
                            label="Cue actions"
                            items={[
                              {
                                label: 'Play from here',
                                icon: <Play size={14} strokeWidth={2} />,
                                onSelect: () => playFrom(cue.timeSeconds),
                              },
                              ...(canEditFireworks
                                ? [
                                    {
                                      label: 'Edit firework',
                                      icon: <Pencil size={14} strokeWidth={2} />,
                                      onSelect: () =>
                                        router.push(`/admin/fireworks/${cue.firework.id}`),
                                    },
                                  ]
                                : []),
                              {
                                label: 'Insert firework above',
                                icon: <Plus size={14} strokeWidth={2} />,
                                disabled: !hasFireworkSpecifications,
                                onSelect: () => {
                                  setInsertBeforeTime(cue.timeSeconds);
                                  openCueDialog('manual');
                                },
                              },
                              {
                                label: 'Delete cue',
                                icon: <Trash2 size={14} strokeWidth={2} />,
                                destructive: true,
                                disabled: isPending || deletingCueId !== null,
                                onSelect: () =>
                                  requestCueDeletion({
                                    cueId: baseCueId,
                                    fireworkName,
                                    timeLabel: cueTimeLabel,
                                  }),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableShell>
          </div>
        ) : (
          <DataTableShell className="[&>div>div]:max-h-(--cue-table-height) [&>div>div]:overflow-y-auto">
            <div className="text-muted-foreground px-4 py-8 text-center text-sm">
              No cues yet. Add your first firework above to make the preview playable.
            </div>
          </DataTableShell>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SelectField
          ariaLabel="Cues per page"
          value={String(pageSize)}
          options={CUE_PAGE_OPTIONS}
          onChange={(value) => {
            setPageSize(Number(value));
            setPage(1);
          }}
          className="h-9 w-36"
        />
        <TablePagination
          currentPage={safePage}
          totalPages={totalPages}
          searchParams={{}}
          onPageChange={setPage}
          pageSize={pageSize}
          totalItems={builderCues.length}
          visibleItems={visibleRows.length}
          itemLabel="cue"
        />
      </div>
    </div>
  );
}
