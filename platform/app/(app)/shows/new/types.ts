/**
 * Shared types for the new-show flow. All pure type declarations — no I/O.
 */

/** The single field that's currently failing inline validation, if any. */
export type FieldError = 'title' | null;

/** State of the per-file audio upload state machine in the flow. */
export type AudioUploadState = 'idle' | 'uploading' | 'ready' | 'error';

/** Customer-safe generation settings used to render the correct planner and
 * current database-backed credit costs in the wizard. */
export type ShowGenerationPresentation = {
  generationMode: 'fast' | 'llm';
  defaultCueModel: string;
  fastCreditCost: number;
  modelCreditCosts: Record<string, number>;
};

/** Successfully-uploaded audio metadata persisted to the create-show form. */
export type UploadedAudio = {
  audioPath: string;
  musicAnalysisId: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
};
