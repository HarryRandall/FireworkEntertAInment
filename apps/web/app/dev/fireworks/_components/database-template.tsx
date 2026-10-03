/** Explicit database template loading for the developer renderer review. */
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadTemplate } from '@/lib/supabase/load-template';
import type { entries } from './review-catalogue';

/** Loads the selected template with public credentials and surfaces configuration or read failures. */
export function DatabaseTemplate({
  selected,
  ready,
  select,
}: {
  selected: (typeof entries)[number];
  ready: boolean;
  select: (entry: (typeof entries)[number]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const entry = await loadTemplate(createClient(), selected.key);
      select(entry);
      setMessage(`Loaded ${entry.name} from the database.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The database template could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid gap-2">
      <button
        type="button"
        className="text-primary w-fit underline underline-offset-4"
        disabled={!ready || loading || selected.group === 'Fixtures'}
        onClick={() => {
          load().catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : 'The template load failed.');
          });
        }}
      >
        {loading ? 'Loading template...' : 'Load selected template from database'}
      </button>
      <p role="status" className="text-muted-foreground text-sm">
        {message}
      </p>
    </div>
  );
}
