/** Mutation controls keep confirmation, pending state and database refusals on the detail page. */
'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
import { Modal } from '@/ui/kit/overlays';
import { catalogueAction } from './catalogue-actions';

/** Offers authorised catalogue actions and requires confirmation before archiving. */
export function CatalogueControls({
  kind,
  id,
  draftId,
  archived,
  editable,
  pack = false,
}: {
  kind: 'effect' | 'product';
  id: string;
  draftId: string | null;
  archived: boolean;
  editable: boolean;
  pack?: boolean;
}) {
  const { pending, message, run } = useCatalogueMutation(kind, id, draftId);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return (
    <div className="grid gap-2" data-catalogue-controls data-hydrated={hydrated}>
      <div className="flex flex-wrap gap-2">
        {kind === 'effect' && (
          <Button asChild variant="outline">
            <Link href={`/admin/studio/${id}`}>Open in Studio</Link>
          </Button>
        )}
        {editable && (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                run('duplicate');
              }}
            >
              Duplicate
            </Button>
            {(draftId !== null || pack) && !archived && (
              <Button
                disabled={pending}
                onClick={() => {
                  run('publish');
                }}
              >
                Publish draft
              </Button>
            )}
            {!archived && <ArchiveControl pending={pending} message={message} run={run} />}
          </>
        )}
      </div>
      {message !== '' && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

function useCatalogueMutation(kind: 'effect' | 'product', id: string, draftId: string | null) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  function run(operation: 'duplicate' | 'archive' | 'publish') {
    setMessage('');
    startTransition(async () => {
      try {
        const result = await catalogueAction({ kind, id, operation, versionId: draftId });
        if (result.kind === 'error') {
          setMessage(result.message);
          return;
        }
        const successMessages = {
          archive: 'Archived.',
          publish: 'Published.',
          duplicate: 'Duplicated.',
        };
        setMessage(successMessages[operation]);
        if (result.href !== undefined) router.push(result.href);
        else router.refresh();
      } catch {
        setMessage('The action failed unexpectedly. Please retry.');
      }
    });
  }
  return { pending, message, run };
}

function ArchiveControl({ pending, message, run }: ReturnType<typeof useCatalogueMutation>) {
  return (
    <Modal
      title="Archive this item?"
      description="It will be hidden from the published catalogue. Published dependencies may prevent archiving; version history is kept."
      trigger={
        <Button variant="outline" disabled={pending}>
          Archive
        </Button>
      }
    >
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => {
          run('archive');
        }}
      >
        {pending ? 'Archiving...' : 'Confirm archive'}
      </Button>
      {message !== '' && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </Modal>
  );
}
