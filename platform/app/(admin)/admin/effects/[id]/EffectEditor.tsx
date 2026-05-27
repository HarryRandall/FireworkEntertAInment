'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { refineEffectDraft, updateEffect } from '@/app/actions/admin-effects';
import { EffectPreviewIcon } from '@/app/components/admin/EffectPreviewIcon';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldError, FieldHint, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { toast } from '@/app/components/ui/toast';
import { safeParseFireworkSpec } from '@/lib/fireworks/spec';
import { DEFAULT_DESIGN, FIREWORK_PATTERNS } from '@/lib/fireworks/design';
import type { AdminEffectDetail } from '@/lib/admin.types';
import type { ReplayCue } from '@/lib/show-domain';
import { formatDuration } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };
type JsonPath = readonly (string | number)[];

const AUTOSAVE_DELAY_MS = 850;
const PREVIEW_TIME_SECONDS = 2.4;
const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PATTERN_OPTIONS = FIREWORK_PATTERNS.map((value) => ({ value, label: value }));
const BOOM_OPTIONS = ['auto', 'light', 'heavy'].map((value) => ({ value, label: value }));
const FLAIR_COLOUR_OPTIONS = ['bombColor', 'random', 'mixed'].map((value) => ({
  value,
  label: value,
}));
const CRACKLE_SOUND_OPTIONS = ['crackle', 'lightBoom', 'heavyBoom'].map((value) => ({
  value,
  label: value,
}));

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  {
    ssr: false,
    loading: () => <Skeleton className="absolute inset-0 h-full w-full rounded-none" />,
  },
);

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not parse JSON.',
    };
  }
}

function payloadSignature(payload: {
  name: string;
  description: string;
  type: string;
  durationSeconds: string;
  heightMeters: string;
  shotCount: string;
  specJson: string;
}) {
  return JSON.stringify(payload);
}

function replayCueForEffect(
  effect: AdminEffectDetail,
  specJson: Record<string, unknown>,
  metadata: {
    name: string;
    description: string;
    durationSeconds: number | null;
    heightMeters: number | null;
    shotCount: number | null;
  },
): ReplayCue {
  return {
    id: `${effect.id}-preview`,
    position: 1,
    timeSeconds: PREVIEW_CUE_TIME_SECONDS,
    description: metadata.description || metadata.name,
    productId: effect.id,
    launchPositionIndex: 1,
    firework: {
      id: effect.id,
      slug: effect.slug,
      name: metadata.name,
      description: metadata.description || null,
      sortOrder: 1,
      durationSeconds: metadata.durationSeconds,
      heightMeters: metadata.heightMeters,
      caliber: null,
      shotCount: metadata.shotCount,
      spec: safeParseFireworkSpec(specJson),
      rawSpec: specJson,
    },
  };
}

function parsePositiveNumber(value: string): number | null {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : null;
}

