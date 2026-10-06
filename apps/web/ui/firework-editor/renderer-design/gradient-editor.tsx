/** Controlled renderer colour stops with draggable handles and editable palette rows. */
'use client';
import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useKeyDrag } from './use-key-drag';
import type { Colour, ColourStop } from '@showcrafter/renderer/schema';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import {
  addGradientStop,
  gradientCss,
  insertionTime,
  moveGradientStop,
  pointerFraction,
  removeKey,
} from './editor-maths';

const PERCENT = 100; // CSS percentage scale for normalised stop times.
const KEY_STEP = 0.001; // Normalised life step, matching the curve editor.
/** Edits ordered colour stops without changing mode, palettes or reignition; time is normalised life. */
export function GradientEditor({
  label,
  value,
  onChange,
  pinEnds = true,
  disabled = false,
  maxTime = 1,
}: {
  label: string;
  value: Colour;
  onChange: (value: Colour) => void;
  pinEnds?: boolean;
  disabled?: boolean;
  maxTime?: number;
}) {
  const surface = useRef<HTMLDivElement>(null);
  function change(stops: ColourStop[]) {
    onChange({ ...value, stops });
  }
  const drag = useKeyDrag((event, index) => {
    const bounds = surface.current?.getBoundingClientRect();
    if (bounds === undefined || disabled) {
      return;
    }
    change(
      moveGradientStop(
        value.stops,
        index,
        pointerFraction(event.clientX, bounds.left, bounds.width) * maxTime,
        { pinEnds, maxTime },
      ),
    );
  });
  return (
    <div className="grid min-w-0 gap-2">
      {/* Inline padding equals half a stop handle, so end handles stay inside the panel. */}
      <div className="px-2 pb-4">
        <div
          ref={surface}
          aria-label={label}
          style={{ background: gradientCss(value, maxTime) }}
          className="border-border relative h-6 cursor-copy touch-none rounded-md border"
          onPointerDown={(event) => {
            if (disabled || event.target !== event.currentTarget) {
              return;
            }
            const bounds = event.currentTarget.getBoundingClientRect();
            change(
              addGradientStop(
                value,
                pointerFraction(event.clientX, bounds.left, bounds.width) * maxTime,
                maxTime,
              ),
            );
          }}
          onPointerMove={drag.move}
          onPointerUp={drag.end}
          onPointerCancel={drag.end}
          onLostPointerCapture={drag.end}
        >
          {value.stops.map(([time, colour], index) => (
            <Button
              variant="outline"
              key={index}
              type="button"
              disabled={disabled}
              aria-label={`${label} stop ${String(index + 1)}`}
              className="border-card ring-border hover:ring-foreground focus-visible:ring-foreground absolute top-full size-3.5 -translate-x-1/2 translate-y-1 cursor-grab rounded-sm border-2 p-0 ring-1 active:cursor-grabbing"
              style={{
                left: `${String((time / maxTime) * PERCENT)}%`,
                backgroundColor: typeof colour === 'string' ? colour : colour[0],
              }}
              onPointerDown={(event) => {
                drag.start(event, index);
              }}
            />
          ))}
        </div>
      </div>
      <GradientRows
        label={label}
        value={value}
        change={change}
        pinEnds={pinEnds}
        disabled={disabled}
        maxTime={maxTime}
      />
    </div>
  );
}
function PaletteRow({
  label,
  colour,
  disabled,
  onChange,
}: {
  label: string;
  colour: ColourStop[1];
  disabled: boolean;
  onChange: (colour: ColourStop[1]) => void;
}) {
  const palette = typeof colour === 'string' ? [colour] : colour;
  return (
    <span className="flex min-w-0 flex-1 flex-wrap gap-1">
      {palette.map((hex, index) => (
        <Input
          key={index}
          type="color"
          aria-label={`${label} colour ${String(index + 1)}`}
          value={hex}
          className="h-8 w-12 p-1"
          disabled={disabled}
          onChange={(event) => {
            onChange(
              typeof colour === 'string'
                ? event.target.value
                : palette.map((entry, row) => (row === index ? event.target.value : entry)),
            );
          }}
        />
      ))}
    </span>
  );
}

/** Lists each stop's time, palette and removal, then offers a new stop at the widest gap. */
function GradientRows({
  label,
  value,
  change,
  pinEnds,
  disabled,
  maxTime,
}: {
  label: string;
  value: Colour;
  change: (stops: ColourStop[]) => void;
  pinEnds: boolean;
  disabled: boolean;
  maxTime: number;
}) {
  return (
    <div className="grid gap-1">
      {value.stops.map(([time, colour], index) => {
        const pinned = pinEnds && (index === 0 || index === value.stops.length - 1);
        return (
          <div key={index} className="flex min-w-0 items-center gap-2">
            <Input
              className="h-7 w-16 shrink-0 px-1.5 text-right font-mono text-xs tabular-nums"
              type="number"
              aria-label={`${label} stop ${String(index + 1)} time`}
              value={time}
              min={0}
              max={maxTime}
              step={KEY_STEP}
              disabled={disabled || pinned}
              onChange={(event) => {
                change(
                  moveGradientStop(value.stops, index, event.target.valueAsNumber, {
                    pinEnds,
                    maxTime,
                  }),
                );
              }}
            />
            <PaletteRow
              label={`${label} stop ${String(index + 1)}`}
              colour={colour}
              disabled={disabled}
              onChange={(next) => {
                change(
                  value.stops.map((stop, row) =>
                    row === index ? [stop[0], next] : structuredClone(stop),
                  ),
                );
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground hover:text-destructive shrink-0"
              disabled={disabled || value.stops.length <= 2 || pinned}
              onClick={() => {
                change(removeKey(value.stops, index, pinEnds));
              }}
              aria-label={`Remove ${label} stop ${String(index + 1)}`}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground hover:text-foreground justify-self-start"
        disabled={disabled}
        onClick={() => {
          change(addGradientStop(value, insertionTime(value.stops), maxTime));
        }}
      >
        <Plus aria-hidden="true" />
        Add stop
      </Button>
    </div>
  );
}
