// Candidate documents use the same clocks and fields as stored show cues.

/** Dimensionless score components in the inclusive interval zero to one. */
export type PlanScores = {
  variety: number;
  pacing: number;
  budget_use: number;
  look_match: number;
};
/** Ranking priorities, normalised by their sum at evaluation. */
export type SolverWeights = PlanScores;
/** Intentional energy trajectories used to explore different assortments. */
export type PlanMood = 'gentle' | 'balanced' | 'big_finale';
/** One purchased unit, not one internal cake tube; position is metres, angle is degrees from vertical. */
export type PlanCue = {
  t_ms: number;
  product_id: string;
  position: number;
  angle_deg: number;
  beat: number | null;
};
/** Ranked, persistable candidate; duration is the last visible end in milliseconds from show start. */
export type PlanCandidate = {
  rank: number;
  mood: PlanMood;
  headline_product_id: string;
  cues: PlanCue[];
  total_minor: number;
  currency: string;
  duration_ms: number;
  scores: PlanScores;
  score: number;
};
/** Expected input/eligibility failures are returned, while unexpected implementation errors remain visible. */
export type PlanResult =
  | { status: 'invalid_input'; issues: string[] }
  | { status: 'infeasible'; input_hash: string; reason: string }
  | {
      status: 'ok';
      input_hash: string;
      stock_snapshot_hash: string;
      candidates: PlanCandidate[];
      exhausted: boolean;
    };
