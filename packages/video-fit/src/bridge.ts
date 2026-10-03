/** Line-delimited CPU scorer for the Python CMA-ES worker; stdout contains JSON only. */
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { RENDERER_VERSION, upgradeDesign, effectTemplates } from '@showcrafter/fireworks';
import designSchema from '@showcrafter/fireworks/schema/design.v1.json' with { type: 'json' };
import { parseEvidence, parseProposal, proposalDesign } from './contracts';
import { applyParameters, parametersFor, parameterValue } from './parameters';
import { renderFeatures } from './render';
import { scoreFeatures } from './score';
import type { Score } from './score';
import type { Evidence, Proposal } from './contracts';

// Protocol dimensions and population bounds prevent arbitrary allocations at the subprocess boundary.
const MIN_DIMENSIONS = 4;
const MAX_DIMENSIONS = 8;
const MAX_POPULATION = 16;
// Per-process descriptor cache budget, in scored designs; unchanged tubes reuse CPU raster work.
const MAX_CACHED_SCORES = 2048;
const scoreCache = new Map<string, Score>();
let cachedEvidence = '';
const vectorSchema = z
  .array(z.number().finite().min(0).max(1))
  .min(MIN_DIMENSIONS)
  .max(MAX_DIMENSIONS);
const requestSchema = z
  .object({
    evidence: z.unknown(),
    proposal: z.unknown(),
    letter: z.string().optional(),
    vectors: z.array(vectorSchema).max(MAX_POPULATION).optional(),
  })
  .strict();

function candidateScores(candidate: Proposal, evidence: Evidence): Score[] {
  const identity = JSON.stringify(evidence);
  if (identity !== cachedEvidence) {
    scoreCache.clear();
    cachedEvidence = identity;
  }
  return candidate.composition.tubes.map((tube, index) => {
    const effect = candidate.effects[tube.letter];
    const feature = evidence.features[index];
    if (!effect || !feature) {
      throw new Error('Complete candidate required');
    }
    const key = `${String(index)}:${JSON.stringify(effect)}`;
    const cached = scoreCache.get(key);
    if (cached) {
      return cached;
    }
    const score = scoreFeatures(feature, renderFeatures(proposalDesign(effect), evidence, index));
    if (scoreCache.size >= MAX_CACHED_SCORES) {
      scoreCache.clear();
    }
    scoreCache.set(key, score);
    return score;
  });
}

function evaluate(input: unknown): unknown {
  if (
    z
      .object({ catalogue: z.literal(true) })
      .strict()
      .safeParse(input).success
  ) {
    return {
      templates: effectTemplates.map(({ key, name, design }) => ({ key, name, kind: design.kind })),
      design_schema: designSchema,
    };
  }
  const request = requestSchema.parse(input);
  const evidence = parseEvidence(request.evidence);
  const proposal = parseProposal(request.proposal, evidence);
  const effects = Object.fromEntries(
    Object.entries(proposal.effects).map(([letter, effect]) => {
      const design = proposalDesign(effect);
      const parameters = parametersFor(design);
      const initial = parameters.map((parameter) =>
        Math.max(
          0,
          Math.min(
            1,
            (parameterValue(design, parameter.path) - parameter.minimum) /
              (parameter.maximum - parameter.minimum),
          ),
        ),
      );
      return [letter, { design, parameters, initial }];
    }),
  );
  const vectors = request.vectors ?? [null];
  const candidates = vectors.map((vector) => {
    const candidate = structuredClone(proposal);
    if (vector && request.letter !== undefined) {
      const effect = effects[request.letter];
      if (!effect) {
        throw new Error('Fitted effect required');
      }
      candidate.effects[request.letter] = {
        template: proposal.effects[request.letter]?.template ?? '',
        overrides: upgradeDesign(applyParameters(effect.design, vector), 1),
      };
    }
    const scores = candidateScores(candidate, evidence);
    return {
      proposal: candidate,
      scores: { shots: scores },
      overall: scores.reduce((sum, score) => sum + score.overall, 0) / scores.length,
      renderer: RENDERER_VERSION,
    };
  });
  return { effects, candidates };
}

const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  try {
    console.log(JSON.stringify(evaluate(JSON.parse(line))));
  } catch {
    console.log(JSON.stringify({ error: 'Invalid or unsupported fitting input' }));
  }
}
