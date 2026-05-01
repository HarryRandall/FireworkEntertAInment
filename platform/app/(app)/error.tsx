"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { InlineAlert } from "@/app/components/ui/Feedback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <InlineAlert tone="danger" title="This workspace view failed to load">
        {error.message || "Try again. If the issue persists, check the latest import or profile changes."}
      </InlineAlert>
      <Button type="button" onClick={reset} variant="secondary">
        <RotateCcw size={16} />
        Retry
      </Button>
    </div>
  );
}