function parseNonNegativeNumber(value: string): number | null {
  if (value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : null;
}

function parsePositiveInteger(value: string): number | null {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : null;
}

function readPath(source: Record<string, unknown>, path: JsonPath): unknown {
  let cursor: unknown = source;
  for (const part of path) {
    if (typeof part === 'number') {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[part];
      continue;
    }
    if (typeof cursor !== 'object' || cursor === null || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function cloneWithPath(source: Record<string, unknown>, path: JsonPath, value: unknown) {
  const next = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
  let cursor: Record<string, unknown> | unknown[] = next;
  for (let index = 0; index < path.length - 1; index += 1) {
    const part = path[index]!;
    const nextPart = path[index + 1]!;
    const child = cursor[part as keyof typeof cursor];
    const childMatches =
      typeof nextPart === 'number'
        ? Array.isArray(child)
        : typeof child === 'object' && child !== null && !Array.isArray(child);
    if (!childMatches) {
      cursor[part as keyof typeof cursor] = (typeof nextPart === 'number' ? [] : {}) as never;
    }
    cursor = cursor[part as keyof typeof cursor] as Record<string, unknown> | unknown[];
  }
  cursor[path[path.length - 1]! as keyof typeof cursor] = value as never;
  return next;
}

function numericSpecValue(
  source: Record<string, unknown> | null,
  path: JsonPath,
  fallback: number,
): number {
  if (!source) return fallback;
  const value = readPath(source, path);
  const next = typeof value === 'number' || typeof value === 'string' ? Number(value) : fallback;
  return Number.isFinite(next) ? next : fallback;
}

function stringSpecValue(
  source: Record<string, unknown> | null,
  path: JsonPath,
  fallback: string,
): string {
  if (!source) return fallback;
  const value = readPath(source, path);
  return typeof value === 'string' ? value : fallback;
}

function booleanSpecValue(
  source: Record<string, unknown> | null,
  path: JsonPath,
  fallback: boolean,
): boolean {
  if (!source) return fallback;
  const value = readPath(source, path);
  return typeof value === 'boolean' ? value : fallback;
}

function colourChannelValue(
  source: Record<string, unknown> | null,
  channel: 'r' | 'g' | 'b',
  fallback: number,
): number {
  if (!source) return fallback;
  const color = readPath(source, ['color']);
  if (typeof color !== 'object' || color === null || Array.isArray(color)) return fallback;
  const value = (color as Record<string, unknown>)[channel];
  const next = typeof value === 'number' || typeof value === 'string' ? Number(value) : fallback;
  return Number.isFinite(next) ? next : fallback;
}

function colourObjectWithChannel(
  source: Record<string, unknown> | null,
  channel: 'r' | 'g' | 'b',
  value: number,
) {
  return {
    r: colourChannelValue(source, 'r', 0.18),
    g: colourChannelValue(source, 'g', 0.5),
    b: colourChannelValue(source, 'b', 1),
    [channel]: value,
  };
}

export function EffectEditor({ effect }: { effect: AdminEffectDetail }) {
  const [name, setName] = useState(effect.name);
  const [description, setDescription] = useState(effect.description ?? '');
  const [type, setType] = useState(effect.type);
  const [durationSeconds, setDurationSeconds] = useState(String(effect.durationSeconds));
  const [heightMeters, setHeightMeters] = useState(
    effect.heightMeters == null ? '' : String(effect.heightMeters),
  );
  const [shotCount, setShotCount] = useState(String(effect.shotCount));
  const [specText, setSpecText] = useState(JSON.stringify(effect.specJson, null, 2));
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState(effect.updatedAt);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastValidSpec, setLastValidSpec] = useState<Record<string, unknown>>(
    effect.specJson as Record<string, unknown>,
  );
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiDraft, setAiDraft] = useState<Awaited<ReturnType<typeof refineEffectDraft>> | null>(
    null,
  );
  const [isAiPending, startAiTransition] = useTransition();
  const saveSequence = useRef(0);

  const parsedSpec = useMemo(() => parseJsonObject(specText), [specText]);
  const previewSpec = parsedSpec.ok ? parsedSpec.value : lastValidSpec;
  const activeSpec = parsedSpec.ok ? parsedSpec.value : null;
  const cue = useMemo(
    () =>
      replayCueForEffect(effect, previewSpec, {
        name,
        description,
        durationSeconds: parsePositiveNumber(durationSeconds) ?? effect.durationSeconds,
        heightMeters: parseNonNegativeNumber(heightMeters),
        shotCount: parsePositiveInteger(shotCount) ?? effect.shotCount,
      }),
    [description, durationSeconds, effect, heightMeters, name, previewSpec, shotCount],
  );

  const currentPayload = useMemo(
    () => ({
      name,
      description,
      type,
      durationSeconds,
      heightMeters,
      shotCount,
      specJson: specText,
    }),
    [description, durationSeconds, heightMeters, name, shotCount, specText, type],
  );

  const lastSavedSignature = useRef(payloadSignature(currentPayload));

  useEffect(() => {
    if (parsedSpec.ok) setLastValidSpec(parsedSpec.value);
  }, [parsedSpec]);

  useEffect(() => {
    const signature = payloadSignature(currentPayload);
    if (signature === lastSavedSignature.current) {
      setSaveState('saved');
      setSaveError(null);
      return;
    }

    if (!parsedSpec.ok) {
      setSaveState('error');
      setSaveError(parsedSpec.error);
      return;
    }

    const duration = Number(durationSeconds);
    const height = heightMeters === '' ? null : Number(heightMeters);
    const shots = Number(shotCount);
    if (!Number.isFinite(duration) || duration <= 0) {
      setSaveState('error');
      setSaveError('Duration must be greater than 0.');
      return;
    }
    if (heightMeters !== '' && (height == null || !Number.isFinite(height) || height < 0)) {
      setSaveState('error');
      setSaveError('Height must be blank or 0 or greater.');
      return;
    }
    if (!Number.isInteger(shots) || shots < 1) {
      setSaveState('error');
      setSaveError('Shot count must be a whole number greater than 0.');
      return;
    }

    setSaveState('dirty');
    setSaveError(null);
    const sequence = ++saveSequence.current;
    const timeout = window.setTimeout(async () => {
      setSaveState('saving');
      const result = await updateEffect({
        id: effect.id,
        expectedUpdatedAt: lastSavedUpdatedAt,
        name,
        description: description || null,
        type,
        durationSeconds: duration,
        heightMeters: height,
        shotCount: shots,
        specJson: specText,
      });
      if (sequence !== saveSequence.current) return;
      if (result.ok) {
        lastSavedSignature.current = signature;
        setLastSavedUpdatedAt(result.updatedAt);
        setSaveState('saved');
        setSaveError(null);
      } else {
        setSaveState('error');
        setSaveError(result.error);
        toast.error(result.error);
      }
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    currentPayload,
    description,
    durationSeconds,
    effect.id,
    heightMeters,
    lastSavedUpdatedAt,
    name,
    parsedSpec,
    shotCount,
    specText,
    type,
  ]);

  function requestAiDraft() {
    if (!parsedSpec.ok) {
      toast.error('Fix the JSON before asking AI to edit it.');
      return;
    }
    startAiTransition(async () => {
      const result = await refineEffectDraft({
        id: effect.id,
        name,
        description: description || null,
        type,
        durationSeconds: Number(durationSeconds),
        heightMeters: heightMeters === '' ? null : Number(heightMeters),
        shotCount: Number(shotCount),
        specJson: specText,
        prompt: aiPrompt,
      });
      setAiDraft(result);
      if (!result.ok) toast.error(result.error);
    });
  }

  function applyAiDraft() {
    if (!aiDraft?.ok) return;
    setName(aiDraft.draft.name);
    setDescription(aiDraft.draft.description ?? '');
    setType(aiDraft.draft.type);
    setDurationSeconds(String(aiDraft.draft.durationSeconds));
    setHeightMeters(aiDraft.draft.heightMeters == null ? '' : String(aiDraft.draft.heightMeters));
    setShotCount(String(aiDraft.draft.shotCount));
    setSpecText(JSON.stringify(aiDraft.draft.specJson, null, 2));
    setAiDraft(null);
    setAiPrompt('');
  }

  function updateSpec(path: JsonPath, value: unknown) {
    if (!parsedSpec.ok) return;
    setSpecText(JSON.stringify(cloneWithPath(parsedSpec.value, path, value), null, 2));
  }

  return (
    <div className="grid min-h-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.18fr)]">
      <div className="space-y-5 xl:sticky xl:top-4 xl:self-start">
        <Card radius="lg" className="overflow-hidden">
          <SingleEffectPreview cue={cue} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border-subtle)] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <EffectPreviewIcon preview={effect.preview} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                  {name}
                </div>
                <div className="font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums">
                  {formatDuration(Number(durationSeconds))}
                </div>
              </div>
            </div>
            <SaveBadge state={saveState} />
          </div>
        </Card>

        <Card radius="lg" className="space-y-5 p-5">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
              Effect metadata
            </h2>
            <p className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
              These fields control how admins find this effect and how product shots describe it.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="effect-name">Name</FieldLabel>
              <Input
                id="effect-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="effect-type">Type</FieldLabel>
              <Input
                id="effect-type"
                value={type}
                onChange={(event) => setType(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="effect-duration">Duration seconds</FieldLabel>
              <Input
                id="effect-duration"
                type="number"
                min={0.1}
                step={0.1}
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="effect-height">Height metres</FieldLabel>
              <Input
                id="effect-height"
                type="number"
                min={0}
                step={0.1}
                value={heightMeters}
                onChange={(event) => setHeightMeters(event.target.value)}
                placeholder="Blank"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="effect-shot-count">Shot count</FieldLabel>
              <Input
                id="effect-shot-count"
                type="number"
                min={1}
                step={1}
                value={shotCount}
                onChange={(event) => setShotCount(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Source</FieldLabel>
              <div className="flex h-10 items-center rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-muted)] px-3 text-sm text-[color:var(--color-content-subtle)]">
                {effect.source}
              </div>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="effect-description">Description</FieldLabel>
            <Textarea
              id="effect-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </Card>
      </div>

      <div className="space-y-5">
        <Card radius="lg" className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[color:var(--color-accent)]" />
                <h2 className="text-lg font-semibold text-[color:var(--color-content-emphasis)]">
                  Effect JSON tuning
                </h2>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-[color:var(--color-content-subtle)]">
                Pause the preview, move a control, and the current frame rebuilds from the latest
                valid JSON before the autosave runs.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={parsedSpec.ok ? 'success' : 'danger'} solid>
                {parsedSpec.ok ? 'Valid JSON' : 'Invalid JSON'}
              </Badge>
              <SaveBadge state={saveState} />
            </div>
          </div>

          {parsedSpec.ok ? (
            <SpecTuningPanel spec={activeSpec} onUpdate={updateSpec} />
          ) : (
            <InlineAlert tone="danger" title="Fix JSON before using controls">
              The preview keeps showing the last valid effect until the JSON parses again.
            </InlineAlert>
          )}

          <Field>
            <FieldLabel htmlFor="effect-json">Effect JSON</FieldLabel>
            <Textarea
              id="effect-json"
              rows={24}
              value={specText}
              onChange={(event) => setSpecText(event.target.value)}
              className="min-h-[520px] font-mono text-xs leading-relaxed"
              invalid={!parsedSpec.ok}
              spellCheck={false}
            />
            <FieldHint>
              {parsedSpec.ok
                ? 'Preview is using this JSON.'
                : 'Preview is using the last valid JSON.'}
            </FieldHint>
            <FieldError>{!parsedSpec.ok ? parsedSpec.error : saveError}</FieldError>
          </Field>
        </Card>

        <Card radius="lg" className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-[color:var(--color-accent)]" />
            <h2 className="text-base font-semibold text-[color:var(--color-content-emphasis)]">
              AI draft
            </h2>
          </div>
          <Field>
            <FieldLabel htmlFor="effect-ai-prompt">Prompt</FieldLabel>
            <Textarea
              id="effect-ai-prompt"
              rows={4}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Make this burst wider with more blue in the outer stars."
            />
          </Field>
          <Button
            onClick={requestAiDraft}
            loading={isAiPending}
            disabled={aiPrompt.trim().length < 3}
          >
            <WandSparkles size={16} />
            Generate draft
          </Button>

          {aiDraft?.ok ? (
            <div className="rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
                    {aiDraft.draft.name}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
                    Model: {aiDraft.model}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={applyAiDraft}>
                  Apply to editor
                </Button>
              </div>
              <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[color:var(--color-bg-default)] p-3 font-mono text-xs text-[color:var(--color-content-default)]">
                {JSON.stringify(aiDraft.draft.specJson, null, 2)}
              </pre>
            </div>
          ) : aiDraft && !aiDraft.ok ? (
            <InlineAlert tone="danger" title="Draft failed">
              {aiDraft.error}
            </InlineAlert>
          ) : null}
        </Card>

        <LinkedProductsTable effect={effect} />
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: 'saved' | 'dirty' | 'saving' | 'error' }) {
  if (state === 'saving') {
    return (
      <Badge tone="info" solid icon={Clock3}>
        Saving
      </Badge>
    );
  }
  if (state === 'dirty') {
    return (
      <Badge tone="warning" solid icon={Clock3}>
        Unsaved
      </Badge>
    );
  }
  if (state === 'error') {
    return (
      <Badge tone="danger" solid icon={XCircle}>
        Not saved
      </Badge>
    );
  }
  return (
    <Badge tone="success" solid icon={CheckCircle2}>
      Saved
    </Badge>
  );
}

function SpecTuningPanel({
  spec,
  onUpdate,
}: {
  spec: Record<string, unknown> | null;
  onUpdate: (path: JsonPath, value: unknown) => void;
}) {
  const updateColour = (channel: 'r' | 'g' | 'b', value: number) => {
    onUpdate(['color'], colourObjectWithChannel(spec, channel, value));
  };

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-4">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            Burst geometry
          </h3>
          <p className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
            These values update the renderer fields that decide the sphere pattern and particle
            count.
          </p>
        </div>
        <Field>
          <FieldLabel>Pattern</FieldLabel>
          <SelectField
            value={stringSpecValue(spec, ['pattern'], DEFAULT_DESIGN.pattern)}
            onChange={(value) => onUpdate(['pattern'], value)}
            options={PATTERN_OPTIONS}
            ariaLabel="Pattern"
          />
          <FieldHint>Changes how stars are distributed when the shell opens.</FieldHint>
        </Field>
        <SpecSlider
          label="Particle count"
          value={numericSpecValue(spec, ['size'], DEFAULT_DESIGN.size)}
          min={20}
          max={370}
          step={1}
          hint="Higher values add more stars to the burst and make it feel fuller."
          onChange={(value) => onUpdate(['size'], Math.round(value))}
        />
        <SpecSlider
          label="Burst speed min"
          value={numericSpecValue(spec, ['burst', 'speed', 0], DEFAULT_DESIGN.burst.speed[0])}
          min={0.2}
          max={8}
          step={0.05}
          hint="Raises the slowest star speed, tightening or expanding the inner edge."
          onChange={(value) => onUpdate(['burst', 'speed', 0], value)}
        />
        <SpecSlider
          label="Burst speed max"
          value={numericSpecValue(spec, ['burst', 'speed', 1], DEFAULT_DESIGN.burst.speed[1])}
          min={0.2}
          max={8}
          step={0.05}
          hint="Raises the fastest star speed, making the outer sphere wider."
          onChange={(value) => onUpdate(['burst', 'speed', 1], value)}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-4">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            Timing, lift, and drift
          </h3>
          <p className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
            These values change ascent height, shell lifetime, star fade, and falling behaviour.
          </p>
        </div>
        <SpecSlider
          label="Lift velocity"
          value={numericSpecValue(spec, ['liftVelocity'], DEFAULT_DESIGN.liftVelocity ?? 14)}
          min={4}
          max={40}
          step={0.25}
          hint="Higher values make the shell climb higher before it opens."
          onChange={(value) => onUpdate(['liftVelocity'], value)}
        />
        <SpecSlider
          label="Shell life"
          value={numericSpecValue(spec, ['shellLife'], DEFAULT_DESIGN.shellLife)}
          min={2}
          max={60}
          step={0.25}
          unit="s"
          hint="How long the rising shell can live before the engine forces cleanup."
          onChange={(value) => onUpdate(['shellLife'], value)}
        />
        <SpecSlider
          label="Star life min"
          value={numericSpecValue(spec, ['burst', 'life', 0], DEFAULT_DESIGN.burst.life[0])}
          min={0.1}
          max={8}
          step={0.05}
          unit="s"
          hint="The shortest lifetime for burst stars."
          onChange={(value) => onUpdate(['burst', 'life', 0], value)}
        />
        <SpecSlider
          label="Star life max"
          value={numericSpecValue(spec, ['burst', 'life', 1], DEFAULT_DESIGN.burst.life[1])}
          min={0.1}
          max={8}
          step={0.05}
          unit="s"
          hint="The longest lifetime for lingering stars."
          onChange={(value) => onUpdate(['burst', 'life', 1], value)}
        />
        <SpecSlider
          label="Gravity min"
          value={numericSpecValue(spec, ['burst', 'gravity', 0], DEFAULT_DESIGN.burst.gravity[0])}
          min={-2}
          max={1}
          step={0.05}
          hint="Lower values make some stars hang or rise before falling."
          onChange={(value) => onUpdate(['burst', 'gravity', 0], value)}
        />
        <SpecSlider
          label="Gravity max"
          value={numericSpecValue(spec, ['burst', 'gravity', 1], DEFAULT_DESIGN.burst.gravity[1])}
          min={-2}
          max={1}
          step={0.05}
          hint="Higher values make some stars drop faster."
          onChange={(value) => onUpdate(['burst', 'gravity', 1], value)}
        />
      </div>

      <div className="space-y-4 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-muted)] p-4 2xl:col-span-2">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
            Colour and texture
          </h3>
          <p className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
            These values update the RGB colour object, flair, crackle, and launch smoke fields.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SpecSlider
            label="Red"
            value={colourChannelValue(spec, 'r', 0.18)}
            min={0}
            max={1}
            step={0.01}
            hint="Raises or lowers the red channel in the burst colour."
            onChange={(value) => updateColour('r', value)}
          />
          <SpecSlider
            label="Green"
            value={colourChannelValue(spec, 'g', 0.5)}
            min={0}
            max={1}
            step={0.01}
            hint="Raises or lowers the green channel in the burst colour."
            onChange={(value) => updateColour('g', value)}
          />
          <SpecSlider
            label="Blue"
            value={colourChannelValue(spec, 'b', 1)}
            min={0}
            max={1}
            step={0.01}
            hint="Raises or lowers the blue channel in the burst colour."
            onChange={(value) => updateColour('b', value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field>
            <FieldLabel>Flair colour mode</FieldLabel>
            <SelectField
              value={stringSpecValue(spec, ['burst', 'flairColorMode'], 'mixed')}
              onChange={(value) => onUpdate(['burst', 'flairColorMode'], value)}
              options={FLAIR_COLOUR_OPTIONS}
              ariaLabel="Flair colour mode"
            />
            <FieldHint>Controls whether flair sparks match, randomise, or mix colours.</FieldHint>
          </Field>
          <SpecToggle
            label="Flair enabled"
            checked={booleanSpecValue(spec, ['flair', 'enabled'], DEFAULT_DESIGN.flair.enabled)}
            hint="Turns the secondary glitter-like star trails on or off."
            onChange={(value) => onUpdate(['flair', 'enabled'], value)}
          />
          <SpecToggle
            label="Crackle enabled"
            checked={booleanSpecValue(spec, ['crackle', 'enabled'], DEFAULT_DESIGN.crackle.enabled)}
            hint="Enables delayed crackle pops on larger bursts."
            onChange={(value) => onUpdate(['crackle', 'enabled'], value)}
          />
          <SpecToggle
            label="Mortar sound"
            checked={booleanSpecValue(spec, ['mortar', 'sound'], DEFAULT_DESIGN.mortar.sound)}
            hint="Controls the launch sound for this effect preview."
            onChange={(value) => onUpdate(['mortar', 'sound'], value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SpecSlider
            label="Mortar smoke"
            value={numericSpecValue(
              spec,
              ['mortar', 'smokeParticles'],
              DEFAULT_DESIGN.mortar.smokeParticles,
            )}
            min={0}
            max={500}
            step={1}
            hint="Adds or removes launch smoke particles."
            onChange={(value) => onUpdate(['mortar', 'smokeParticles'], Math.round(value))}
          />
          <SpecSlider
            label="Crackle probability"
            value={numericSpecValue(
              spec,
              ['crackle', 'probability'],
              DEFAULT_DESIGN.crackle.probability,
            )}
            min={0}
            max={1}
            step={0.01}
            hint="Controls how often eligible stars split into crackle."
            onChange={(value) => onUpdate(['crackle', 'probability'], value)}
          />
          <Field>
            <FieldLabel>Boom sound</FieldLabel>
            <SelectField
              value={stringSpecValue(spec, ['sound', 'boom'], DEFAULT_DESIGN.sound.boom)}
              onChange={(value) => onUpdate(['sound', 'boom'], value)}
              options={BOOM_OPTIONS}
              ariaLabel="Boom sound"
            />
            <FieldHint>Changes the burst sound profile when audio is enabled.</FieldHint>
          </Field>
          <Field>
            <FieldLabel>Crackle sound</FieldLabel>
            <SelectField
              value={stringSpecValue(spec, ['crackle', 'sound'], DEFAULT_DESIGN.crackle.sound)}
              onChange={(value) => onUpdate(['crackle', 'sound'], value)}
              options={CRACKLE_SOUND_OPTIONS}
              ariaLabel="Crackle sound"
            />
            <FieldHint>Changes the sound used by crackle particles.</FieldHint>
          </Field>
        </div>
      </div>
    </div>
  );
}

function SpecSlider({
  label,
  value,
  min,
  max,
  step,
  hint,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  hint: string;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-tertiary h-2 w-full"
        aria-label={label}
      />
      <FieldHint>{hint}</FieldHint>
    </Field>
  );
}

function SpecToggle({
  label,
  checked,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  hint: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field>
      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] px-3 py-2 text-sm text-[color:var(--color-content-emphasis)]">
        <span className="font-medium">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="accent-tertiary h-4 w-4"
        />
      </label>
      <FieldHint>{hint}</FieldHint>
    </Field>
  );
}

function LinkedProductsTable({ effect }: { effect: AdminEffectDetail }) {
  return (
    <Card radius="lg" className="p-5">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--color-content-emphasis)]">
          Linked products ({effect.linkedProducts.length})
        </summary>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[color:var(--color-border-subtle)]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-[color:var(--color-bg-muted)] text-left text-xs font-semibold tracking-wide text-[color:var(--color-content-subtle)] uppercase">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Part number</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Shots</th>
                <th className="px-4 py-3">Calibre</th>
              </tr>
            </thead>
            <tbody>
              {effect.linkedProducts.length > 0 ? (
                effect.linkedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t border-[color:var(--color-border-subtle)]"
                  >
                    <td className="px-4 py-3 font-medium text-[color:var(--color-content-emphasis)]">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums">
                      {product.partNumber}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-content-subtle)]">
                      {product.fireworkType ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[color:var(--color-content-subtle)] tabular-nums">
                      {product.shots.length}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-content-subtle)]">
                      {Array.from(new Set(product.shots.map((shot) => shot.caliber ?? '—'))).join(
                        ', ',
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-[color:var(--color-content-subtle)]"
                  >
                    No products currently use this effect.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}

function SingleEffectPreview({ cue }: { cue: ReplayCue }) {
  const [elapsed, setElapsed] = useState(PREVIEW_TIME_SECONDS);
  const [playing, setPlaying] = useState(false);
  const [hasScrubbed, setHasScrubbed] = useState(false);
  const startedAt = useRef<number | null>(null);
  const playheadStart = useRef(PREVIEW_TIME_SECONDS);
  const elapsedRef = useRef(PREVIEW_TIME_SECONDS);
  const lastUIElapsedRef = useRef(PREVIEW_TIME_SECONDS);
  const duration = Math.max(cue.firework.durationSeconds ?? 5, 5);
  const cueIdentity = cue.firework.id;

  useEffect(() => {
    const posterTime = Math.min(PREVIEW_TIME_SECONDS, duration);
    elapsedRef.current = posterTime;
    playheadStart.current = posterTime;
    lastUIElapsedRef.current = posterTime;
    startedAt.current = null;
    setElapsed(posterTime);
    setPlaying(false);
    setHasScrubbed(false);
    // Reset only when switching effects. JSON edits should rebuild the current paused frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cueIdentity]);

  useEffect(() => {
    if (elapsedRef.current <= duration) return;
    seekTo(duration, false);
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  useEffect(() => {
    if (!playing) {
      elapsedRef.current = elapsed;
      lastUIElapsedRef.current = elapsed;
    }
  }, [elapsed, playing]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    startedAt.current = performance.now();
    playheadStart.current = elapsedRef.current;
    lastUIElapsedRef.current = elapsedRef.current;

    function tick(now: number) {
      if (startedAt.current == null) return;
      const next = Math.min(duration, playheadStart.current + (now - startedAt.current) / 1000);
      elapsedRef.current = next;
      if (next >= duration || next - lastUIElapsedRef.current >= 0.067) {
        lastUIElapsedRef.current = next;
        setElapsed(next);
      }
      if (next >= duration) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, playing]);

  function seekTo(timeSeconds: number, continuePlaying = playing) {
    const next = Math.max(0, Math.min(duration, timeSeconds));
    elapsedRef.current = next;
    playheadStart.current = next;
    lastUIElapsedRef.current = next;
    startedAt.current = continuePlaying ? performance.now() : null;
    setElapsed(next);
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      seekTo(elapsedRef.current, false);
      return;
    }
    if (!hasScrubbed || elapsedRef.current >= duration) seekTo(0, false);
    setPlaying(true);
  }

  function restart() {
    setPlaying(false);
    seekTo(0, false);
    setHasScrubbed(false);
  }

  return (
    <div className="relative h-[min(56vh,520px)] min-h-[360px] overflow-hidden bg-[#05070d]">
      <LazyFireworkReplayCanvas
        cues={[cue]}
        elapsed={elapsed}
        playbackRef={elapsedRef}
        muted={!playing}
        interactive
        controlsVisible
      />
      <div className="absolute inset-x-4 bottom-4 z-20 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-default)]/90 px-4 py-3 shadow-[var(--shadow-modal)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playing ? 'Pause effect preview' : 'Play effect preview'}
              className="focus-glow-action bg-primary-container text-on-primary-container flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-cta)] transition-all hover:brightness-110 focus:outline-none focus-visible:outline-none active:scale-[0.98]"
            >
              {playing ? (
                <Pause size={17} strokeWidth={2.5} />
              ) : (
                <Play size={17} strokeWidth={2.5} />
              )}
            </button>
            <button
              type="button"
              onClick={restart}
              aria-label="Restart effect preview"
              className="focus-glow-action border-outline/20 text-primary hover:bg-surface-container-highest/50 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all focus:outline-none focus-visible:outline-none active:scale-[0.98]"
            >
              <RotateCcw size={15} strokeWidth={2} />
            </button>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="text-tertiary/80 min-w-[2.75rem] font-mono text-[11px] tabular-nums">
              {formatDuration(elapsed)}
            </span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={Math.min(elapsed, duration)}
              onChange={(event) => {
                setPlaying(false);
                setHasScrubbed(true);
                seekTo(Number(event.target.value), false);
              }}
              className="accent-tertiary h-2 min-w-0 flex-1"
              aria-label="Effect preview timeline"
            />
            <span className="text-tertiary/80 min-w-[2.75rem] text-right font-mono text-[11px] tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
