'use client';

/**
 * StickyTableViewport lifts a table's <thead> out of the vertical scroll area so
 * the scrollbar starts at the first body row instead of spanning the header.
 *
 * On desktop (>= md) it renders the caller's <table> inside a vertical/horizontal
 * scroll port, visually hides that table's real <thead>, and paints a cloned
 * header bar above the scroll port. The clone's column widths are measured from
 * the live body cells (which keep the design's content-based auto widths) so the
 * header and body stay aligned, and horizontal scrolling is mirrored onto it.
 *
 * Below md the table falls back to its normal sticky-header behaviour (the page
 * scrolls), so nothing here changes the mobile layout.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Properties zeroed on the real header cells so the header collapses out of the
// scroll flow while staying in the DOM/accessibility tree.
const HIDDEN_HEAD_STYLES: Array<[string, string]> = [
  ['height', '0px'],
  ['padding-top', '0px'],
  ['padding-bottom', '0px'],
  ['border-top-width', '0px'],
  ['border-bottom-width', '0px'],
  ['line-height', '0'],
  ['visibility', 'hidden'],
];

export function StickyTableViewport({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    const header = headerRef.current;
    if (!scroll || !header) return;

    const table = scroll.querySelector('table');
    const realHead = table?.tHead;
    if (!table || !realHead) return;

    const mql = window.matchMedia('(min-width: 768px)');
    const realCells = Array.from(realHead.querySelectorAll<HTMLElement>('th'));
    let cloneTable: HTMLTableElement | null = null;

    const hideRealHead = () => {
      for (const cell of realCells) {
        for (const [prop, value] of HIDDEN_HEAD_STYLES) {
          cell.style.setProperty(prop, value);
        }
      }
    };

    const restoreRealHead = () => {
      for (const cell of realCells) {
        for (const [prop] of HIDDEN_HEAD_STYLES) {
          cell.style.removeProperty(prop);
        }
      }
    };

    const syncWidths = () => {
      if (!cloneTable) return;
      const cloneHead = cloneTable.tHead;
      const source = table.tBodies[0]?.rows[0] ?? realHead.rows[0] ?? null;
      const cloneCells = cloneHead?.rows[0]?.cells;
      if (!source || !cloneCells) return;
      cloneTable.style.width = `${table.offsetWidth}px`;
      cloneTable.style.minWidth = `${table.offsetWidth}px`;
      const count = Math.min(source.cells.length, cloneCells.length);
      for (let i = 0; i < count; i += 1) {
        const w = source.cells[i].getBoundingClientRect().width;
        const target = cloneCells[i] as HTMLElement;
        target.style.width = `${w}px`;
        target.style.minWidth = `${w}px`;
        target.style.maxWidth = `${w}px`;
      }
      header.scrollLeft = scroll.scrollLeft;
    };

    const onScroll = () => {
      header.scrollLeft = scroll.scrollLeft;
    };

    const ro = new ResizeObserver(() => syncWidths());

    const enable = () => {
      cloneTable = document.createElement('table');
      cloneTable.className = table.className;
      cloneTable.style.tableLayout = 'fixed';
      cloneTable.setAttribute('aria-hidden', 'true');
      cloneTable.appendChild(realHead.cloneNode(true));
      const cloneHead = cloneTable.tHead;
      for (const cell of Array.from(cloneHead?.querySelectorAll<HTMLElement>('th') ?? [])) {
        cell.style.visibility = 'visible';
      }
      header.replaceChildren(cloneTable);
      hideRealHead();
      scroll.addEventListener('scroll', onScroll, { passive: true });
      ro.observe(table);
      ro.observe(scroll);
      syncWidths();
    };

    const disable = () => {
      scroll.removeEventListener('scroll', onScroll);
      ro.disconnect();
      header.replaceChildren();
      restoreRealHead();
      cloneTable = null;
    };

    const apply = () => {
      if (mql.matches) enable();
      else disable();
    };

    apply();
    const onChange = () => {
      disable();
      apply();
    };
    mql.addEventListener('change', onChange);

    return () => {
      mql.removeEventListener('change', onChange);
      disable();
    };
  });

  return (
    <div className="contents md:flex md:min-h-0 md:flex-1 md:flex-col">
      <div
        ref={headerRef}
        aria-hidden="true"
        className="pointer-events-none hidden shrink-0 overflow-hidden md:block"
      />
      <div
        ref={scrollRef}
        className={cn(
          'data-table-scrollport isolate overflow-x-auto overscroll-x-contain',
          'md:min-h-0 md:flex-1 md:overflow-x-auto md:overflow-y-auto md:overscroll-none',
        )}
      >
        {children}
      </div>
    </div>
  );
}
