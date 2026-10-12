/** Admin word list for Finale VDL import: built-in meanings and saved overrides. */
import Link from 'next/link';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { BUILT_IN_VDL_TERMS, describeVdlTerm } from '@/lib/finale/vdl/glossary';
import { readVdlGlossaryRows } from '@/lib/finale/vdl/catalogue.server';
import { requirePermission } from '@/lib/access/current-profile.server';
import { VdlGlossaryEditor, type VdlWordRow } from './_components/VdlGlossaryEditor';

export default async function VdlGlossaryPage() {
  if (!(await requirePermission('admin.manage_catalogue')))
    return <InlineAlert tone="danger" title="Not permitted" />;
  const saved = await readVdlGlossaryRows();
  if (!saved.ok) return <InlineAlert tone="danger" title={saved.error} />;
  const savedByPhrase = new Map(saved.rows.map((row) => [row.phrase, row]));
  const rows: VdlWordRow[] = [
    ...Object.entries(BUILT_IN_VDL_TERMS).map(([phrase, term]) => {
      const override = savedByPhrase.get(phrase);
      const meaning = override?.definition ?? term;
      return {
        phrase,
        id: override?.id ?? null,
        source: override ? ('override' as const) : ('built-in' as const),
        meaning: describeVdlTerm(meaning),
        definition: JSON.stringify(meaning, null, 2),
        notes: override?.notes ?? '',
      };
    }),
    ...saved.rows
      .filter((row) => !Object.hasOwn(BUILT_IN_VDL_TERMS, row.phrase))
      .map((row) => ({
        phrase: row.phrase,
        id: row.id,
        source: 'added' as const,
        meaning: describeVdlTerm(row.definition),
        definition: JSON.stringify(row.definition, null, 2),
        notes: row.notes ?? '',
      })),
  ].sort((a, b) => a.phrase.localeCompare(b.phrase));
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">VDL words</h1>
        <p className="text-muted-foreground text-sm">
          How each Finale VDL word changes a firework when a cake line is imported.{' '}
          <Link className="underline" href="/admin/multishots">
            Back to multishots
          </Link>
        </p>
      </div>
      {saved.invalid.length ? (
        <InlineAlert tone="warning" title="Some saved words are ignored">
          These saved meanings no longer validate: {saved.invalid.join(', ')}.
        </InlineAlert>
      ) : null}
      <VdlGlossaryEditor rows={rows} />
    </div>
  );
}
