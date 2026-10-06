import { upgradeDesign, type Design } from '@showcrafter/renderer';
import type { Json } from '@/lib/database.types';

const DESIGN_VERSION = 1; // Stored renderer schema version, from the package v1 contract.
/** A malformed stored document stays visible as a recoverable editor error. */
export type DesignResult = { ok: true; value: Design } | { ok: false; error: string };
/** Validates stored or submitted documents without filling missing fields. */
export function validateEditorDesign(value: unknown): DesignResult {
  try {
    return { ok: true, value: upgradeDesign(value, DESIGN_VERSION) };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : 'Invalid firework design.',
    };
  }
}
/** Serialises an already validated design for the database JSON boundary. */
export function designJson(value: Design): Json {
  return JSON.parse(JSON.stringify(value));
}
