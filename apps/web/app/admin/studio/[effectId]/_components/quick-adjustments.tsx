/** Seven-step adjective controls store the renderer's shared relative adjustment levels. */
'use client';
import { RadioGroup } from 'radix-ui';
import { InspectorSection, type InspectorContext } from './inspector-controls';

const MAX_REDUCTION = -3; // Renderer adjustment schema's lowest relative level.
const REDUCTION = -2; // Prototype seven-step control: medium reduction.
const INCREASE = 2; // Prototype seven-step control: medium increase.
const MAX_INCREASE = 3; // Renderer adjustment schema's highest relative level.
const LEVELS = [MAX_REDUCTION, REDUCTION, -1, 0, 1, INCREASE, MAX_INCREASE];
const STRENGTHS = ['Much', 'More', 'Slightly', 'Original', 'Slightly', 'More', 'Much'];
/** Relative labels and persisted adjustment key, using the renderer's registry semantics. */
export interface QuickControl {
  key: string;
  label: string;
  low: string;
  high: string;
}
/** Launch quick rows reuse the prototype's adjective transformations. */
export const LAUNCH_QUICK: readonly QuickControl[] = [
  { key: 'launch.height', label: 'Height', low: 'Low', high: 'High' },
  { key: 'launch.climb', label: 'Climb speed', low: 'Slow', high: 'Fast' },
  { key: 'launch.tail', label: 'Tail', low: 'Thin', high: 'Thick' },
];
/** Burst adjective rows apply consistently across the document's breaks. */
export const BURST_QUICK: readonly QuickControl[] = [
  { key: 'break.flash', label: 'Flash', low: 'Soft', high: 'Bright' },
  { key: 'break.core_ring', label: 'Centre ring', low: 'Small', high: 'Big' },
];
/** Primary star rows share the renderer's per-layer relative transformations. */
export const STAR_QUICK: readonly QuickControl[] = [
  { key: 'size', label: 'Size', low: 'Small', high: 'Big' },
  { key: 'stars', label: 'Stars', low: 'Few', high: 'Many' },
  { key: 'brightness', label: 'Brightness', low: 'Dim', high: 'Bright' },
  { key: 'burn', label: 'Burn', low: 'Short', high: 'Long' },
  { key: 'droop', label: 'Droop', low: 'Floaty', high: 'Heavy' },
  { key: 'spread', label: 'Spread', low: 'Together', high: 'Scattered' },
];
/** Primary trail rows share the renderer's per-layer emission transformations. */
export const TRAIL_QUICK: readonly QuickControl[] = [
  { key: 'trail.length', label: 'Length', low: 'Short', high: 'Long' },
  { key: 'trail.density', label: 'Density', low: 'Thin', high: 'Thick' },
  { key: 'trail.spray', label: 'Spray', low: 'Narrow', high: 'Wide' },
  { key: 'trail.glitter', label: 'Glitter', low: 'None', high: 'Lots' },
];
/** Edits one stored level per row, with arrow-key selection and relative words at either end. */
export function QuickAdjustments({
  context,
  controls,
  layerId,
  disabled = false,
}: {
  context: InspectorContext;
  controls: readonly QuickControl[];
  layerId?: string;
  disabled?: boolean;
}) {
  const repeatedId =
    layerId !== undefined &&
    context.document.breaks.flatMap((burst) => burst.layers).filter((layer) => layer.id === layerId)
      .length > 1;
  return (
    <InspectorSection title="Quick adjustments">
      {controls.map((control) => {
        const key = layerId === undefined ? control.key : `layer.${layerId}.${control.key}`;
        return (
          <div key={key} className="grid gap-2">
            <span>{control.label}</span>
            <RadioGroup.Root
              aria-label={`${control.label} adjustment`}
              value={String(context.levels[key] ?? 0)}
              disabled={context.disabled || disabled || repeatedId}
              onValueChange={(value) => {
                const level = LEVELS.find((candidate) => String(candidate) === value);
                if (level !== undefined) context.adjust(key, level);
              }}
              className="flex justify-between gap-1"
            >
              {LEVELS.map((level, index) => (
                <RadioGroup.Item
                  key={level}
                  value={String(level)}
                  aria-label={
                    level === 0
                      ? `${control.label} original`
                      : `${control.label} ${STRENGTHS[index] ?? ''} ${level < 0 ? control.low : control.high}`
                  }
                  className="border-border data-[state=checked]:bg-highlight data-[state=checked]:border-highlight size-6 rounded-full border disabled:opacity-40"
                >
                  <RadioGroup.Indicator className="block" />
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{control.low}</span>
              <span>{control.high}</span>
            </div>
          </div>
        );
      })}
      {repeatedId && (
        <p className="text-muted-foreground text-xs">
          These groups share an identifier. Use fine controls to edit only this group.
        </p>
      )}
    </InspectorSection>
  );
}
