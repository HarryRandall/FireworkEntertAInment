'use client';

/** Per-row catalogue product admin actions menu. */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { RowActionsMenu, toast } from '@/app/components/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteProduct } from '@/app/actions/admin-catalogue';
import { ProductFormDialog } from './ProductFormDialog';
import type { ProductInputType } from '@/app/actions/admin-catalogue';

type Props = {
  product: { id: string } & ProductInputType;
};

export function ProductRowActions({ product }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteProduct({ id: product.id });
      if (result.ok) {
        toast.success('Product deleted');
        router.refresh();
      } else toast.error(result.error);
      setConfirmOpen(false);
    });
  };

  return (
    <>
      <RowActionsMenu
        items={[
          { label: 'Edit', icon: <Pencil size={14} />, onSelect: () => setEditOpen(true) },
          {
            label: 'Delete',
            icon: <Trash2 size={14} />,
            destructive: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
      <ProductFormDialog initial={product} open={editOpen} onOpenChange={setEditOpen} />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{product.name}</strong> from the catalogue. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="bg-[color:var(--color-status-danger)] text-white hover:bg-[color:var(--color-status-danger)]/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
