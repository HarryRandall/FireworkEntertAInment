/** Empty state for the My shows page when the user has no saved shows yet. */
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/design-system/Button';

export function ShowsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border-subtle)] px-6 py-16 text-center">
      <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-bg-subtle)] text-[color:var(--color-content-subtle)]">
        <Sparkles size={22} aria-hidden />
      </span>
      <h2 className="text-foreground text-lg font-semibold tracking-tight">No shows yet</h2>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
        Your saved firework shows will appear here. Create your first one to get started.
      </p>
      <Button href="/shows/new" className="mt-6 h-11 rounded-full px-5">
        Create a show
        <ArrowRight size={16} aria-hidden />
      </Button>
    </div>
  );
}
