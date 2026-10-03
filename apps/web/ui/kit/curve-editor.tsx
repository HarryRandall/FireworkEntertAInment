/** Controlled brightness graph with pointer and number-row editing. */
'use client';
import { useRef } from 'react';
import { useKeyDrag } from './use-key-drag';
import type { Brightness } from '@showcrafter/fireworks/schema';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import {
  addCurveKey,
  insertionTime,
  curvePath,
  moveCurveKey,
  pointerFraction,
  removeKey,
} from './editor-maths';

// Normalised key step for number rows, matching authored life precision.
const KEY_STEP = 0.001;
// Percentage positioning maps the unit-square graph into CSS layout.
const PERCENT = 100;
/** Ordered brightness keys and a positive maximum brightness in renderer units. */
interface CurveEditorProps {
  label: string;
  value: Brightness;
  onChange: (value: Brightness) => void;
  maxValue?: number;
  pinEnds?: boolean;
  disabled?: boolean;
}

/** Edits ordered renderer brightness keys, with normalised life x and brightness y; never mutates value. */
export function CurveEditor({
  label,
  value,
  onChange,
  maxValue = 1,
  pinEnds = true,
  disabled = false,
}: CurveEditorProps) {
  const surface = useRef<HTMLDivElement>(null);
  const path = curvePath(value, maxValue);
  const drag = useKeyDrag((event, index) => {
    const bounds = surface.current?.getBoundingClientRect();
    if (bounds === undefined || disabled) {
      return;
    }
    const time = pointerFraction(event.clientX, bounds.left, bounds.width);
    const brightness = (1 - pointerFraction(event.clientY, bounds.top, bounds.height)) * maxValue;
    onChange(moveCurveKey(value, index, [time, brightness], { pinEnds, maxValue }));
  });
  return (
    <div className="grid gap-3">
      <div
        ref={surface}
        aria-label={label}
        className="border-border bg-muted relative h-36 touch-none rounded-md border select-none"
        onPointerDown={(event) => {
          if (
            disabled ||
            (event.target instanceof Element && event.target.closest('button') !== null)
          ) {
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          onChange(
            addCurveKey(
              value,
              pointerFraction(event.clientX, bounds.left, bounds.width),
              (1 - pointerFraction(event.clientY, bounds.top, bounds.height)) * maxValue,
            ),
          );
        }}
        onPointerMove={drag.move}
        onPointerUp={drag.end}
        onPointerCancel={drag.end}
        onLostPointerCapture={drag.end}
      >
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden="true"
        >
          <path d={`${path} L1,1 L0,1 Z`} className="fill-highlight/15" />
          <path
            d={path}
            fill="none"
            className="stroke-highlight"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {value.map(([time, brightness], index) => (
          <button
            key={index}
            type="button"
            aria-label={`${label} key ${String(index + 1)}`}
            disabled={disabled}
            style={{
              left: `${String(time * PERCENT)}%`,
              top: `${String((1 - brightness / maxValue) * PERCENT)}%`,
            }}
            className="border-highlight bg-card focus:bg-highlight absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2"
            onPointerDown={(event) => {
              drag.start(event, index);
            }}
          />
        ))}
      </div>
      <CurveRows
        label={label}
        value={value}
        onChange={onChange}
        maxValue={maxValue}
        pinEnds={pinEnds}
        disabled={disabled}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          onChange(addCurveKey(value, insertionTime(value)));
        }}
      >
        Add key
      </Button>
    </div>
  );
}
function CurveRows({
  label,
  value,
  onChange,
  maxValue,
  pinEnds,
  disabled,
}: {
  label: string;
  value: Brightness;
  onChange: (value: Brightness) => void;
  maxValue: number;
  pinEnds: boolean;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-2">
      {value.map(([time, brightness], index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            type="number"
            aria-label={`${label} key ${String(index + 1)} time`}
            min={0}
            max={1}
            step={KEY_STEP}
            value={time}
            disabled={disabled || (pinEnds && (index === 0 || index === value.length - 1))}
            onChange={(event) => {
              onChange(
                moveCurveKey(value, index, [event.target.valueAsNumber, brightness], {
                  pinEnds,
                  maxValue,
                }),
              );
            }}
          />
          <Input
            type="number"
            aria-label={`${label} key ${String(index + 1)} value`}
            min={0}
            max={maxValue}
            step={KEY_STEP}
            value={brightness}
            disabled={disabled}
            onChange={(event) => {
              onChange(
                moveCurveKey(value, index, [time, event.target.valueAsNumber], {
                  pinEnds,
                  maxValue,
                }),
              );
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove ${label} key ${String(index + 1)}`}
            disabled={
              disabled ||
              value.length <= 2 ||
              (pinEnds && (index === 0 || index === value.length - 1))
            }
            onClick={() => {
              onChange(removeKey(value, index, pinEnds));
            }}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
