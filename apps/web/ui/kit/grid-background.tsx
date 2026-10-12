/** Decorative ruled grid with flickering cells and a pointer spotlight, after Coursemap's hero. */
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** One grid square, in CSS pixels. The 72rem content column is a whole number of them. */
const CELL = 48;
/** The `max-w-6xl` column that section borders sit on, in CSS pixels. */
const COLUMN = 1152;
const SQUARES = 12;
/** Must match --sc-flicker-duration in kit.css. */
const FLICKER_MS = 3200;
/** Radius of the brightened patch under the pointer, in CSS pixels. */
const SPOT_RADIUS = 180;

/** A flickering cell, placed as a share of the grid's width and height. */
type Square = { id: number; x: number; y: number; delay: number };

function randomSquare(id: number, delay = 0): Square {
  return { id, x: Math.random(), y: Math.random(), delay };
}

/**
 * Fills its positioned parent with grid lines aligned to the content column, a few cells
 * that fade in and out, and brighter lines under a fine pointer. Decorative only; reduced
 * motion keeps the plain grid.
 */
export function GridBackground({ className }: { className?: string }) {
  const id = useId().replace(/:/gu, '');
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Cells are placed after mount so the server and client markup agree.
  const [squares, setSquares] = useState<Square[]>([]);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  const offset = ((size.width - Math.min(size.width, COLUMN)) / 2) % CELL;
  const columns = Math.ceil(size.width / CELL) + 1;
  const rows = Math.ceil(size.height / CELL) + 1;

  useEffect(() => {
    const element = ref.current;
    const parent = element?.parentElement;
    if (!element || !parent) return;
    setSquares(
      Array.from({ length: SQUARES }, (_, index) =>
        randomSquare(index, Math.random() * FLICKER_MS),
      ),
    );
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const move = (event: PointerEvent) => {
      if (!finePointer.matches) return;
      const rect = element.getBoundingClientRect();
      setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    const leave = () => setPointer(null);
    parent.addEventListener('pointermove', move);
    parent.addEventListener('pointerleave', leave);
    return () => {
      observer.disconnect();
      parent.removeEventListener('pointermove', move);
      parent.removeEventListener('pointerleave', leave);
    };
  }, []);

  const hovered = pointer
    ? {
        x: Math.floor((pointer.x - offset) / CELL) * CELL + offset,
        y: Math.floor((pointer.y + 1) / CELL) * CELL - 1,
      }
    : null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
        className,
      )}
    >
      <svg className="absolute inset-0 size-full">
        <defs>
          <pattern
            id={`${id}-grid`}
            width={CELL}
            height={CELL}
            x={offset}
            y={-1}
            patternUnits="userSpaceOnUse"
          >
            <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" className="stroke-border" />
          </pattern>
          <pattern
            id={`${id}-glow`}
            width={CELL}
            height={CELL}
            x={offset}
            y={-1}
            patternUnits="userSpaceOnUse"
          >
            <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" className="stroke-primary/60" />
          </pattern>
          <radialGradient id={`${id}-spot`}>
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-mask`}>
            {pointer ? (
              <circle cx={pointer.x} cy={pointer.y} r={SPOT_RADIUS} fill={`url(#${id}-spot)`} />
            ) : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-grid)`} />
        {size.width > 0
          ? squares.map((square) => (
              <rect
                key={square.id}
                x={Math.floor(square.x * columns) * CELL + offset + 1}
                y={Math.floor(square.y * rows) * CELL}
                width={CELL - 1}
                height={CELL - 1}
                className="sc-grid-flicker fill-primary"
                style={{ animationDelay: `${square.delay}ms` }}
                onAnimationIteration={() =>
                  setSquares((current) =>
                    current.map((item) => (item.id === square.id ? randomSquare(item.id) : item)),
                  )
                }
              />
            ))
          : null}
        {hovered ? (
          <rect
            x={hovered.x + 1}
            y={hovered.y + 1}
            width={CELL - 1}
            height={CELL - 1}
            className="fill-primary/10 transition-[x,y] duration-150"
          />
        ) : null}
        <rect width="100%" height="100%" fill={`url(#${id}-glow)`} mask={`url(#${id}-mask)`} />
      </svg>
    </div>
  );
}
