// Stable SHA-256 cache identities include every selection-affecting snapshot and solver setting.
import { createHash } from 'node:crypto';
import type { PlannerInput } from './input.ts';
import type { SolverWeights } from './types.ts';
import { SOLVER_VERSION } from './config.ts';

/** Lexical ordering is independent of the runtime locale and does not mutate inputs. */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : Number(left > right);
}

/** Hashes validated inputs; clocks remain explicit data, never the current wall clock. */
export function hashPlannerInput(
  input: PlannerInput,
  weights: SolverWeights,
): {
  input_hash: string;
  stock_snapshot_hash: string;
} {
  const products = [...input.products]
    .sort((a, b) => compareText(a.product_id, b.product_id))
    .map((product) => ({
      ...product,
      colours: [...product.colours].sort(compareText),
      tags: [...product.tags].sort(compareText),
    }));
  const stock_snapshot_hash = digest(products);
  const normalised = {
    ...input,
    products: stock_snapshot_hash,
    answers: { ...input.answers, looks: [...new Set(input.answers.looks)].sort(compareText) },
    safety_band: {
      ...input.safety_band,
      allowed_categories: [...input.safety_band.allowed_categories].sort(compareText),
    },
    sale: { open: input.sale.open },
    age_confirmation:
      input.age_confirmation === null ? null : { minimum_age: input.age_confirmation.minimum_age },
    weights,
    solver: SOLVER_VERSION,
  };
  return { input_hash: digest(normalised), stock_snapshot_hash };
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => compareText(a, b))
      .map(([key, item]) => [key, canonical(item)]),
  );
}
