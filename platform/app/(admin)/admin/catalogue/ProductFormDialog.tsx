"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { toast } from "@/app/components/ui/toast";
import {
  createProduct,
  updateProduct,
  type ProductInputType,
} from "@/app/actions/admin-catalogue";

type Values = ProductInputType & { id?: string };

type Props = {
  initial?: Values;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
};

export function ProductFormDialog({ initial, open: controlledOpen, onOpenChange, trigger }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };

  const [partNumber, setPartNumber] = useState(initial?.partNumber ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? "");
  const [fireworkType, setFireworkType] = useState(initial?.fireworkType ?? "");
  const [duration, setDuration] = useState(
    initial?.durationSeconds != null ? String(initial.durationSeconds) : "",
  );
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setPartNumber(initial?.partNumber ?? "");
      setName(initial?.name ?? "");
      setManufacturer(initial?.manufacturer ?? "");
      setFireworkType(initial?.fireworkType ?? "");
      setDuration(initial?.durationSeconds != null ? String(initial.durationSeconds) : "");
    }
  }, [open, initial]);

  const submit = () => {
    startTransition(async () => {
      const values: ProductInputType = {
        partNumber,
        name,
        manufacturer,
        fireworkType,
        durationSeconds: duration === "" ? null : Number(duration),
      };
      const result = isEdit
        ? await updateProduct({ id: initial!.id!, ...values })
        : await createProduct(values);
      if (result.ok) {
        toast.success(isEdit ? "Product updated" : "Product created");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : controlledOpen === undefined ? (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus size={14} /> New product
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>Catalogue product visible to show-builders.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Part number">
              <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required />
            </Field>
            <Field label="Duration (s)">
              <Input
                type="number"
                min={0}
                step={0.1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="—"
              />
            </Field>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manufacturer">
              <Input value={manufacturer ?? ""} onChange={(e) => setManufacturer(e.target.value)} />
            </Field>
            <Field label="Type">
              <Input value={fireworkType ?? ""} onChange={(e) => setFireworkType(e.target.value)} />
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={isPending}>
              {isEdit ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-[color:var(--color-content-subtle)]">{label}</span>
      {children}
    </label>
  );
}
