"use client";

import { useActionState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import {
  generateCuesFromAnalysisAction,
  type GenerateCuesActionState,
} from "@/app/actions/show-generation";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { InlineAlert } from "@/app/components/ui/Feedback";
import { Textarea } from "@/app/components/ui/Input";

type ShowGenerationPanelProps = {
  showId: string;
  showSlug: string;
  canGenerate: boolean;
};

const initialState: GenerateCuesActionState = { status: "idle" };

export function ShowGenerationPanel({
  showId,
  showSlug,
  canGenerate,
}: ShowGenerationPanelProps) {
  const [state, formAction, pending] = useActionState(
    generateCuesFromAnalysisAction,
    initialState,
  );

  return (
    <Card
      elevation="high"
      radius="md"
      className="space-y-5 p-6"
    >
      <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
        <Wand2 size={18} strokeWidth={1.75} className="text-primary" />
        Generate show cues
      </h3>
      <p className="text-sm leading-relaxed text-on-surface-variant">
        Use the latest music analysis to create timed product cues for the
        preview, shopping list, show guide, and export.
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="showId" value={showId} />
        <input type="hidden" name="showSlug" value={showSlug} />
        <Textarea
          name="brief"
          rows={4}
          placeholder="Optional notes, e.g. keep the finale intense but avoid overfilling the intro."
        />

        {!canGenerate ? (
          <InlineAlert tone="warning" title="Analysis required">
            Run audio analysis first, then generate cues from the stored result.
          </InlineAlert>
        ) : null}
        {state.status === "error" && state.message ? (
          <InlineAlert tone="danger" title="Cue generation failed">
            {state.message}
          </InlineAlert>
        ) : null}
        {state.status === "success" && state.message ? (
          <InlineAlert tone="success" title="Cues generated">
            {state.message}
          </InlineAlert>
        ) : null}

        <Button
          type="submit"
          loading={pending}
          disabled={!canGenerate || pending}
          className="w-full justify-center"
        >
          <RefreshCw size={16} strokeWidth={2} />
          Regenerate cues
        </Button>
      </form>
    </Card>
  );
}
