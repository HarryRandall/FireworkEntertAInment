"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { InlineAlert } from "@/app/components/ui/Feedback";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <InlineAlert tone="danger" title="Admin data failed to load">
        {error.message || "Retry the request. If it continues, check database permissions and the latest migration."}
      </InlineAlert>
      <Button type="button" onClick={reset} variant="secondary">
        <RotateCcw size={16} />
        Retry
      </Button>
    </div>
  );
}
