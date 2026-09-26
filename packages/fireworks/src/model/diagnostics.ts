import type { FireworkDesign } from './schema.ts';

export type RenderDiagnostic = {
  path: string[];
  message: string;
  recordId?: string;
  cueId?: string;
};
export type RenderResult =
  | { ok: true; design: FireworkDesign }
  | { ok: false; diagnostics: RenderDiagnostic[] };

export class RendererValidationError extends Error {
  readonly diagnostics: RenderDiagnostic[];
  constructor(diagnostics: RenderDiagnostic[]) {
    super(
      diagnostics
        .map((issue) => `${issue.path.join('.') || 'Renderer'}: ${issue.message}`)
        .join('; '),
    );
    this.diagnostics = diagnostics;
    this.name = 'RendererValidationError';
  }
}
