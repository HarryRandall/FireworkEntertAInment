'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Maximize2, PanelRightClose, Play, Repeat, RotateCcw, Save, Undo2 } from 'lucide-react';
import { PreviewFullscreenBackdrop } from '@/app/components/admin/previewFullscreen';
import {
  ReplayTransportControls,
  type ReplayTransportTick,
} from '@/app/components/app/ReplayTransportControls';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { InlineAlert } from '@/app/components/ui/Feedback';
import { cn } from '@/lib/utils';

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
};

export type EditorPreviewTick = ReplayTransportTick;

const PREVIEW_TRANSPORT_IDLE_MS = 2000;

/** Overlay banner shown while previewing an earlier saved version inside the editor stage. */
export function EditorVersionPreviewNotice({
  summary,
  onExit,
}: {
  summary: string;
  onExit: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--hl)] bg-black/60 p-3 text-sm text-white shadow-lg">
      <div className="min-w-0">
        <p className="font-semibold">Viewing earlier version</p>
        <p className="truncate text-white/68">{summary}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="border-white/15 bg-white/8 text-white hover:bg-white/14 hover:text-white"
        onClick={onExit}
      >
        Live version
      </Button>
    </div>
  );
}

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
  isLooping: boolean;
  fullscreen?: boolean;
  loading?: boolean;
  loadingProgress?: number | null;
  ticks?: EditorPreviewTick[];
  onPlayPause: () => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onFullscreenToggle?: () => void;
  onScrub: (seconds: number) => void;
  onScrubEnd?: () => void;
}) {
  if (loading) {
    return (
      <EditorPreviewTransportLoading
        hasLoop={Boolean(onLoopToggle)}
        hasFullscreen={Boolean(onFullscreenToggle)}
      />
    );
  }

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

function EditorPreviewTransportLoading({
  hasLoop,
  hasFullscreen,
}: {
  hasLoop: boolean;
  hasFullscreen: boolean;
}) {
  return (
    <div
      className="mx-auto flex w-[calc(100%_-_2rem)] max-w-[620px] items-center gap-2 rounded-xl border border-white/12 bg-black/55 px-4 py-3 text-white shadow-[var(--shadow-modal)] backdrop-blur-md"
      aria-label="Loading preview controls"
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-black shadow-[var(--shadow-cta)]">
        <Play size={17} className="translate-x-0.5" fill="currentColor" strokeWidth={2.5} />
      </div>
      <div className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white">
        <RotateCcw size={15} strokeWidth={2} />
      </div>
      {hasLoop ? (
        <div className="grid size-10 shrink-0 place-items-center rounded-full border border-transparent bg-[color:var(--hl,#10b981)] text-black">
          <Repeat size={15} strokeWidth={2} />
        </div>
      ) : null}

      <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <span className="min-w-[2.55rem] text-right font-mono text-[11px] text-white/75 tabular-nums">
          0:00
        </span>
        <div className="relative flex h-7 min-w-0 items-center rounded-full">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/90" />
          {[28, 54, 82].map((left) => (
            <span
              key={left}
              className="absolute top-1/2 z-20 flex h-5 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm"
              style={{ left: `${left}%` }}
              aria-hidden
            >
              <span className="h-4 w-px rounded-full bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,.42)]" />
            </span>
          ))}
          <span
            className="absolute top-1/2 left-0 z-30 size-4 -translate-y-1/2 rounded-full border-2 border-[color:var(--hl,#10b981)] bg-white shadow-[0_1px_6px_rgba(0,0,0,.45)]"
            aria-hidden
          />
        </div>
        <span className="min-w-[2.55rem] font-mono text-[11px] text-white/75 tabular-nums">
          0:05
        </span>
      </div>

      {hasFullscreen ? (
        <div className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white">
          <Maximize2 size={15} strokeWidth={2} />
        </div>
      ) : null}
    </div>
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
  onSave: () => void;
  onRevert: () => void;
  activeTab: string;
  onActiveTabChange: (tabId: string) => void;
  tabs: FireworkEditorShellTab[];
  preview: ReactNode;
  transport: ReactNode;
  transportPlaying?: boolean;
  error?: string | null;
  previewNotice?: ReactNode;
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
};

export function FireworkEditorShell({
  title,
  subtitle,
  chips = [],
  palette = [],
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
  transportPlaying = false,
  error,
  previewNotice,
  fullscreen,
  onExitFullscreen,
}: FireworkEditorShellProps) {
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const [transportActive, setTransportActive] = useState(true);
  const transportIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const utilityTabIds = new Set(['history', 'json']);
  const primaryTabs = tabs.filter((tab) => !utilityTabIds.has(tab.id));
  const utilityTabs = tabs.filter((tab) => utilityTabIds.has(tab.id));
  const visibleChips = chips.filter((chip) => chip.value);
  const hasMetadata = visibleChips.length > 0 || palette.length > 0 || Boolean(subtitle);
  const transportVisible = !transportPlaying || transportActive;

  useEffect(() => {
    if (transportIdleTimer.current) clearTimeout(transportIdleTimer.current);
    setTransportActive(true);

    if (transportPlaying) {
      transportIdleTimer.current = setTimeout(
        () => setTransportActive(false),
        PREVIEW_TRANSPORT_IDLE_MS,
      );
    }

    return () => {
      if (transportIdleTimer.current) clearTimeout(transportIdleTimer.current);
    };
  }, [transportPlaying]);

  function wakePreviewTransport() {
    if (!transportPlaying) {
      setTransportActive(true);
      return;
    }

    setTransportActive(true);
    if (transportIdleTimer.current) clearTimeout(transportIdleTimer.current);
    transportIdleTimer.current = setTimeout(
      () => setTransportActive(false),
      PREVIEW_TRANSPORT_IDLE_MS,
    );
  }

  function handleRailTabClick(tab: FireworkEditorShellTab) {
    if (currentTab?.id === tab.id) {
      setInspectorCollapsed((collapsed) => !collapsed);
      return;
    }

    setInspectorCollapsed(false);
    onActiveTabChange(tab.id);
  }

  function renderRailTab(tab: FireworkEditorShellTab) {
    const Icon = tab.icon;
    const isCurrentTab = currentTab?.id === tab.id;
    const selected = isCurrentTab && !inspectorCollapsed;
    return (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-label={tab.label}
        aria-selected={selected}
        aria-expanded={isCurrentTab ? !inspectorCollapsed : undefined}
        title={tab.label}
        onClick={() => handleRailTabClick(tab)}
        className={cn(
          'focus-visible:ring-ring/55 relative flex h-[46px] min-w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border px-2 text-center transition outline-none focus-visible:ring-2 lg:h-11 lg:w-11 lg:min-w-11 lg:px-1',
          selected
            ? 'border-[color:var(--hl)] bg-[color:var(--hl-soft)] text-[color:var(--hl-ink)]'
            : inspectorCollapsed
              ? 'border-transparent bg-transparent text-[color:var(--color-content-subtle)] hover:bg-transparent hover:text-[color:var(--color-content-emphasis)]'
              : 'border-transparent text-[color:var(--color-content-subtle)] hover:border-[color:var(--color-border-subtle)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]',
        )}
      >
        <Icon size={16} />
        <span className="max-h-[1.1rem] max-w-full overflow-hidden text-[8.5px] leading-[1.05] font-semibold tracking-normal">
          {tab.label}
        </span>
      </button>
    );
  }

  return (
    <Card
      bordered={false}
      radius="lg"
      className="h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-none bg-transparent p-0 shadow-none"
    >
      <div
        className={cn(
          'grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(360px,408px)]',
          inspectorCollapsed && 'lg:grid-cols-[minmax(0,1fr)_60px]',
        )}
      >
        <section
          className={cn(
            'bg-stage-night min-w-0 overflow-hidden text-white',
            fullscreen
              ? 'fixed inset-[5vmin] z-[100] rounded-2xl border border-white/12 shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)]'
              : 'relative min-h-[520px] lg:min-h-0',
          )}
          onFocusCapture={wakePreviewTransport}
          onPointerDown={wakePreviewTransport}
          onPointerMove={wakePreviewTransport}
        >
          <div className="absolute inset-0 z-0">{preview}</div>

          {!fullscreen ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 px-4 pt-6 pb-4 sm:px-5 sm:pb-5">
              <div
                className={cn(
                  'flex flex-wrap items-start gap-3 pr-16 sm:pr-[4.5rem]',
                  hasMetadata ? 'justify-between' : 'justify-end',
                )}
              >
                {hasMetadata ? (
                  <div
                    className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-2"
                    aria-label={dirty ? `${title} has unsaved changes` : title}
                  >
                    {visibleChips.map((chip) => {
                      const Icon = chip.icon;
                      return (
                        <span
                          key={chip.label}
                          className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/14 bg-white/9 px-2.5 text-xs font-semibold text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-md"
                          aria-label={`${chip.label} ${chip.value}`}
                        >
                          {Icon ? (
                            <Icon size={13} className="shrink-0 text-white/58" aria-hidden />
                          ) : (
                            <span className="text-xs font-medium text-white/46">{chip.label}</span>
                          )}
                          <span className="font-mono tabular-nums">{chip.value}</span>
                        </span>
                      );
                    })}
                    {palette.length > 0 ? (
                      <span className="flex h-7 items-center gap-1.5" aria-label="Palette">
                        {palette.slice(0, 6).map((colour, index) => (
                          <span
                            key={`${colour}-${index}`}
                            className="size-3.5 rounded-full border border-white/30 shadow-[0_0_12px_rgba(255,255,255,.12)]"
                            style={{ backgroundColor: colour }}
                            aria-hidden
                          />
                        ))}
                      </span>
                    ) : null}
                    {subtitle ? <span className="sr-only">{subtitle}</span> : null}
                  </div>
                ) : null}
                <div className="pointer-events-auto flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 rounded-lg border-white/15 bg-white/8 px-3 text-xs text-white backdrop-blur-md hover:bg-white/14 hover:text-white"
                    disabled={revertDisabled || saving}
                    onClick={onRevert}
                  >
                    <Undo2 size={14} />
                    Revert
                  </Button>
                  <Button
                    loading={saving}
                    disabled={saveDisabled}
                    onClick={onSave}
                    className="text-hl-contrast h-9 rounded-lg bg-[color:var(--hl)] px-4 text-xs font-semibold hover:bg-[color:var(--hl)]/85"
                  >
                    <Save size={14} />
                    {saveLabel}
                  </Button>
                </div>
              </div>
              {previewNotice ? <div className="pointer-events-auto">{previewNotice}</div> : null}
            </div>
          ) : null}

          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bottom-5 z-30 transition-all duration-300',
              transportVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            <div className={transportVisible ? 'pointer-events-auto' : 'pointer-events-none'}>
              {transport}
            </div>
          </div>

          {fullscreen && onExitFullscreen ? (
            <PreviewFullscreenBackdrop onExit={onExitFullscreen} />
          ) : null}
        </section>

        <aside
          className={cn(
            'grid min-h-0 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] lg:grid-cols-[minmax(0,1fr)_60px] lg:border-t-0 lg:border-l',
            inspectorCollapsed && 'lg:grid-cols-[60px]',
          )}
        >
          <div
            className={cn(
              'order-1 flex min-h-0 min-w-0 gap-1 overflow-x-auto border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-2 lg:order-2 lg:flex-col lg:items-center lg:gap-1 lg:overflow-x-visible lg:border-b-0 lg:px-1.5 lg:py-2.5',
              inspectorCollapsed ? 'lg:border-l-0' : 'lg:border-l',
            )}
          >
            <div className="relative min-h-0 flex-1 lg:w-full">
              <nav
                className="no-scrollbar flex min-h-0 min-w-0 gap-1 overflow-x-auto lg:h-full lg:w-full lg:flex-col lg:items-center lg:overflow-x-visible lg:overflow-y-auto lg:pb-2"
                aria-label="Editor sections"
                role="tablist"
              >
                {primaryTabs.map(renderRailTab)}
              </nav>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-4 bg-gradient-to-b from-[color:var(--color-bg-muted)] to-transparent lg:block"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-6 bg-gradient-to-t from-[color:var(--color-bg-muted)] to-transparent lg:block"
                aria-hidden
              />
            </div>
            {utilityTabs.length > 0 ? (
              <div
                className="hidden shrink-0 lg:flex lg:w-full lg:flex-col lg:items-center lg:gap-1"
                aria-hidden={false}
              >
                <div
                  className="mb-1 h-px w-full shrink-0 bg-[color:var(--color-border-subtle)]"
                  aria-hidden
                />
                {utilityTabs.map(renderRailTab)}
              </div>
            ) : null}
            {utilityTabs.length > 0 ? (
              <div className="flex shrink-0 gap-1 lg:hidden" role="presentation">
                {utilityTabs.map(renderRailTab)}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              'order-2 flex min-h-0 flex-col lg:order-1',
              inspectorCollapsed && 'hidden',
            )}
          >
            <div className="border-b border-[color:var(--color-border-subtle)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-[0.16em] text-[color:var(--color-content-subtle)] uppercase">
                    {currentTab?.eyebrow ?? currentTab?.label}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-normal text-[color:var(--color-content-emphasis)]">
                    {currentTab?.title}
                  </h2>
                  {currentTab?.description ? (
                    <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-content-muted)]">
                      {currentTab.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Collapse editor controls"
                  title="Collapse controls"
                  onClick={() => setInspectorCollapsed(true)}
                  className="focus-visible:ring-ring/55 hidden size-[30px] shrink-0 place-items-center rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-muted)] transition hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)] focus-visible:ring-2 focus-visible:outline-none lg:grid"
                >
                  <PanelRightClose size={15} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              {error ? (
                <InlineAlert tone="danger" title="Could not save" className="mb-5">
                  {error}
                </InlineAlert>
              ) : null}
              {currentTab?.content}
            </div>
          </div>
        </aside>
      </div>
    </Card>
  );
}
