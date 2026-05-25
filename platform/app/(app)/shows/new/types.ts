/**
 * Shared types for the new-show wizard. All pure type declarations — no I/O.
 */
import type { TIME_OF_DAY } from './constants';

/** The single field that's currently failing inline validation, if any. */
export type FieldError = 'location' | 'title' | null;

/** State of the per-file audio upload state machine in the wizard. */
export type AudioUploadState = 'idle' | 'uploading' | 'ready' | 'error';

/** Successfully-uploaded audio metadata persisted to the create-show form. */
export type UploadedAudio = {
  audioPath: string;
  musicAnalysisId: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
};

/** Narrow union of the time-of-day choices. */
export type TimeOfDay = (typeof TIME_OF_DAY)[number]['value'];
