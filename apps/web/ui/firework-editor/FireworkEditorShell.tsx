'use client';

import { cn } from '@/lib/utils';
import { PreviewFullscreenBackdrop } from '@/ui/firework-editor/previewFullscreen';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { Sheet, SheetContent, SheetTitle } from '@/ui/primitives/sheet';
import {
  ReplayTransportControls,
  type ReplayTransportTick,
} from '@/ui/replay/ReplayTransportControls';
import { EDITOR_PARTS } from '@showcrafter/firework-editor/parts';
import type { DraftHistoryControls } from '@showcrafter/firework-editor/use-draft-history';
import type { LucideIcon } from 'lucide-react';
import { ListTree, Redo2, Save, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { RendererPartsTree } from './RendererPartsTree';

export type FireworkEditorShellChip = {
  label: string;
  value: string | null;
  icon?: LucideIcon;
};

export type FireworkEditorShellTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  content: ReactNode;
  dirty?: boolean;
  enabled?: boolean;
};

export type EditorPreviewTick = ReplayTransportTick;

export function EditorPreviewTransport({
  elapsed,
  duration,
  isPlaying,
  isLooping,
  fullscreen,
  loading = false,
  ticks = [],
  onPlayPause,
  onReset,
  onLoopToggle,
  onFullscreenToggle,
  onScrub,
  onScrubEnd,
}: {
  elapsed: number;
  duration: number;
  isPlaying: boolean;
  isLooping?: boolean;
  fullscreen?: boolean;
  loading?: boolean;
  loadingProgress?: number | null;
  ticks?: EditorPreviewTick[];
  onPlayPause: () => void;
  onReset: () => void;
  onLoopToggle?: () => void;
  onFullscreenToggle?: () => void;
  onScrub: (seconds: number) => void;
  onScrubEnd?: () => void;
}) {
  if (loading) return null;

  return (
    <ReplayTransportControls
      elapsed={elapsed}
      duration={duration}
      isPlaying={isPlaying}
      isLooping={isLooping}
      fullscreen={fullscreen}
      ticks={ticks}
      onPlayPause={onPlayPause}
      onReset={onReset}
      onLoopToggle={onLoopToggle}
      onFullscreenToggle={onFullscreenToggle}
      onScrub={onScrub}
      onScrubEnd={onScrubEnd}
    />
  );
}

type FireworkEditorShellProps = {
  title: string;
  eyebrow?: string | null;
  subtitle?: string | null;
  chips?: FireworkEditorShellChip[];
  palette?: string[];
  dirty: boolean;
  saving: boolean;
  saveLabel: string;
  saveDisabled?: boolean;
  revertDisabled?: boolean;
  history?: DraftHistoryControls;
  comparison?: { saved: boolean; onChange: (saved: boolean) => void };
  onSave: () => void;
  onRevert: () => void;
  activeTab: string;
  onActiveTabChange: (tabId: string) => void;
  tabs: FireworkEditorShellTab[];
  preview: ReactNode;
  transport: ReactNode;
  transportPlaying?: boolean;
  error?: string | null;
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
};

