'use client';

import { useEffect, useRef } from 'react';
import type { RenderDiagnostic } from '@showcrafter/fireworks/design';
import {
  renderDiagnosticSignature,
  uniqueRenderDiagnostics,
} from '@showcrafter/firework-editor/diagnostics';
import { EDITOR_PARTS } from '@showcrafter/firework-editor/parts';
import { sectionForField } from '@showcrafter/firework-editor/sections';
import { FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION } from '@/lib/firework-import/renderer-contract';
import { InlineAlert } from '@/ui/patterns/Feedback';
import { toast } from '@/ui/patterns/toast';

export type EditorRenderDiagnostics = {
  recordId: string;
  issues: readonly RenderDiagnostic[];
};

export function RendererDiagnostics({
  recordId,
  issues,
  availableParts,
  onSelect,
}: EditorRenderDiagnostics & {
  availableParts: readonly string[];
  onSelect: (id: string) => void;
}) {
  const reported = useRef(new Set<string>());
  const signature = renderDiagnosticSignature(issues);
  const invalid = issues.length > 0;
  useEffect(() => {
    if (!invalid) {
      toast.dismiss('firework-editor-validation');
      return;
    }
    if (reported.current.has(signature)) return;
    // Let the shared toaster subscribe on initial mount, including Strict Mode replay.
    const notification = window.setTimeout(() => {
      reported.current.add(signature);
      toast.error('Check the firework settings', {
        id: 'firework-editor-validation',
        description: 'The affected fields are listed in the settings panel. Saving is blocked.',
      });
    }, 0);
    return () => window.clearTimeout(notification);
  }, [invalid, signature]);

  if (!invalid) return null;
  return (
    <InlineAlert
      tone="danger"
      title="Invalid firework settings"
      className="mb-4 gap-2 p-3 break-words [&>div]:min-w-0"
    >
      <p>Fix the fields below before saving. Invalid settings cannot be previewed.</p>
      <ul className="mt-3 max-h-48 space-y-3 overflow-y-auto">
        {uniqueRenderDiagnostics(issues).map((issue, index) => {
          const partId = sectionForField(issue.path);
          const part = partId ? EDITOR_PARTS[partId] : undefined;
          const canNavigate = partId !== null && availableParts.includes(partId);
          return (
            <li key={index} className="space-y-1">
              <p className="text-foreground font-mono text-xs break-all">
                {issue.path.join('.') || 'Renderer document'}
              </p>
              <p>{issue.message}</p>
              {canNavigate && part ? (
                <button
                  type="button"
                  className="text-primary focus-visible:ring-ring rounded-sm text-left underline underline-offset-2 outline-none focus-visible:ring-2"
                  onClick={() => onSelect(partId)}
                >
                  Open {[...part.path, part.label].join(' / ')}
                </button>
              ) : (
                <p>Restore a saved version or correct the source record.</p>
              )}
            </li>
          );
        })}
      </ul>
      <details className="mt-3 text-xs">
        <summary className="focus-visible:ring-ring cursor-pointer rounded-sm outline-none focus-visible:ring-2">
          Diagnostic details
        </summary>
        <dl className="mt-2 space-y-1 break-all">
          <dt>Record</dt>
          <dd>{recordId}</dd>
          <dt>Renderer fingerprint</dt>
          <dd>{FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION}</dd>
        </dl>
      </details>
    </InlineAlert>
  );
}
