'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Archive, ArrowRight, Loader2 } from 'lucide-react';
import { deleteImportJobAction } from '@/app/actions/platform-admin';
import { Button } from '@/app/components/ui/Button';
import { toast } from '@/app/components/ui/toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ImportJobRowActions({
  id,
  sourceName,
  archived = false,
}: {
  id: string;
  sourceName: string;
  archived?: boolean;
}) {
  const router = useRouter();
  const mutationLockRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isDeleting, startDeleting] = useTransition();

  function deleteJob() {
    if (mutationLockRef.current) return;
    const formData = new FormData();
    formData.set('id', id);
    mutationLockRef.current = true;
    startDeleting(async () => {
      try {
        const result = await deleteImportJobAction(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setOpen(false);
        toast.success('Import job archived');
        router.refresh();
      } catch {
        toast.error('Import job could not be archived. Try again.');
      } finally {
        mutationLockRef.current = false;
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button href={`/admin/imports/${id}`} variant="secondary" size="sm">
        {archived ? 'Audit' : 'Review'}
        <ArrowRight size={15} aria-hidden="true" />
      </Button>
      {!archived ? (
        <AlertDialog
          open={open}
          onOpenChange={(nextOpen) => {
            if (!isDeleting) setOpen(nextOpen);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isDeleting}
              aria-label={`Archive ${sourceName}`}
            >
              <Archive size={16} aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive import job?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes <strong className="break-words">{sourceName}</strong> from the active
                import list. Its reconstruction runs, candidates and evidence are retained for
                audit.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  deleteJob();
                }}
                variant="destructive"
                disabled={isDeleting}
                aria-busy={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                ) : null}
                {isDeleting ? 'Archiving…' : 'Archive import job'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
