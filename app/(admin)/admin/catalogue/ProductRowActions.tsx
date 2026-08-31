'use client';

/** Per-row catalogue actions: metadata edit only. Linked rows can't be deleted. */

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { RowActionsMenu } from '@/components/design-system';
import { ProductFormDialog } from './ProductFormDialog';
import type { ProductInputType } from '@/app/actions/admin-catalogue';

type Props = {
  product: { id: string } & ProductInputType;
};

export function ProductRowActions({ product }: Props) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <RowActionsMenu
        items={[
          { label: 'Edit metadata', icon: <Pencil size={14} />, onSelect: () => setEditOpen(true) },
        ]}
      />
      <ProductFormDialog initial={product} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
