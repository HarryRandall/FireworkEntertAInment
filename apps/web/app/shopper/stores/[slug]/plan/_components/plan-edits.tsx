/** Chip controls and rule prompts expose real persisted edits and explicit quantity diffs. */
'use client';
import { useState } from 'react';
import type { SavedPlan } from '@/lib/shopper/planner/contracts';
import {
  EDIT_CHIPS,
  MAX_EDIT_MESSAGE_LENGTH,
  type SavedEdit,
} from '@/lib/shopper/planner/edit-contracts';
import { currentCandidate } from '@/lib/shopper/planner/progress';
import { formatPrice } from '@/lib/shopper/paths';
import { Button } from '@/ui/primitives/button';
import { ChatBubble, ChatPrompt } from '@/ui/kit/chat';
import { Field } from '@/ui/kit/field';

/** Shows the change panel, keeping text and swap selection after a failed request. */
export function PlanEdits({
  plan,
  names,
  pending,
  onEdit,
}: {
  plan: SavedPlan;
  names: ReadonlyMap<string, string>;
  pending: boolean;
  onEdit: (source: 'chip' | 'rule', message: string, product?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState('');
  const candidate = currentCandidate(plan.plan_candidates);
  const products = [...new Set(candidate.cues.map((cue) => cue.product_id))];
  const selected = products.includes(product) ? product : products.at(0);
  return (
    <section data-section="plan-edits" className="grid min-w-0 gap-4 px-4">
      <Button
        variant="outline"
        disabled={pending}
        aria-expanded={open}
        aria-controls="change-panel"
        onClick={() => {
          setOpen(!open);
        }}
      >
        Change it
      </Button>
      {open ? (
        <div id="change-panel" className="grid min-w-0 gap-4">
          <h2 className="text-xl font-semibold">Change your show</h2>
          <p className="text-muted-foreground text-sm">
            Tap a change, or try "make it longer", "pet friendly" or "under 100". One change at a
            time, using simple rules. Changes are included in this session.
          </p>
          <div className="flex flex-wrap gap-2">
            {EDIT_CHIPS.filter((chip) => chip !== 'Swap this firework').map((chip) => (
              <Button
                key={chip}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  onEdit('chip', chip);
                }}
              >
                {chip}
              </Button>
            ))}
          </div>
          <Field
            id="swap-product"
            label="Firework to swap"
            help="Replaces all units of this firework within your budget and safety limits."
          >
            <select
              id="swap-product"
              aria-describedby="swap-product-help"
              value={selected ?? ''}
              disabled={pending}
              onChange={(event) => {
                setProduct(event.target.value);
              }}
              className="border-input bg-card w-full min-w-0 rounded-md border p-3 text-sm"
            >
              {products.map((id) => (
                <option key={id} value={id}>
                  {names.get(id) ?? 'Unavailable firework'}
                </option>
              ))}
            </select>
          </Field>
          <Button
            variant="outline"
            disabled={pending || selected === undefined}
            onClick={() => {
              onEdit('chip', 'Swap this firework', selected);
            }}
          >
            Swap this firework
          </Button>
          <ChatPrompt
            maxLength={MAX_EDIT_MESSAGE_LENGTH}
            pending={pending}
            onSubmit={(message) => {
              onEdit('rule', message);
            }}
          />
          {pending ? (
            <p role="status">Checking the change against stock, safety and budget...</p>
          ) : null}
        </div>
      ) : null}
      <EditHistory edits={plan.plan_edits} />
    </section>
  );
}
function EditHistory({ edits }: { edits: SavedEdit[] }) {
  if (edits.length === 0) return null;
  return (
    <section
      data-section="plan-diff"
      aria-label="Changes to your show"
      className="grid min-w-0 gap-4"
      aria-live="polite"
    >
      {[...edits]
        .sort((left, right) => left.seq - right.seq)
        .map((edit) => (
          <div key={edit.id} className="grid min-w-0 gap-2 break-words">
            <ChatBubble from="user">{edit.message}</ChatBubble>
            <ChatBubble from="assistant">{edit.reply}</ChatBubble>
            {edit.diff ? <EditDiff edit={edit} /> : null}
          </div>
        ))}
    </section>
  );
}
function EditDiff({ edit }: { edit: SavedEdit }) {
  const diff = edit.diff;
  if (!diff) return null;
  return (
    <div className="border-border bg-card grid min-w-0 gap-2 rounded-xl border p-4 text-sm">
      <h3 className="font-semibold">What changed</h3>
      <p>
        Total before: {formatPrice(diff.total_before, diff.currency)} · Total after:{' '}
        {formatPrice(diff.total_after, diff.currency)}
      </p>
      <ul className="grid gap-2">
        {(['removed', 'added'] as const).flatMap((kind) =>
          diff[kind].map((item) => (
            <li key={`${kind}:${item.product_id}`}>
              <b>{kind === 'added' ? 'Added' : 'Removed'}:</b> {item.quantity} × {item.name} ·{' '}
              {formatPrice(item.quantity * item.unit_price_minor, diff.currency)}
            </li>
          )),
        )}
      </ul>
      {diff.added.length + diff.removed.length === 0 ? (
        <p>Same fireworks, with revised timing and pacing.</p>
      ) : null}
    </div>
  );
}
