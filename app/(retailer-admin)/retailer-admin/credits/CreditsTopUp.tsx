'use client';

/** Local-only top-up preview: selecting a tier does not charge a payment method or change any balance. See FIR-166. */

import { useState } from 'react';
import { Button, Card } from '@/components/design-system';
import { toast } from '@/components/design-system/toast';
import { cn } from '@/lib/utils';
import type { DummyCreditTier } from '../_lib/dummy-data';

export function CreditsTopUp({ tiers }: { tiers: DummyCreditTier[] }) {
  const [selected, setSelected] = useState<number>(
    tiers.find((tier) => tier.popular)?.credits ?? tiers[0]?.credits ?? 0,
  );

  return (
    <Card className="p-5" shadow>
      <h3 className="text-foreground mb-4 text-sm font-semibold">Top up credits</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((tier) => {
          const active = tier.credits === selected;
          return (
            <button
              key={tier.credits}
              type="button"
              onClick={() => setSelected(tier.credits)}
              aria-pressed={active}
              className={cn(
                'focus-visible:ring-ring/50 rounded-lg border p-3 text-center transition-colors focus:outline-none focus-visible:ring-3',
                active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60',
              )}
            >
              <div className="text-foreground font-mono text-lg font-semibold tabular-nums">
                {tier.credits.toLocaleString()}
              </div>
              <div className="text-muted-foreground text-xs">credits</div>
              <div className="text-muted-foreground mt-1 font-mono text-xs tabular-nums">
                {tier.price}
              </div>
              {tier.popular ? (
                <div className="text-primary mt-1 text-[10px] font-semibold tracking-wide uppercase">
                  Most popular
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <Button
        className="mt-4 w-full sm:w-auto"
        onClick={() => toast.info('Retailer billing is not wired up yet — nothing was charged.')}
      >
        Top up {selected.toLocaleString()} credits
      </Button>
    </Card>
  );
}
