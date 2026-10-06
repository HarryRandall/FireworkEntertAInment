/** Version-gated schema validation for stored firework design documents. */
import { designSchema, type Design } from './design.generated';
import { DESIGN_SCHEMA_VERSION } from '../version';

/** Validates a versioned document without defaulting, converting or mutating it. */
export function upgradeDesign(doc: unknown, fromVersion: number): Design {
  if (fromVersion !== DESIGN_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported design schema version: ${String(fromVersion)}. Expected 1.`);
  }
  return designSchema.parse(doc);
}
