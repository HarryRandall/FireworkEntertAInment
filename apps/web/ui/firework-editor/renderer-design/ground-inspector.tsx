/** Ground and rising-star panels edit each renderer emitter in its stored v1 shape. */
'use client';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './disclosure';
import type { RelativeControl } from '@/lib/renderer-editor/relative-control';
import type { Design } from '@showcrafter/renderer';
import { cometsSchema } from '@showcrafter/renderer/schema';
import { COMETS_CONTROLS } from '@/lib/renderer-editor/comets-controls';
import { FOUNTAIN_CONTROLS } from '@/lib/renderer-editor/fountain-controls';
import { TOURBILLON_CONTROLS } from '@/lib/renderer-editor/tourbillon-controls';
import { WHEEL_CONTROLS } from '@/lib/renderer-editor/wheel-controls';
import { SPINNER_CONTROLS } from '@/lib/renderer-editor/spinner-controls';
import { GradientEditor } from './gradient-editor';
import {
  InspectorChoices,
  InspectorColour,
  RelativeSlider,
  type InspectorContext,
} from './inspector-controls';

const emitterControls = {
  comets: COMETS_CONTROLS,
  fountain: FOUNTAIN_CONTROLS,
  tourbillon: TOURBILLON_CONTROLS,
  wheel: WHEEL_CONTROLS,
  spinner: SPINNER_CONTROLS,
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
    <div className="grid gap-2">
      <h3 className="sr-only">Ground settings</h3>
      {(Object.keys(emitterControls) as EmitterKey[]).map((key) => {
        const source = emitter(context.document, key);
        if (!source) return null;
        return (
          <Accordion
            key={key}
            type="multiple"
            defaultValue={['Colour', 'Motion', 'Look', 'Timing']}
            className="gap-2"
          >
            <AccordionItem value="Colour">
              <AccordionTrigger className="text-sm">Colour</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <GroundColour context={context} />
                </div>
              </AccordionContent>
            </AccordionItem>
            {['Motion', 'Look', 'Timing'].map((group) => (
              <AccordionItem key={group} value={group}>
                <AccordionTrigger className="text-sm">{group}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {emitterControls[key]
                      .filter((control) => groundPropertyGroup(control.label) === group)
                      .map((control) => (
                        <GroundProperty
                          key={control.key}
                          {...{ control, source, context }}
                          emitterKey={key}
                        />
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        );
      })}
    </div>
  );
}
function groundPropertyGroup(label: string) {
  if (['Height', 'Fall', 'Air drag', 'Climb', 'Spin'].includes(label)) return 'Motion';
  if (['Duration', 'Burn'].includes(label)) return 'Timing';
  return 'Look';
}
function GroundProperty({
  control,
  source,
  context,
  emitterKey,
}: {
  control: RelativeControl;
  source: object;
  context: InspectorContext;
  emitterKey: EmitterKey;
}) {
  const value: unknown = Reflect.get(source, control.key);
  if (typeof value !== 'number') return null;
  return (
    <RelativeSlider
      control={control}
      value={value}
      disabled={context.disabled}
      onChange={(next) => {
        context.edit((draft) => {
          const target = emitter(draft, emitterKey);
          if (!target) return;
          const height: unknown = Reflect.get(target, 'height_m');
          const time: unknown = Reflect.get(target, 'time_s');
          // Climbing emitters retain relative speed when their height changes.
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
}

function GroundColour({ context }: { context: InspectorContext }) {
  const ground = context.document.ground;
  if (!ground) return null;
  if ('comets' in ground)
    return (
      <div className="grid gap-3">
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
      <InspectorColour
        label="Colour"
        name="Ground colour"
        value={sourceColour}
        disabled={context.disabled}
        onChange={(next) => {
          context.edit((draft) => {
            if (draft.ground && 'fountain' in draft.ground) draft.ground.fountain.colour = next;
            if (draft.ground && 'wheel' in draft.ground) draft.ground.wheel.colour = next;
          });
        }}
      />
    );
  return 'spinner' in ground
    ? ground.spinner.colours.map((hex, index) => (
        <InspectorColour
          key={index}
          label={`Colour ${String(index + 1)}`}
          name={`Spinner colour ${String(index + 1)}`}
          value={hex}
          disabled={context.disabled}
          onChange={(next) => {
            context.edit((draft) => {
              if (draft.ground && 'spinner' in draft.ground)
                draft.ground.spinner.colours[index] = next;
            });
          }}
        />
      ))
    : null;
}
