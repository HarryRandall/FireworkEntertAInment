import { Button } from '@/ui/patterns/Button';
import { unavailableControlReason } from '@showcrafter/firework-editor/availability';
import { EDITOR_PARTS } from '@showcrafter/firework-editor/parts';
import { presetSourceStatus } from '@showcrafter/firework-editor/presets';
import { revertSection, sectionChanged } from '@showcrafter/firework-editor/sections';
import type { JsonRecord, RenderControlsProps } from '@showcrafter/firework-editor/types';
import type { FireworkStyleDefaultKind } from '@showcrafter/fireworks/style-defaults';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FireworkEditorShellTab } from './FireworkEditorShell';
import { FireworkRenderControls } from './FireworkRenderControls';

type Definition = {
  id: string;
  scope: RenderControlsProps['controlScope'];
  kind: FireworkStyleDefaultKind;
  part?: RenderControlsProps['part'];
  layer?: 'outer' | 'core';
};
const DEFINITIONS: Definition[] = [
  { id: 'launch-flight', scope: 'launch', kind: 'launch', part: 'flight' },
  { id: 'launch-dot', scope: 'launchShell', kind: 'launch' },
  { id: 'launch-trail', scope: 'launchTrail', kind: 'launch' },
  { id: 'smoke', scope: 'smoke', kind: 'smoke' },
  { id: 'geometry', scope: 'geometry', kind: 'geometry' },
  { id: 'star', scope: 'star', kind: 'star', part: 'appearance' },
  { id: 'colour', scope: 'star', kind: 'star', part: 'colours' },
  { id: 'star-movement', scope: 'star', kind: 'star', part: 'movement' },
  { id: 'trail', scope: 'trail', kind: 'trail', part: 'trails' },
  { id: 'star-inner', scope: 'starInner', kind: 'innerStar', layer: 'core', part: 'appearance' },
  { id: 'inner-colour', scope: 'starInner', kind: 'innerStar', layer: 'core', part: 'colours' },
  { id: 'inner-movement', scope: 'starInner', kind: 'innerStar', layer: 'core', part: 'movement' },
  { id: 'inner-trail', scope: 'starInner', kind: 'innerTrail', layer: 'core', part: 'trails' },
  { id: 'fx-strobe', scope: 'strobe', kind: 'strobe' },
  { id: 'fx-crackle', scope: 'crackle', kind: 'crackle' },
  { id: 'fx-split', scope: 'split', kind: 'split' },
  { id: 'sound', scope: 'sound', kind: 'sound' },
];

export function firstRendererTab(kind: FireworkStyleDefaultKind): string {
  const definition = DEFINITIONS.find((item) => item.kind === kind);
  if (!definition) throw new Error(`No editor section for ${kind}`);
  return definition.id;
}

export function rendererTabs({
  controls,
  mutate,
  preset,
  colours,
  saved,
  kinds,
}: {
  controls: Omit<RenderControlsProps, 'mutate'>;
  mutate: (kind: FireworkStyleDefaultKind, updater: (record: JsonRecord) => void) => void;
  preset: (kind: FireworkStyleDefaultKind) => ReactNode;
  colours?: ReactNode;
  saved?: RenderControlsProps['design'];
  kinds?: readonly FireworkStyleDefaultKind[];
}): FireworkEditorShellTab[] {
  return DEFINITIONS.filter((definition) => !kinds || kinds.includes(definition.kind)).map(
    (definition) => {
      const meta = EDITOR_PARTS[definition.id];
      const layer = definition.layer ?? 'outer';
      const enabled =
        definition.part && definition.part !== 'flight'
          ? controls.design.stars[layer].enabled &&
            (definition.part !== 'trails' || controls.design.stars[layer].burstTrail.enabled)
          : definition.id === 'smoke'
            ? controls.design.launch.smoke.enabled
            : definition.id === 'fx-strobe'
              ? controls.design.strobe.enabled
              : definition.id === 'fx-crackle'
                ? controls.design.crackle.enabled
                : definition.id === 'fx-split'
                  ? controls.design.split.enabled
                  : definition.id === 'launch-dot'
                    ? controls.design.launch.shell.visible
                    : undefined;
      const unavailable = unavailableControlReason(controls.design, definition.scope, layer);
      const dirty = saved ? sectionChanged(definition.id, controls.design, saved) : false;
      const source = presetSourceStatus(controls.defaults, definition.kind);
      return {
        dirty,
        id: definition.id,
        label: meta.label,
        title: meta.label,
        description: meta.description,
        eyebrow: meta.path.join(' / '),
        icon: Sparkles,
        enabled: unavailable ? false : enabled,
        content: (
          <div className="space-y-5">
            {source ? (
              <p className="text-muted-foreground text-xs">
                Source: {source.name}
                {source.modified ? ' · Modified' : ' · Copied preset'}
              </p>
            ) : null}
            {definition.id === 'colour' && colours ? (
              colours
            ) : (
              <FireworkRenderControls
                {...controls}
                showLaunch
                showStarCount
                controlScope={definition.scope}
                part={definition.part}
                layer={layer}
                mutate={(updater) => mutate(definition.kind, updater)}
              />
            )}
            {preset(definition.kind)}
            {saved ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={!dirty}
                onClick={() =>
                  mutate(definition.kind, (draft) => revertSection(definition.id, draft, saved))
                }
              >
                Revert section to saved
              </Button>
            ) : null}
          </div>
        ),
      };
    },
  );
}
