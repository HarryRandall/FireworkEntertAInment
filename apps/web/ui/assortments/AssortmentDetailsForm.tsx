'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminAssortmentDetail } from '@/lib/admin/assortments.server';
import { updateAssortment } from '@/app/actions/admin-assortments';
import { Button } from '@/ui/patterns/Button';
import { Card } from '@/ui/patterns/Card';
import { Field, FieldLabel } from '@/ui/patterns/Field';
import { Input, Textarea } from '@/ui/patterns/Input';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { Toggle } from '@/ui/patterns/Toggle';
import { toast } from '@/ui/patterns/toast';

export function AssortmentDetailsForm({ assortment }: { assortment: AdminAssortmentDetail }) {
  const router = useRouter();
  const initialDraft = {
    name: assortment.name,
    description: assortment.description ?? '',
    price: (assortment.priceCents / 100).toFixed(2),
    isActive: assortment.isActive,
  };
  const [draft, setDraft] = useState(initialDraft);
  const dirty =
    draft.name !== assortment.name ||
    draft.description !== (assortment.description ?? '') ||
    Math.round(Number(draft.price) * 100) !== assortment.priceCents ||
    draft.isActive !== assortment.isActive;
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startSaving(async () => {
      try {
        const result = await updateAssortment({
          id: assortment.id,
          name: String(data.get('name') ?? '').trim(),
          description: String(data.get('description') ?? '').trim() || undefined,
          priceCents: Math.round(Number(data.get('price')) * 100),
          isActive: data.has('active'),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDraft((current) => ({
          ...current,
          name: current.name.trim(),
          description: current.description.trim(),
        }));
        toast.success('Assortment saved');
        router.refresh();
      } catch {
        setError(
          'The assortment could not be saved. Your changes are still here. Please try again.',
        );
      }
    });
  }

  return (
    <Card className="p-5 sm:p-6">
      <form
        onSubmit={save}
        onReset={(event) => {
          event.preventDefault();
          setDraft(initialDraft);
          setError(null);
        }}
      >
        <fieldset disabled={saving} className="space-y-5">
          <SectionHeader
            size="sm"
            title="Pack details"
            description="The name, description and price shown to shoppers."
          />
          <Field>
            <FieldLabel htmlFor="assortment-name">Name</FieldLabel>
            <Input
              id="assortment-name"
              name="name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              required
              maxLength={120}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="assortment-description">Description</FieldLabel>
            <Textarea
              id="assortment-description"
              name="description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="What makes this pack special?"
            />
          </Field>
          <Field className="max-w-48">
            <FieldLabel htmlFor="assortment-price">Pack price (USD)</FieldLabel>
            <Input
              id="assortment-price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            />
          </Field>
          <Toggle
            name="active"
            checked={draft.isActive}
            onChange={(isActive) => setDraft({ ...draft, isActive })}
            label="Available to shoppers"
            description="Turn off to keep this assortment as a draft."
          />
          {error ? (
            <InlineAlert tone="danger" title="Could not save assortment">
              {error}
            </InlineAlert>
          ) : null}
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p role="status" className="text-muted-foreground text-xs">
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </p>
            <div className="flex items-center gap-2">
              {dirty ? (
                <Button type="reset" variant="ghost">
                  Reset
                </Button>
              ) : null}
              <Button type="submit" loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </Card>
  );
}
