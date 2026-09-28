/** Inspector for the selected show preset cue. */
'use client';

import { ChevronDown, Copy, PackagePlus, Trash2 } from 'lucide-react';
import { Badge } from '@/ui/patterns/Badge';
import { Button } from '@/ui/patterns/Button';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input } from '@/ui/patterns/Input';
import { SelectField } from '@/ui/patterns/SelectField';
import type { FireworkSpecification } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import {
  LocalCue,
  paletteOf,
  productKindOf,
  productLabel,
  productSummary,
} from './show-preset-model';

export function CueInspector({
  cue,
  product,
  busy,
  onCueChange,
  onReplaceProduct,
  onDuplicate,
  onDelete,
}: {
  cue: LocalCue | null;
  product: FireworkSpecification | undefined;
  busy: boolean;
  onCueChange: (patch: Partial<LocalCue>) => void;
  onReplaceProduct: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  if (!cue) {
    return (
      <aside className="border-border bg-card flex max-h-[520px] min-h-0 flex-col justify-between rounded-lg border p-4">
        <div>
          <h2 className="text-foreground text-sm font-semibold">Cue inspector</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Select a timeline clip or insert a catalogue item to start editing cue timing.
          </p>
        </div>
        <Badge tone="neutral">No cue selected</Badge>
      </aside>
    );
  }

  const palette = paletteOf(product);

  return (
    <aside className="border-border bg-card flex max-h-[520px] min-h-0 flex-col overflow-hidden rounded-lg border">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-foreground text-sm font-semibold">Cue inspector</h2>
            <p className="text-muted-foreground mt-1 truncate text-xs">
              {product ? productLabel(product) : 'Unresolved catalogue item'}
            </p>
          </div>
          {product ? (
            <Badge tone={productKindOf(product) === 'multishot' ? 'accent' : 'info'} solid>
              {productKindOf(product)}
            </Badge>
          ) : null}
        </div>

        <div className="border-border bg-muted flex items-center gap-3 rounded-lg border p-3">
          <span
            className="h-9 w-9 shrink-0 rounded-md border border-white/10"
            style={{
              background: `linear-gradient(135deg, ${palette.primary}, ${palette.secondary})`,
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {product?.name ?? cue.catalogueItemSlug}
            </p>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {product ? productSummary(product) : 'Needs a catalogue item'}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 px-2"
            onClick={onReplaceProduct}
          >
            <PackagePlus size={14} /> Change
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="cue-time">Fires at</FieldLabel>
            <Input
              id="cue-time"
              type="number"
              min={0}
              step="0.1"
              className="font-mono tabular-nums"
              value={cue.timeSeconds}
              onChange={(event) => onCueChange({ timeSeconds: Number(event.target.value) })}
            />
          </Field>

          <Field>
            <FieldLabel>Position</FieldLabel>
            <SelectField
              value={String(cue.launchPositionIndex)}
              onChange={(value) => onCueChange({ launchPositionIndex: Number(value) })}
              options={[
                { value: '0', label: 'Position 1' },
                { value: '1', label: 'Position 2' },
                { value: '2', label: 'Position 3' },
              ]}
            />
          </Field>
        </div>

        <details className="group border-border rounded-lg border">
          <summary className="text-foreground focus-visible:ring-border-emphasis flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none">
            Cue options
            <ChevronDown
              size={15}
              className="text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="border-border border-t p-3">
            <Field>
              <FieldLabel>Emphasis</FieldLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'accent', 'peak'] as const).map((emphasis) => (
                  <button
                    key={emphasis}
                    type="button"
                    aria-pressed={cue.emphasis === emphasis}
                    onClick={() => onCueChange({ emphasis })}
                    className={cn(
                      'focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-xs font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2',
                      cue.emphasis === emphasis
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {emphasis}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </details>
      </div>

      <div className="border-border bg-card grid shrink-0 grid-cols-2 gap-2 border-t p-3">
        <Button variant="secondary" onClick={onDuplicate} disabled={busy}>
          <Copy size={14} /> Duplicate
        </Button>
        <Button variant="destructive" onClick={onDelete} disabled={busy}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </aside>
  );
}
