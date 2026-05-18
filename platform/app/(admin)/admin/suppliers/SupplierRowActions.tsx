"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { RowActionsMenu, toast } from "@/app/components/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteSupplier } from "@/app/actions/admin-suppliers";
import { SupplierFormDialog } from "./SupplierFormDialog";
import type { SupplierInputType } from "@/app/actions/admin-suppliers";

type Props = {
  supplier: { id: string } & SupplierInputType;
};

export function SupplierRowActions({ supplier }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onDelete = () => {
    startTransition(async () => {
      const result = await deleteSupplier({ id: supplier.id });
      if (result.ok) {
        toast.success("Supplier deleted");
        router.refresh();
      } else toast.error(result.error);
      setConfirmOpen(false);
    });
  };

  return (
    <>
      <RowActionsMenu
        items={[
          {
            label: "Edit",
            icon: <Pencil size={14} />,
            onSelect: () => setEditOpen(true),
          },
          {
            label: "Delete",
            icon: <Trash2 size={14} />,
            destructive: true,
            onSelect: () => setConfirmOpen(true),
          },
        ]}
      />
      <SupplierFormDialog initial={supplier} open={editOpen} onOpenChange={setEditOpen} />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{supplier.name}</strong> from the catalogue.
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
