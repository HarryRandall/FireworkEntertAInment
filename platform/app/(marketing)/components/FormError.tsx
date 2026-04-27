import { AlertCircle } from "lucide-react";

export function FormError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger/8 px-3.5 py-2.5">
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-danger" />
      <p className="text-sm leading-snug text-danger">{message}</p>
    </div>
  );
}
