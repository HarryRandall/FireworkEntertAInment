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
import { sectionForField } from '@showcrafter/firework-editor/sections';
import type { DraftHistoryControls } from '@showcrafter/firework-editor/use-draft-history';
import type { LucideIcon } from 'lucide-react';
import { ListTree, MoreHorizontal, Redo2, Save, Undo2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu';
import { RendererPartsTree } from './RendererPartsTree';
import { RendererDiagnostics, type EditorRenderDiagnostics } from './RendererDiagnostics';

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
  invalid?: boolean;
  revert?: { disabled: boolean; onRevert: () => void };
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
  renderDiagnostics?: EditorRenderDiagnostics;
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
  renderDiagnostics,
  fullscreen,
  onExitFullscreen,
  history,
  comparison,
}: FireworkEditorShellProps) {
  const [partsOpen, setPartsOpen] = useState(false);
  const current = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const invalidParts = new Set(
    renderDiagnostics?.issues.map((issue) => sectionForField(issue.path)),
  );
  const navigationTabs = tabs.map((tab) => ({ ...tab, invalid: invalidParts.has(tab.id) }));
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
      <h1 className="sr-only">{title}</h1>
      <div
        className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_256px_168px] lg:overflow-hidden"
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
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {renderDiagnostics ? (
              <RendererDiagnostics
                key={renderDiagnostics.recordId}
                {...renderDiagnostics}
                availableParts={tabs.map((tab) => tab.id)}
                onSelect={select}
              />
            ) : null}
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
          <RendererPartsTree tabs={navigationTabs} selected={current?.id ?? ''} onSelect={select} />
        </aside>
      </div>
      <footer className="border-border bg-background flex shrink-0 items-center gap-2 border-t px-3 py-2">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setPartsOpen(true)}>
          <ListTree size={16} /> Parts
        </Button>
        <span className="text-muted-foreground mr-auto text-xs" aria-live="polite">
          {saving ? 'Saving...' : dirty ? 'Unsaved changes' : 'Saved'}
          {comparison?.saved ? ' · Previewing saved' : ''}
        </span>
        {history ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              disabled={!history.canUndo || saving}
              onClick={history.undo}
              aria-label="Undo"
              title="Undo (⌘Z)"
            >
              <Undo2 size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              disabled={!history.canRedo || saving}
              onClick={history.redo}
              aria-label="Redo"
              title="Redo (⇧⌘Z)"
            >
              <Redo2 size={16} />
            </Button>
          </>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0" aria-label="Editor actions">
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {comparison ? (
              <DropdownMenuItem onSelect={() => comparison.onChange(!comparison.saved)}>
                {comparison.saved ? 'Preview draft' : 'Preview saved'}
              </DropdownMenuItem>
            ) : null}
            {current?.revert ? (
              <DropdownMenuItem
                disabled={current.revert.disabled || saving}
                onSelect={current.revert.onRevert}
              >
                Revert section to saved
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled={revertDisabled || saving} onSelect={onRevert}>
              Revert all to saved
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="sm"
          disabled={saveDisabled || saving || Boolean(renderDiagnostics?.issues.length)}
          onClick={onSave}
        >
          <Save size={15} />
          {saveLabel}
        </Button>
      </footer>
      <Sheet open={partsOpen} onOpenChange={setPartsOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetTitle className="px-5 pt-5">Firework parts</SheetTitle>
          <RendererPartsTree tabs={navigationTabs} selected={current?.id ?? ''} onSelect={select} />
        </SheetContent>
      </Sheet>
    </Card>
  );
}
