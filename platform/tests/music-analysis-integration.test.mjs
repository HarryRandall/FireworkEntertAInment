import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

test("audio analysis route stores song analysis artifacts only", () => {
  const route = readFileSync(join(root, "app/api/analyze/route.ts"), "utf8");

  assert.match(route, /audio_path: show\.audio_path/);
  assert.match(route, /personality: parsed\.data\.personality/);
  assert.match(route, /runner_version: ANALYSER_RUNNER_VERSION/);
  assert.match(route, /llm_payload: llmPayload/);
  assert.match(route, /markdown/);
  assert.match(route, /stripFireworkRecommendationsFromAnalysis/);
  assert.match(route, /stripFireworkRecommendationsFromPayload/);
  assert.doesNotMatch(route, /personality_preset/);
  assert.doesNotMatch(route, /source_audio_path/);
  assert.doesNotMatch(route, /compact_payload/);
  assert.doesNotMatch(route, /analysis_storage_path/);
});

test("show analyses migration matches the current database contract", () => {
  const migration = readFileSync(
    join(root, "supabase/migrations/20260512090000_show_analyses.sql"),
    "utf8",
  );

  assert.match(migration, /audio_path text NOT NULL/);
  assert.match(migration, /personality text NOT NULL DEFAULT 'balanced'/);
  assert.match(migration, /runner_version text/);
  assert.match(migration, /llm_payload jsonb/);
  assert.match(migration, /completed_at timestamptz/);
  assert.doesNotMatch(migration, /personality_preset/);
  assert.doesNotMatch(migration, /source_audio_path/);
  assert.doesNotMatch(migration, /compact_payload/);
  assert.doesNotMatch(migration, /analysis_storage_path/);
});

test("show timeline exposes stored analysis instead of cue generation", () => {
  const page = readFileSync(join(root, "app/(app)/shows/[id]/page.tsx"), "utf8");
  const panelPath = join(root, "app/components/app/ShowGenerationPanel.tsx");
  assert.equal(existsSync(panelPath), true);

  assert.match(page, /Stored song analysis/);
  assert.match(page, /AI anchors/);
  assert.match(page, /latestAnalysis\?\.llmPayload/);
  assert.doesNotMatch(page, /ShowGenerationPanel/);
});
