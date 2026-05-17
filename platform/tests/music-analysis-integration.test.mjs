import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

test("music analysis generation action replaces generated cues without dropping manual cues", () => {
  const action = readFileSync(join(root, "app/actions/show-generation.ts"), "utf8");

  assert.match(action, /const GENERATED_TRACK = "music-analysis"/);
  assert.match(action, /\.from\("show_cues"\)\s*\.delete\(\)/);
  assert.match(action, /\.eq\("track", GENERATED_TRACK\)/);
  assert.match(action, /\.eq\("locked", false\)/);
  assert.match(action, /\.from\("show_cues"\)\.insert\(cueRows\)/);
  assert.match(action, /reindexShowCuesByTimeline\(supabase, typedShow\.id\)/);
  assert.match(action, /effects_count: cueCount/);
});

test("music cue planner has deterministic guardrails and energy fallback", () => {
  const planner = readFileSync(join(root, "lib/music-cue-planner.ts"), "utf8");

  assert.match(planner, /function energyFallbackCues/);
  assert.match(planner, /\.\.\.energyFallbackCues\(input\.analysis, duration\)/);
  assert.match(planner, /function chooseLaunchPosition/);
  assert.match(planner, /function stableSeed/);
  assert.match(planner, /return seed % 2147483647/);
  assert.match(planner, /briefAdjustment/);
});

test("show page generation panel submits the server action from the timeline", () => {
  const panelPath = join(root, "app/components/app/ShowGenerationPanel.tsx");
  assert.equal(existsSync(panelPath), true);

  const panel = readFileSync(panelPath, "utf8");
  assert.match(panel, /useActionState/);
  assert.match(panel, /generateCuesFromAnalysisAction/);
  assert.match(panel, /Regenerate cues/);
});
