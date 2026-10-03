/** Client responses are validated before replacing the persisted planner view. */
import { z } from 'zod';
import { savedPlanSchema, type PlannerActionResult } from '../planner/contracts';
import { musicTrackSchema } from './contracts';
/** Explicit music search states preserve configuration, empty results and transport failures. */
export const musicSearchSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), tracks: z.array(musicTrackSchema) }),
  z.object({ status: z.literal('not_configured'), tracks: z.array(musicTrackSchema) }),
  z.object({ status: z.literal('error'), message: z.string() }),
  z.object({ status: z.literal('invalid'), message: z.string() }),
]);
const actionResultSchema = z.union([
  z.object({ status: z.literal('ok'), plan: savedPlanSchema }),
  z.object({
    status: z.enum(['unavailable', 'rate_limited', 'infeasible', 'exhausted', 'invalid']),
    message: z.string(),
  }),
]);
/** Sends only provider identity and displayed revision; returned plans retain analysis pins. */
export async function requestSoundtrack(request: unknown): Promise<PlannerActionResult> {
  const response = await fetch('/api/shopper/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error('Music change failed');
  return actionResultSchema.parse(await response.json());
}
