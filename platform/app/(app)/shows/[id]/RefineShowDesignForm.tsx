"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { FormError } from "@/app/(marketing)/components/FormError";
import { Textarea } from "@/app/components/ui/Input";
import { refineShowDesignAction } from "./actions";

type Props = {
  showId: string;
  showSlug: string;
};

export function RefineShowDesignForm({ showId, showSlug }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await refineShowDesignAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      router.push(result.redirectTo);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="showId" value={showId} />
      <input type="hidden" name="showSlug" value={showSlug} />
      <Textarea
        name="instruction"
        rows={5}
        required
        minLength={8}
        placeholder="How would you like to change the show? E.g., 'Make the finale more intense with tighter cyan and violet hits.'"
      />
      {error ? <FormError message={error} /> : null}
      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container py-3 font-bold text-on-primary-container shadow-[var(--shadow-cta)] transition-all active:scale-[0.98] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          size={16}
          strokeWidth={2}
          className={isPending ? "animate-spin" : undefined}
        />
        {isPending ? "Regenerating" : "Regenerate"}
      </button>
    </form>
  );
}
