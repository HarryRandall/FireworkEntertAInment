'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { PanelRightClose, Pause, Play, Repeat, RotateCcw, Save, Undo2 } from 'lucide-react';
import { PreviewFullscreenBackdrop } from '@/app/components/admin/previewFullscreen';
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

export type EditorPreviewTick = {
  timeSeconds: number;
  label: string;
};

export function EditorPreviewTransport({
  elapsed,
  duration,
  isPlaying,
  isLooping,
  ticks = [],
  onPlayPause,
  onReset,
  onLoopToggle,
  onScrub,
  onScrubEnd,
}: {
  elapsed: number;
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  ticks?: EditorPreviewTick[];
  onPlayPause: () => void;
  onReset: () => void;
  onLoopToggle: () => void;
  onScrub: (seconds: number) => void;
  onScrubEnd?: () => void;
}) {
  const safeDuration = Math.max(0.1, duration);
  // The transport owns the slider thumb so a fast drag does not re-render the
  // whole editor on every input event. `localElapsed` tracks the pointer at
  // full rate while the parent's heavyweight `elapsed` state is coalesced; the
  // sync effect keeps it in step with playback when a drag is not in flight.
  const scrubbingRef = useRef(false);
  const [localElapsed, setLocalElapsed] = useState(elapsed);
  useEffect(() => {
    if (!scrubbingRef.current) setLocalElapsed(elapsed);
  }, [elapsed]);
  const safeElapsed = Math.min(safeDuration, Math.max(0, localElapsed));
  const progress = (safeElapsed / safeDuration) * 100;
  const visibleTicks = ticks.filter(
    (tick) => tick.timeSeconds > 0 && tick.timeSeconds < safeDuration,
  );

  function commitScrub() {
    scrubbingRef.current = false;
    onScrubEnd?.();
  }

  function tickKey(tick: EditorPreviewTick) {
    return `${tick.label}-${tick.timeSeconds}`;
  }

  return (
    <div className="mx-auto flex w-[min(40rem,calc(100%-3rem))] items-center gap-3 rounded-[14px] border border-white/12 bg-[#0b1020]/82 px-4 py-2.5 shadow-[0_18px_40px_-16px_rgba(0,0,0,.75)] backdrop-blur-xl">
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
        className="grid size-[42px] shrink-0 place-items-center rounded-full bg-[color:var(--hl)] text-[#05231a] shadow-[0_0_0_4px_rgba(21,189,139,.18)] transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[color:var(--hl)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1020] focus-visible:outline-none"
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset preview"
        className="grid size-8 shrink-0 place-items-center rounded-full border border-white/12 bg-transparent text-white/72 transition hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-[color:var(--hl)] focus-visible:outline-none"
      >
        <RotateCcw size={16} />
      </button>
      <span className="min-w-12 text-right font-mono text-xs text-white/58 tabular-nums">
        {formatClock(safeElapsed)}
      </span>
      <div className="group relative flex h-6 min-w-28 flex-1 items-center rounded-full outline-none select-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[color:var(--hl)] has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-[#0b1020]">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/16" />
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-[color:var(--hl)]"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
        {visibleTicks.map((tick) => (
          <button
            key={tickKey(tick)}
            type="button"
            aria-label={`Jump to ${tick.label}`}
            onClick={() => onScrub(tick.timeSeconds)}
            className="group/tick pointer-events-auto absolute top-1/2 z-20 flex h-4 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--hl)]"
            style={{ left: `${(tick.timeSeconds / safeDuration) * 100}%` }}
          >
            <span className="h-4 w-0.5 rounded-full bg-white/42" />
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md border border-white/12 bg-[#0b1020]/95 px-2 py-1 text-[10px] leading-none font-semibold whitespace-nowrap text-white/86 opacity-0 shadow-[0_10px_24px_-14px_rgba(0,0,0,.9)] backdrop-blur-sm transition-opacity duration-150 group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100">
              {tick.label}
            </span>
          </button>
        ))}
        <span
          className="absolute top-1/2 size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,.45)]"
          style={{ left: `${progress}%` }}
          aria-hidden
        />
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.05}
          value={safeElapsed}
          onChange={(event) => {
            scrubbingRef.current = true;
            const seconds = Number(event.currentTarget.value);
            setLocalElapsed(seconds);
            onScrub(seconds);
          }}
          onPointerUp={commitScrub}
          onKeyUp={commitScrub}
          aria-label="Preview timeline"
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 focus:outline-none"
        />
      </div>
      <span className="min-w-12 font-mono text-xs text-white/58 tabular-nums">
        {formatClock(safeDuration)}
      </span>
      <button
        type="button"
        onClick={onLoopToggle}
        aria-pressed={isLooping}
        aria-label={isLooping ? 'Disable looping' : 'Enable looping'}
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-[color:var(--hl)] focus-visible:outline-none',
          isLooping
            ? 'border-transparent bg-[color:var(--hl)] text-[#05231a]'
            : 'border-white/12 bg-transparent text-white/72 hover:bg-white/8 hover:text-white',
        )}
      >
        <Repeat size={16} />
      </button>
    </div>
  );
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, '0')}`;
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
  error,
  previewNotice,
  fullscreen,
  onExitFullscreen,
}: FireworkEditorShellProps) {
  const [inspectorCollapsed, setInspectorCollapsed] = useState(true);
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const utilityTabIds = new Set(['history', 'json']);
  const primaryTabs = tabs.filter((tab) => !utilityTabIds.has(tab.id));
  const utilityTabs = tabs.filter((tab) => utilityTabIds.has(tab.id));
  const visibleChips = chips.filter((chip) => chip.value);
  const hasMetadata = visibleChips.length > 0 || palette.length > 0 || Boolean(subtitle);

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
          'focus-visible:ring-ring/55 relative flex h-[46px] min-w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border px-2 text-center transition outline-none focus-visible:ring-2 lg:h-[52px] lg:w-12 lg:min-w-12 lg:px-1',
          selected
            ? 'border-[color:var(--hl)] bg-[color:var(--hl-soft)] text-[color:var(--hl-ink)]'
            : inspectorCollapsed
              ? 'border-transparent bg-transparent text-[color:var(--color-content-subtle)] hover:bg-transparent hover:text-[color:var(--color-content-emphasis)]'
              : 'border-transparent text-[color:var(--color-content-subtle)] hover:border-[color:var(--color-border-subtle)] hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]',
        )}
      >
        <Icon size={18} />
        <span className="max-h-[1.25rem] max-w-full overflow-hidden text-[9px] leading-[1.05] font-semibold tracking-normal">
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
            'min-w-0 overflow-hidden bg-[#05070d] text-white',
            fullscreen
              ? 'fixed inset-[5vmin] z-[100] rounded-2xl border border-white/12 shadow-[0_24px_60px_-20px_rgba(0,0,0,.85)]'
              : 'relative min-h-[520px] lg:min-h-0',
          )}
        >
          <div className="absolute inset-0 z-0">{preview}</div>

          {!fullscreen ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-3 p-4 sm:p-5">
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
                    className="h-9 rounded-[10px] border-white/15 bg-white/8 px-3 text-xs text-white backdrop-blur-md hover:bg-white/14 hover:text-white"
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
                    className="h-9 rounded-[10px] bg-[color:var(--hl)] px-4 text-xs font-semibold text-[#05231a] hover:bg-[color:var(--hl)]/85"
                  >
                    <Save size={14} />
                    {saveLabel}
                  </Button>
                </div>
              </div>
              {previewNotice ? <div className="pointer-events-auto">{previewNotice}</div> : null}
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30">
            <div className="pointer-events-auto">{transport}</div>
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
              'order-1 flex min-w-0 gap-1 overflow-x-auto border-b border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-2 lg:order-2 lg:flex-col lg:items-center lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:px-0 lg:py-2.5',
              inspectorCollapsed ? 'lg:border-l-0' : 'lg:border-l',
            )}
          >
            <nav
              className="flex min-w-0 gap-1 lg:min-h-0 lg:w-full lg:flex-1 lg:flex-col lg:items-center"
              aria-label="Editor sections"
              role="tablist"
            >
              {primaryTabs.map(renderRailTab)}
              <div className="hidden flex-1 lg:block" aria-hidden />
              <div
                className="hidden h-px w-full shrink-0 bg-[color:var(--color-border-subtle)] lg:block"
                aria-hidden
              />
              {utilityTabs.map(renderRailTab)}
            </nav>
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
