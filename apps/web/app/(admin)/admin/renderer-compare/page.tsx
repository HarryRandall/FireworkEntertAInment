import { notFound } from 'next/navigation';
import { upgradeDesign } from '@showcrafter/renderer';
import review from '../../../../../../scripts/catalogue/review.json';
import { requirePermission } from '@/lib/access/current-profile.server';
import { getServerClient } from '@/lib/admin/supabase';
import { validateCatalogueRender } from '@/lib/admin/renderer-validation';
import { unmatchedRendererSettings } from '@/lib/renderer-compare';
import { SectionHeader } from '@/ui/patterns/SectionHeader';
import { RendererComparison } from './_components/RendererComparison';
import type { ComparisonRow } from './_components/types';

/** Loads current saved designs for the original catalogue inside the admin boundary. */
export default async function RendererComparePage() {
  if (!(await requirePermission('admin.manage_catalogue'))) notFound();
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('fireworks')
    .select(
      'id, slug, name, caliber, duration_seconds, render_snapshot_json, render_overrides_json, design, design_schema',
    )
    .in(
      'slug',
      review.fireworks.map((firework) => firework.slug),
    )
    .order('name');
  if (error) throw new Error('The renderer comparison could not be loaded.', { cause: error });
  const rows: ComparisonRow[] = (data ?? []).map((row) => {
    const old = validateCatalogueRender({
      kind: 'firework',
      recordId: row.id,
      settings: row.render_snapshot_json,
    });
    let newDesign: ComparisonRow['newDesign'] = null;
    let designError: string | null = null;
    try {
      if (row.design !== null) newDesign = upgradeDesign(row.design, row.design_schema);
      else designError = 'This firework has no new design yet.';
    } catch {
      designError = 'The saved new design is invalid.';
    }
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      caliber: row.caliber,
      durationSeconds: row.duration_seconds,
      oldDesign: old.ok ? old.design : null,
      newDesign,
      error: designError ?? (old.ok ? null : 'The old render snapshot is invalid.'),
      unmatchedSettings: unmatchedRendererSettings(row.render_overrides_json),
      notes: review.fireworks.find((firework) => firework.slug === row.slug)?.notes ?? [],
    };
  });
  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Renderer comparison"
        description="Review current saved catalogue designs. Open one firework at a time to compare both renderers and the settings that need visual review."
      />
      <RendererComparison rows={rows} />
    </div>
  );
}
