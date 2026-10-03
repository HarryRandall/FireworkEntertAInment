/** Ground and rising-star panels edit each renderer emitter in its stored v1 shape. */
'use client';
import type { Design } from '@showcrafter/fireworks';
import { cometsSchema } from '@showcrafter/fireworks/schema';
import { COMETS_CONTROLS } from '@/lib/studio/comets-controls';
import { FOUNTAIN_CONTROLS } from '@/lib/studio/fountain-controls';
import { TOURBILLON_CONTROLS } from '@/lib/studio/tourbillon-controls';
import { WHEEL_CONTROLS } from '@/lib/studio/wheel-controls';
import { SPINNER_CONTROLS } from '@/lib/studio/spinner-controls';
import { GradientEditor } from '@/ui/kit/gradient-editor';
import { Input } from '@/ui/primitives/input';
import {
  InspectorChoices,
  InspectorSection,
  RelativeSlider,
  type InspectorContext,
} from './inspector-controls';

import { QuickAdjustments, type QuickControl } from './quick-adjustments';

const emitterControls = {
  comets: COMETS_CONTROLS,
  fountain: FOUNTAIN_CONTROLS,
  tourbillon: TOURBILLON_CONTROLS,
  wheel: WHEEL_CONTROLS,
  spinner: SPINNER_CONTROLS,
};
const groundQuick: Readonly<Record<keyof typeof emitterControls, readonly QuickControl[]>> = {
  comets: [
    { key: 'ground.height', label: 'Height', low: 'Low', high: 'High' },
    { key: 'ground.count', label: 'Count', low: 'Few', high: 'Many' },
    { key: 'ground.fan', label: 'Fan', low: 'Narrow', high: 'Wide' },
    { key: 'ground.climb', label: 'Climb', low: 'Slow', high: 'Fast' },
    { key: 'ground.star_size', label: 'Star size', low: 'Fine', high: 'Bold' },
    { key: 'ground.spin', label: 'Spin', low: 'Gentle', high: 'Fast' },
  ],
  fountain: [
    { key: 'ground.height', label: 'Height', low: 'Low', high: 'High' },
    { key: 'ground.duration', label: 'Duration', low: 'Short', high: 'Long' },
    { key: 'ground.density', label: 'Density', low: 'Thin', high: 'Thick' },
    { key: 'ground.spray', label: 'Spray', low: 'Narrow', high: 'Wide' },
  ],
  tourbillon: [
    { key: 'ground.height', label: 'Height', low: 'Low', high: 'High' },
    { key: 'ground.count', label: 'Count', low: 'Few', high: 'Many' },
    { key: 'ground.climb', label: 'Climb', low: 'Slow', high: 'Fast' },
    { key: 'ground.spin', label: 'Spin', low: 'Gentle', high: 'Fast' },
  ],
  wheel: [],
  spinner: [],
};
type EmitterKey = keyof typeof emitterControls;
function emitter(document: Design, key: EmitterKey): object | null {
  const ground = document.ground;
  if (!ground || !(key in ground)) return null;
  const value: unknown = Reflect.get(ground, key);
  return typeof value === 'object' && value !== null ? value : null;
}
/** Edits relative emitter motion, pattern and colours; climb height preserves square-root timing. */
export function GroundInspector(context: InspectorContext) {
  return (
    <div>
      {(Object.keys(emitterControls) as EmitterKey[]).map((key) => {
        const source = emitter(context.document, key);
        if (!source) return null;
        return (
          <InspectorSection key={key} title="Ground settings">
            {groundQuick[key].length > 0 && (
              <QuickAdjustments context={context} controls={groundQuick[key]} />
            )}
            <GroundColour context={context} />
            {emitterControls[key].map((control) => {
              const value: unknown = Reflect.get(source, control.key);
              if (typeof value !== 'number') return null;
              return (
                <RelativeSlider
                  key={control.key}
                  control={control}
                  value={value}
                  disabled={context.disabled}
                  onChange={(next) => {
                    context.edit((draft) => {
                      const target = emitter(draft, key);
                      if (!target) return;
                      const height: unknown = Reflect.get(target, 'height_m');
                      const time: unknown = Reflect.get(target, 'time_s');
                      // Climbing emitters retain the same relative speed when their height changes.
                      if (
                        control.key === 'height_m' &&
                        typeof height === 'number' &&
                        height > 0 &&
                        typeof time === 'number'
                      )
                        Reflect.set(target, 'time_s', time * Math.sqrt(next / height));
                      Reflect.set(target, control.key, next);
                    });
                  }}
                />
              );
            })}
          </InspectorSection>
        );
      })}
    </div>
  );
}
function GroundColour({ context }: { context: InspectorContext }) {
  const ground = context.document.ground;
  if (!ground) return null;
  if ('comets' in ground)
    return (
      <div className="grid gap-4">
        <InspectorChoices
          label="Ground shape"
          items={cometsSchema.shape.pattern.options}
          value={ground.comets.pattern}
          disabled={context.disabled}
          onChange={(pattern) => {
            context.edit((draft) => {
              if (draft.ground && 'comets' in draft.ground) draft.ground.comets.pattern = pattern;
            });
          }}
        />
        <GradientEditor
          label="Ground colour"
          value={ground.comets.colour}
          disabled={context.disabled}
          onChange={(colour) => {
            context.edit((draft) => {
              if (draft.ground && 'comets' in draft.ground) draft.ground.comets.colour = colour;
            });
          }}
        />
      </div>
    );
  const colour = 'fountain' in ground ? ground.fountain.colour : undefined;
  const wheelColour = 'wheel' in ground ? ground.wheel.colour : undefined;
  const sourceColour = colour ?? wheelColour;
  if (sourceColour !== undefined)
    return (
      <Input
        type="color"
        aria-label="Ground colour"
        value={sourceColour}
        disabled={context.disabled}
        onChange={(event) => {
          context.edit((draft) => {
            if (draft.ground && 'fountain' in draft.ground)
              draft.ground.fountain.colour = event.target.value;
            if (draft.ground && 'wheel' in draft.ground)
              draft.ground.wheel.colour = event.target.value;
          });
        }}
      />
    );
  return 'spinner' in ground
    ? ground.spinner.colours.map((hex, index) => (
        <Input
          key={index}
          type="color"
          aria-label={`Spinner colour ${String(index + 1)}`}
          value={hex}
          disabled={context.disabled}
          onChange={(event) => {
            context.edit((draft) => {
              if (draft.ground && 'spinner' in draft.ground)
                draft.ground.spinner.colours[index] = event.target.value;
            });
          }}
        />
      ))
    : null;
}