export function FireworkEditorShell({
  title,
  dirty,
  saving,
  saveLabel,
  saveDisabled,
  revertDisabled,
  onSave,
  onRevert,
  activeTab,
  onActiveTabChange,
  tabs,
  preview,
  transport,
  error,
  fullscreen,
  onExitFullscreen,
  history,
  comparison,
}: FireworkEditorShellProps) {
  const [partsOpen, setPartsOpen] = useState(false);
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const part = current ? EDITOR_PARTS[current.id] : null;
  const select = (id: string) => {
    onActiveTabChange(id);
    setPartsOpen(false);
  };
  const commit = () => {
    window.setTimeout(() => history?.commit(), 0);
  };
  return (
    <Card
      bordered={false}
      radius="lg"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none p-0 shadow-none"
    >
      <div className="border-border bg-background flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setPartsOpen(true)}
          >
            <ListTree size={16} />
            Parts
          </Button>
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground text-xs" aria-live="polite">
            {saving ? 'Saving' : dirty ? 'Unsaved changes' : 'Saved'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {comparison ? (
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={comparison.saved}
              onClick={() => comparison.onChange(!comparison.saved)}
            >
              {comparison.saved ? 'Viewing saved' : 'Viewing draft'}
            </Button>
          ) : null}
          {history ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={!history.canUndo || saving}
                onClick={history.undo}
                title="Undo (⌘Z)"
              >
                <Undo2 size={15} />
                Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!history.canRedo || saving}
                onClick={history.redo}
                title="Redo (⇧⌘Z)"
              >
                <Redo2 size={15} />
                Redo
              </Button>
            </>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            disabled={revertDisabled || saving}
            onClick={onRevert}
          >
            Revert to saved
          </Button>
          <Button size="sm" disabled={saveDisabled || saving} onClick={onSave}>
            <Save size={15} />
            {saveLabel}
          </Button>
        </div>
      </div>
      <div
        className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)_168px] lg:overflow-hidden"
        onKeyDownCapture={(event) => {
          const input =
            event.target instanceof HTMLElement &&
            (event.target.matches('input, textarea') || event.target.isContentEditable);
          if (
            !input &&
            (event.metaKey || event.ctrlKey) &&
            event.key.toLowerCase() === 'z' &&
            !saving
          ) {
            event.preventDefault();
            if (event.shiftKey) history?.redo();
            else history?.undo();
          }
          if (event.key === 'Escape') history?.cancel();
        }}
      >
        <section
          className={cn(
            'bg-stage-night relative min-h-[320px] min-w-0 overflow-hidden text-white lg:min-h-0',
            fullscreen && 'fixed inset-[5vmin] z-[100] rounded-xl',
          )}
        >
          <div className="absolute inset-0">{preview}</div>
          <div className="absolute inset-x-0 bottom-5 z-30">{transport}</div>
          {fullscreen && onExitFullscreen ? (
            <PreviewFullscreenBackdrop onExit={onExitFullscreen} />
          ) : null}
        </section>
        <aside
          className="border-border bg-background flex min-h-0 min-w-0 flex-col border-t lg:border-t-0 lg:border-l"
          onPointerDownCapture={(event) => {
            if ((event.target as HTMLElement).closest('[role="slider"], input[type="range"]'))
              history?.begin('Adjust setting');
          }}
          onPointerUpCapture={commit}
          onPointerCancelCapture={() => history?.cancel()}
          onFocusCapture={(event) => {
            if ((event.target as HTMLElement).matches('input, textarea'))
              history?.begin('Edit value');
          }}
          onBlurCapture={commit}
          onKeyDownCapture={(event) => {
            if (
              (event.target as HTMLElement).closest('[role="slider"]') &&
              event.key.startsWith('Arrow')
            )
              history?.begin('Adjust setting');
          }}
          onKeyUpCapture={(event) => {
            if (event.key.startsWith('Arrow')) commit();
          }}
        >
          <div className="border-border border-b p-4">
            <p className="text-muted-foreground text-xs">
              {part?.path.join(' / ') ?? current?.eyebrow}
            </p>
            <h2 className="mt-1 text-base font-semibold">{part?.label ?? current?.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {part?.description ?? current?.description}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {error ? (
              <InlineAlert tone="danger" title="Could not save" className="mb-5">
                {error}
              </InlineAlert>
            ) : null}
            {current ? (
              <div key={current.id} role="region" aria-label={current.label}>
                {current.content}
              </div>
            ) : null}
          </div>
        </aside>
        <aside className="border-border bg-background hidden overflow-y-auto border-l lg:block">
          <RendererPartsTree tabs={tabs} selected={current?.id ?? ''} onSelect={select} />
        </aside>
      </div>
      <Sheet open={partsOpen} onOpenChange={setPartsOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetTitle className="px-5 pt-5">Firework parts</SheetTitle>
          <RendererPartsTree tabs={tabs} selected={current?.id ?? ''} onSelect={select} />
        </SheetContent>
      </Sheet>
    </Card>
  );
}
