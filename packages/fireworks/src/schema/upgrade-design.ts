import { designSchema, type Design } from './design.generated';
import { DESIGN_SCHEMA_VERSION } from '../version';

/** Validate v1 without defaulting, converting or mutating the stored document. */
export function upgradeDesign(doc: unknown, fromVersion: number): Design {
  if (fromVersion !== DESIGN_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported design schema version: ${fromVersion}. Expected 1.`);
  }
  return designSchema.parse(doc);
}
