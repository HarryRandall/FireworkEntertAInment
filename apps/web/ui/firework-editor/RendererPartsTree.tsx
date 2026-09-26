'use client';

import { cn } from '@/lib/utils';
import { EDITOR_PARTS } from '@showcrafter/firework-editor/parts';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import type { FireworkEditorShellTab } from './FireworkEditorShell';

type Branch = { label: string; branches: Map<string, Branch>; tabs: FireworkEditorShellTab[] };

export function RendererPartsTree({
  tabs,
  selected,
  onSelect,
}: {
  tabs: FireworkEditorShellTab[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const root: Branch = { label: '', branches: new Map(), tabs: [] };
  for (const tab of tabs) {
    let branch = root;
    for (const label of EDITOR_PARTS[tab.id]?.path ?? ['Settings']) {
      let child = branch.branches.get(label);
      if (!child) {
        child = { label, branches: new Map(), tabs: [] };
        branch.branches.set(label, child);
      }
      branch = child;
    }
    branch.tabs.push(tab);
  }
  function contents(branch: Branch) {
    return (
      <>
        {[...branch.branches.values()]
          .sort(
            (a, b) =>
              [
                'Launch',
                'Burst',
                'Trails',
                'Extra effects',
                'Timing',
                'Sound',
                'Utilities',
              ].indexOf(a.label) -
              [
                'Launch',
                'Burst',
                'Trails',
                'Extra effects',
                'Timing',
                'Sound',
                'Utilities',
              ].indexOf(b.label),
          )
          .map((child) => (
            <details key={child.label} open className="group/part">
              <summary className="text-foreground hover:bg-muted flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold">
                <ChevronRight
                  size={12}
                  className="transition-transform group-open/part:rotate-90"
                />
                {child.label}
              </summary>
              <div className="border-border ml-2 border-l pl-1">{contents(child)}</div>
            </details>
          ))}
        {branch.tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-current={tab.id === selected ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2',
              tab.id === selected
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span>{EDITOR_PARTS[tab.id]?.label ?? tab.label}</span>
            {tab.invalid ? (
              <AlertTriangle
                size={12}
                className="text-status-danger shrink-0"
                role="img"
                aria-label="Invalid settings"
              />
            ) : null}
            {tab.dirty ? (
              <span
                className="bg-primary size-1.5 shrink-0 rounded-full"
                aria-label="Unsaved changes"
              />
            ) : null}
            {tab.enabled === false ? (
              <span className="text-muted-foreground text-[10px]">Off</span>
            ) : null}
          </button>
        ))}
      </>
    );
  }
  return (
    <nav aria-label="Firework parts" className="space-y-0.5 p-2">
      {contents(root)}
    </nav>
  );
}
