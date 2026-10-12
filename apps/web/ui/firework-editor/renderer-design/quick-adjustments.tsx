/** Seven-step adjective rows edit the design's stored relative adjustment levels. */
'use client';
import { RadioGroup } from 'radix-ui';
import {
  QUICK_LEVELS,
  levelWords,
  quickGroups,
  sharedLayerId,
  type QuickControl,
} from '@/lib/renderer-editor/quick-adjustments';
import { InspectorSection, type InspectorContext } from './inspector-controls';

/** Shows every row that applies to the design, with star rows bound to the selected group. */
export function QuickAdjustments({
  context,
  levels,
  layerId,
}: {
  context: InspectorContext;
  levels: Readonly<Record<string, number>>;
  layerId?: string;
}) {
  const groups = quickGroups(context.document, layerId);
  const shared = layerId !== undefined && sharedLayerId(context.document, layerId);
  const changed = Object.values(levels).some((level) => level !== 0);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Nudge the firework with the same words a VDL description uses, from Slightly to Very either
        side of the original. Changing a fine control afterwards bakes these levels into its values.
      </p>
      {groups.map((group) => (
        <InspectorSection key={group.title} title={group.title}>
          {group.controls.map((control) => (
            <QuickRow
              key={control.key}
              control={control}
              level={levels[control.key] ?? 0}
              disabled={context.disabled || (shared && control.key.startsWith('layer.'))}
              onChange={(level) => context.adjust(control.key, level)}
            />
          ))}
          {shared && group.title.startsWith('Stars') && (
            <p className="text-muted-foreground text-xs">
              Another break uses this star group&apos;s identifier. Use the fine controls to change
              only this group.
            </p>
          )}
        </InspectorSection>
      ))}
      {changed && (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs underline"
          disabled={context.disabled}
          onClick={() => {
            context.edit((draft) => {
              delete draft.adjustments;
            });
          }}
        >
          Reset all quick adjustments
        </button>
      )}
    </div>
  );
}

function QuickRow({
  control,
  level,
  disabled,
  onChange,
}: {
  control: QuickControl;
  level: number;
  disabled: boolean;
  onChange: (level: number) => void;
}) {
  return (
    <div className="grid gap-1.5" data-quick-key={control.key}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{control.label}</span>
        <span className="text-muted-foreground" aria-hidden>
          {levelWords(control, level)}
        </span>
      </div>
      <RadioGroup.Root
        aria-label={`${control.label} adjustment`}
        value={String(level)}
        disabled={disabled}
        orientation="horizontal"
        onValueChange={(value) => {
          const next = QUICK_LEVELS.find((candidate) => String(candidate) === value);
          if (next !== undefined) onChange(next);
        }}
        className="flex items-center justify-between gap-1"
      >
        {QUICK_LEVELS.map((candidate) => (
          <RadioGroup.Item
            key={candidate}
            value={String(candidate)}
            aria-label={`${control.label}: ${levelWords(control, candidate)}`}
            title={levelWords(control, candidate)}
            className={
              candidate === 0
                ? 'border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground focus-visible:ring-ring size-5 rounded-full border-2 outline-none focus-visible:ring-2 disabled:opacity-40'
                : 'border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:ring-ring size-4 rounded-full border outline-none focus-visible:ring-2 disabled:opacity-40'
            }
          />
        ))}
      </RadioGroup.Root>
      <div className="text-muted-foreground flex justify-between text-[11px]">
        <span>{control.low}</span>
        <span>{control.high}</span>
      </div>
    </div>
  );
}
