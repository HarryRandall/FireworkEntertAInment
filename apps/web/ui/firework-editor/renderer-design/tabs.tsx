'use client';
import type { Dispatch, ReactNode } from 'react';
import {
  Film,
  Gauge,
  Library,
  ShieldCheck,
  Shuffle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { effectTemplates, type Design } from '@showcrafter/renderer';
import type { EditorEdit } from '@/lib/renderer-editor/document';
import { layerAddress } from '@/lib/renderer-editor/layers';
import { SelectField } from '@/ui/patterns/SelectField';
import { Button } from '@/ui/patterns/Button';
import type { FireworkEditorShellTab } from '../FireworkEditorShell';
import { LaunchInspector } from './launch-inspector';
import { BurstInspector } from './burst-inspector';
import { StarsInspector } from './stars-inspector';
import { TrailInspector } from './trail-inspector';
import { EffectInspector } from './effect-inspector';
import { GroundInspector } from './ground-inspector';
import { TimelineInspector } from './timeline-inspector';
import { SoundInspector } from './sound-inspector';
import { useInspector } from './use-inspector';
import { validateEditorDesign } from '@/lib/renderer-editor/validation';
import type { SavedPart } from '@/lib/renderer-editor/library';
import { QuickAdjustments } from './quick-adjustments';
import { VariationsPanel } from './variations-panel';
import { LibraryPanel } from './library-panel';
import { ReferencePanel, type useReferenceClip } from './reference-panel';
import { ChecksPanel } from './checks-panel';
import type { ParticleCheckResult } from './use-particle-check';

/** Optional editor extras; each tab appears only when its input is supplied. */
export interface DesignExtras {
  libraryParts?: readonly SavedPart[];
  reference?: ReturnType<typeof useReferenceClip>;
  particleCheck?: ParticleCheckResult | null;
}

/** Builds renderer controls inside the existing editor's tab and inspector shell. */
export function useDesignTabs({
  value,
  onChange,
  selected,
  onSelect,
  disabled,
  reset,
  extras = {},
}: {
  value: unknown;
  onChange: (document: Design) => void;
  selected: string;
  onSelect: (id: string) => void;
  disabled: boolean;
  reset?: () => void;
  extras?: DesignExtras;
}): FireworkEditorShellTab[] {
  const parsed = validateEditorDesign(value);
  const document = parsed.ok ? parsed.value : effectTemplates[0].design;
  const dispatch: Dispatch<EditorEdit> = (action) => {
    if (action.type === 'replace') onChange(action.document);
  };
  const inspector = useInspector(document, selected, !disabled && parsed.ok, dispatch);
  return parsed.ok
    ? buildTabs(document, inspector, onSelect, disabled, reset, {
        ...extras,
        onChange,
        selected,
      })
    : [
        {
          id: 'colour',
          label: 'Design',
          title: 'Design',
          eyebrow: 'Renderer',
          icon: Sparkles,
          content: (
            <div className="space-y-3">
              <p role="alert" className="text-status-danger text-sm">
                {parsed.error}
              </p>
              {reset && <Button onClick={reset}>Reset to effect design</Button>}
            </div>
          ),
        },
      ];
}
function buildTabs(
  document: Design,
  inspector: ReturnType<typeof useInspector>,
  onSelect: (id: string) => void,
  disabled: boolean,
  reset: (() => void) | undefined,
  extras: DesignExtras & {
    onChange: (document: Design) => void;
    selected: string;
  },
): FireworkEditorShellTab[] {
  const { context, layerContext } = inspector;
  const selectedAddress = inspector.selection
    ? layerAddress(inspector.selection.breakIndex, inspector.selection.layerId)
    : extras.selected;
  const choices = document.breaks.flatMap((burst, index) =>
    burst.layers.map((layer) => ({
      value: layerAddress(index, layer.id),
      label: `Break ${index + 1}: ${layer.name}`,
    })),
  );
  const selector = choices.length > 0 && (
    <SelectField
      ariaLabel="Star group"
      value={
        inspector.selection
          ? layerAddress(inspector.selection.breakIndex, inspector.selection.layerId)
          : ''
      }
      onChange={onSelect}
      options={choices}
      disabled={disabled}
    />
  );
  const panels: Array<{
    id: string;
    label: string;
    content: ReactNode;
    icon?: LucideIcon;
    eyebrow?: string;
    plain?: boolean;
  }> = [
    {
      id: 'quick',
      label: 'Quick adjustments',
      icon: Gauge,
      eyebrow: 'Quick',
      content: (
        <QuickAdjustments
          context={context}
          levels={document.adjustments ?? {}}
          layerId={inspector.selection?.layerId}
        />
      ),
    },
    { id: 'launch-flight', label: 'Launch', content: <LaunchInspector {...context} /> },
    { id: 'geometry', label: 'Burst', content: <BurstInspector {...context} /> },
    {
      id: 'colour',
      label: 'Stars and colour',
      content: layerContext && <StarsInspector {...layerContext} />,
    },
    { id: 'trail', label: 'Trail', content: layerContext && <TrailInspector {...layerContext} /> },
    {
      id: 'fx-strobe',
      label: 'Modifiers',
      content: layerContext && <EffectInspector {...layerContext} />,
    },
    { id: 'ground', label: 'Ground', content: document.ground && <GroundInspector {...context} /> },
    { id: 'timeline', label: 'Timeline', content: <TimelineInspector {...context} /> },
    { id: 'sound', label: 'Sound', content: <SoundInspector {...context} /> },
    {
      id: 'variations',
      label: 'Variations',
      icon: Shuffle,
      eyebrow: 'Quick',
      plain: true,
      content: (
        <VariationsPanel document={document} disabled={disabled} onChange={extras.onChange} />
      ),
    },
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      eyebrow: 'Quick',
      content: extras.libraryParts && (
        <LibraryPanel
          document={document}
          selected={selectedAddress}
          disabled={disabled}
          initialParts={extras.libraryParts}
          onChange={extras.onChange}
        />
      ),
    },
    {
      id: 'reference',
      label: 'Reference video',
      icon: Film,
      eyebrow: 'Review',
      plain: true,
      content: extras.reference && <ReferencePanel reference={extras.reference} />,
    },
    {
      id: 'checks',
      label: 'Checks',
      icon: ShieldCheck,
      eyebrow: 'Review',
      plain: true,
      content: extras.particleCheck !== undefined && (
        <ChecksPanel document={document} result={extras.particleCheck} />
      ),
    },
  ];
  return panels
    .filter((panel) => panel.content && (panel.id !== 'launch-flight' || document.launch))
    .map((panel) => ({
      id: panel.id,
      label: panel.label,
      title: panel.label,
      eyebrow: panel.eyebrow ?? 'Renderer',
      icon: panel.icon ?? Sparkles,
      content: panel.plain ? (
        panel.content
      ) : (
        <div className="space-y-4">
          {selector}
          {reset && (
            <Button variant="secondary" onClick={reset} disabled={disabled}>
              Reset to effect design
            </Button>
          )}
          {inspector.failure && (
            <p role="alert" className="text-status-danger text-sm">
              {inspector.failure}
            </p>
          )}
          {panel.content}
        </div>
      ),
    }));
}
