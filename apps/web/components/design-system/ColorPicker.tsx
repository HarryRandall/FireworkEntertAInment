'use client';

/**
 * Modern colour picker: a swatch trigger that opens a popover with a
 * saturation/value field, a hue slider, a hex entry, and quick presets.
 * Replaces the browser-default `<input type="color">` swatch across the
 * firework editors.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FIREWORK_COLOR_VALUES } from '@/lib/fireworks/spec';
import { cn } from '@/lib/utils';

const HEX = /^#[0-9a-fA-F]{6}$/;

type Hsv = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normaliseHex(value: string): string {
  const trimmed = value.trim();
  return HEX.test(trimmed) ? trimmed.toLowerCase() : '#ffffff';
}

function hexToHsv(hex: string): Hsv {
  const clean = normaliseHex(hex).slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (channel: number) =>
    clamp(Math.round((channel + m) * 255), 0, 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

type ColorPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  presets?: readonly string[];
  /** Accessible label for the trigger. */
  label?: string;
  /** Show the hex value beside the swatch on the trigger. */
  showValue?: boolean;
  className?: string;
  swatchClassName?: string;
};

export function ColorPicker({
  value,
  onChange,
  disabled,
  presets = FIREWORK_COLOR_VALUES,
  label = 'Colour',
  showValue = true,
  className,
  swatchClassName,
}: ColorPickerProps) {
  const hex = normaliseHex(value);
  // Track hue locally so dragging through greys/black keeps a stable hue.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(hex));
  const [hexDraft, setHexDraft] = useState(hex);

  useEffect(() => {
    if (hsvToHex(hsv).toLowerCase() !== hex) {
      setHsv(hexToHsv(hex));
    }
    setHexDraft(hex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  const commit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      onChange(hsvToHex(next));
    },
    [onChange],
  );

  return (
    <Popover>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        aria-label={label}
        className={cn(
          'group focus-visible:ring-ring/50 inline-flex h-9 items-center gap-2 rounded-lg border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] pr-2.5 pl-1.5 shadow-xs transition-colors hover:border-[color:var(--color-border-emphasis)] focus:outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
      >
        <span
          className={cn(
            'h-6 w-6 shrink-0 rounded-md ring-1 ring-black/10 ring-inset',
            swatchClassName,
          )}
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        {showValue ? (
          <span className="font-mono text-xs tracking-tight text-[color:var(--color-content-emphasis)] uppercase tabular-nums">
            {hex}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 gap-3 p-3">
        <SaturationField hsv={hsv} onChange={commit} />
        <HueSlider hue={hsv.h} onChange={(h) => commit({ ...hsv, h })} />
        <div className="flex items-center gap-2">
          <span
            className="h-8 w-8 shrink-0 rounded-md ring-1 ring-black/10 ring-inset"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-xs text-[color:var(--color-content-muted)]">
              #
            </span>
            <input
              aria-label={`${label} hex value`}
              value={hexDraft.replace(/^#/, '').toUpperCase()}
              maxLength={6}
              spellCheck={false}
              className="focus-visible:ring-ring/50 h-8 w-full rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] pr-2 pl-5 font-mono text-xs tracking-wide text-[color:var(--color-content-emphasis)] uppercase tabular-nums focus:outline-none focus-visible:ring-3"
              onChange={(event) => {
                const raw = event.currentTarget.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                const candidate = `#${raw}`;
                setHexDraft(candidate);
                if (HEX.test(candidate)) {
                  setHsv(hexToHsv(candidate));
                  onChange(candidate.toLowerCase());
                }
              }}
              onBlur={() => setHexDraft(hex)}
            />
          </div>
        </div>
        {presets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-[color:var(--color-border-subtle)] pt-3">
            {presets.map((preset) => {
              const active = preset.toLowerCase() === hex;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Use ${preset}`}
                  onClick={() => {
                    setHsv(hexToHsv(preset));
                    onChange(preset.toLowerCase());
                  }}
                  className={cn(
                    'focus-visible:ring-ring/60 flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-black/10 transition-transform ring-inset hover:scale-110 focus:outline-none focus-visible:ring-3',
                    active && 'ring-2 ring-[color:var(--color-content-emphasis)]',
                  )}
                  style={{ backgroundColor: preset }}
                >
                  {active ? (
                    <Check
                      size={12}
                      className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                      color={hexToHsv(preset).v > 0.7 ? '#000' : '#fff'}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function SaturationField({ hsv, onChange }: { hsv: Hsv; onChange: (hsv: Hsv) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const s = clamp((clientX - rect.left) / rect.width, 0, 1);
      const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
      onChange({ h: hsv.h, s, v });
    },
    [hsv.h, onChange],
  );

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    apply(event.clientX, event.clientY);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    apply(event.clientX, event.clientY);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.v * 100)}
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      tabIndex={0}
      className="focus-visible:ring-ring/60 relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-lg ring-1 ring-black/10 select-none ring-inset focus:outline-none focus-visible:ring-2"
      style={{ backgroundColor: hueHex }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 0.1 : 0.02;
        if (event.key === 'ArrowLeft') onChange({ ...hsv, s: clamp(hsv.s - step, 0, 1) });
        else if (event.key === 'ArrowRight') onChange({ ...hsv, s: clamp(hsv.s + step, 0, 1) });
        else if (event.key === 'ArrowUp') onChange({ ...hsv, v: clamp(hsv.v + step, 0, 1) });
        else if (event.key === 'ArrowDown') onChange({ ...hsv, v: clamp(hsv.v - step, 0, 1) });
        else return;
        event.preventDefault();
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff,transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,#000,transparent)]" />
      <span
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          backgroundColor: hsvToHex(hsv),
        }}
      />
    </div>
  );
}

function HueSlider({ hue, onChange }: { hue: number; onChange: (hue: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const apply = useCallback(
    (clientX: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      onChange(clamp((clientX - rect.left) / rect.width, 0, 1) * 360);
    },
    [onChange],
  );

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    apply(event.clientX);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    apply(event.clientX);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      className="focus-visible:ring-ring/60 relative h-3 w-full cursor-pointer touch-none rounded-full ring-1 ring-black/10 select-none ring-inset focus:outline-none focus-visible:ring-2"
      style={{
        background:
          'linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 15 : 3;
        if (event.key === 'ArrowLeft') onChange(clamp(hue - step, 0, 360));
        else if (event.key === 'ArrowRight') onChange(clamp(hue + step, 0, 360));
        else return;
        event.preventDefault();
      }}
    >
      <span
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
        style={{ left: `${(hue / 360) * 100}%`, backgroundColor: hsvToHex({ h: hue, s: 1, v: 1 }) }}
      />
    </div>
  );
}
