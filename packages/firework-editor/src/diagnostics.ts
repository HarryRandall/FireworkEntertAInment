import type { RenderDiagnostic } from '@showcrafter/fireworks/design';

export function uniqueRenderDiagnostics(issues: readonly RenderDiagnostic[]): RenderDiagnostic[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = JSON.stringify([issue.path, issue.message, issue.recordId, issue.cueId]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Reordering compiler diagnostics must not produce a fresh notification. */
export function renderDiagnosticSignature(issues: readonly RenderDiagnostic[]): string {
  return JSON.stringify(
    uniqueRenderDiagnostics(issues)
      .map((issue) => JSON.stringify([issue.path, issue.message, issue.recordId, issue.cueId]))
      .sort(),
  );
}
