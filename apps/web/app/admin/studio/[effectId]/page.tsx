/** Authorised Studio route validates the effect address and loads one stored renderer document. */
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireArea } from '@/lib/auth/server';
import { loadStudio } from '@/lib/studio/load';
import { WorkspaceShell } from '@/ui/shell/workspace-shell';
import { EmptyState } from '@/ui/kit/feedback';
import { StudioEditor } from './_components/studio-editor';

/** Loads an active draft or published version under caller RLS, without writing on page open. */
export default async function Page({ params }: { params: Promise<{ effectId: string }> }) {
  const identity = await requireArea('admin');
  const { effectId } = await params;
  if (!z.string().uuid().safeParse(effectId).success) notFound();
  const item = await loadStudio(effectId);
  if (!item) notFound();
  if (item.kind === 'empty')
    return (
      <WorkspaceShell area="admin" identity={identity.workspace}>
        <h1 className="mb-4 text-2xl font-semibold">{item.effect.name}</h1>
        <EmptyState title="No design to edit">
          This firework has no draft or published design.
        </EmptyState>
      </WorkspaceShell>
    );
  return (
    <StudioEditor
      key={effectId}
      effectId={effectId}
      title={item.effect.name}
      initialDocument={item.document}
      versionId={item.versionId}
      sourceVersionId={item.sourceVersionId}
      editable={
        item.effect.status !== 'archived' &&
        ['super_admin', 'catalogue_editor'].includes(identity.access.staffRole ?? '')
      }
      identity={identity.workspace}
    />
  );
}
