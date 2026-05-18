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
import { Input, Select } from "@/app/components/ui/Input";
import { toast } from "@/app/components/ui/toast";
import {
  createSupplier,
  updateSupplier,
  type SupplierInputType,
} from "@/app/actions/admin-suppliers";

type SupplierValues = SupplierInputType & { id?: string };

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

type Props = {
  initial?: SupplierValues;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SupplierFormDialog({ initial, trigger, open: controlledOpen, onOpenChange }: Props) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };

  const [name, setName] = useState(initial?.name ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [status, setStatus] = useState<SupplierInputType["status"]>(initial?.status ?? "draft");
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setContactEmail(initial?.contactEmail ?? "");
      setPhone(initial?.phone ?? "");
      setWebsiteUrl(initial?.websiteUrl ?? "");
      setStatus(initial?.status ?? "draft");
    }
  }, [open, initial]);

  const submit = () => {
    startTransition(async () => {
      const values: SupplierInputType = { name, contactEmail, phone, websiteUrl, status };
      const result = isEdit
        ? await updateSupplier({ id: initial!.id!, ...values })
        : await createSupplier(values);
      if (result.ok) {
        toast.success(isEdit ? "Supplier updated" : "Supplier created");
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
          <Button>
            <Plus size={16} /> New supplier
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update this supplier record." : "Add a new supplier to the catalogue."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Supplier name" />
          </Field>
          <Field label="Contact email">
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="hello@supplier.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61 …" />
            </Field>
            <Field label="Status">
              <Select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as SupplierInputType["status"])}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Website">
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={isPending}>
              {isEdit ? "Save changes" : "Create supplier"}
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
