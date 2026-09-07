'use client';

/**
 * Opens the real consumer QR entry point for a live assortment in a new
 * tab — the same /a/[token] route a shopper lands on after scanning the
 * physical QR code, via the same ensureAssortmentPublicLink action the
 * real AssortmentEditor's QR button uses. Not a simulation: no real cue
 * generation or credit spend happens here either way — that only occurs if
 * the retailer goes on to actually generate a show in the opened tab.
 *
 * ensureAssortmentPublicLink calls the ensure_assortment_public_link RPC
 * from FIR-168's migration, which isn't applied to this database yet (see
 * FIR-166 notes) — until it is, this surfaces that action's own "reusable
 * QR link could not be created" error rather than failing silently.
 */

import { useState, useTransition } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button, Card } from '@/components/design-system';
import { toast } from '@/components/design-system/toast';
import { cn } from '@/lib/utils';
import { ensureAssortmentPublicLink } from '@/app/actions/admin-assortments';
import type { AdminAssortmentSummary } from '@/lib/admin/assortments.server';

export function TestShowSimulator({ assortments }: { assortments: AdminAssortmentSummary[] }) {
  const [selectedId, setSelectedId] = useState(assortments[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  const selected = assortments.find((assortment) => assortment.id === selectedId) ?? null;

  function openConsumerEntry() {
    if (!selected) return;
    startTransition(async () => {
      const result = await ensureAssortmentPublicLink(selected.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(
        `${window.location.origin}/a/${result.publicToken}`,
        '_blank',
        'noopener,noreferrer',
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {assortments.map((assortment) => {
          const active = assortment.id === selectedId;
          return (
            <Card
              key={assortment.id}
              role="radio"
              tabIndex={0}
              aria-checked={active}
              onClick={() => setSelectedId(assortment.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(assortment.id);
                }
              }}
              className={cn(
                'focus-visible:ring-ring/50 cursor-pointer p-4 transition-colors focus:outline-none focus-visible:ring-3',
                active ? 'border-primary bg-primary/5' : 'hover:bg-muted/60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground text-sm font-medium">{assortment.name}</span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  ${(assortment.priceCents / 100).toFixed(2)}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {assortment.itemCount} product{assortment.itemCount === 1 ? '' : 's'}
              </p>
            </Card>
          );
        })}
      </div>

      <div>
        <Button onClick={openConsumerEntry} disabled={!selected || isPending}>
          <ExternalLink size={16} />
          {isPending ? 'Opening…' : 'Open consumer entry'}
        </Button>
      </div>
    </div>
  );
}
