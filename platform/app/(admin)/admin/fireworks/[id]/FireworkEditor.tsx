'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Pause, Play, Plus, Repeat, RotateCcw, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { updateFirework } from '@/app/actions/admin-fireworks';
import { ColorField } from '@/app/components/admin/ColorField';
import {
  FireworkRenderControls,
  type JsonRecord,
} from '@/app/components/admin/FireworkRenderControls';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Field, FieldLabel } from '@/app/components/ui/Field';
import { InlineAlert, Skeleton } from '@/app/components/ui/Feedback';
import { Input, Textarea } from '@/app/components/ui/Input';
import { SelectField } from '@/app/components/ui/SelectField';
import { SliderField } from '@/app/components/ui/SliderField';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/app/components/ui/toast';
import type { AdminFireworkDetail } from '@/lib/admin.types';
import type { Json } from '@/lib/database.types';
import {
  canonicaliseEffectModelJson,
  compileFireworkDesign,
  estimateDesignDurationSeconds,
  type LaunchPosition,
} from '@/lib/fireworks/design';
import { DEFAULT_FIREWORK_SPEC, hexToRgb } from '@/lib/fireworks/spec';
import type { ReplayCue } from '@/lib/show-domain';

type ParsedJson = { ok: true; value: JsonRecord } | { ok: false; error: string };

type ColorRole = 'main' | 'mix' | 'core';
type ColorSlot = { id: string; hex: string; role: ColorRole };

const LazyFireworkReplayCanvas = dynamic(
  () => import('@/app/components/app/FireworkReplayCanvas').then((mod) => mod.FireworkReplayCanvas),
  { ssr: false, loading: () => <ReplayCanvasSkeleton /> },
);

const PREVIEW_CUE_TIME_SECONDS = 0.05;
const PREVIEW_START_SECONDS = 0;
const PREVIEW_LAUNCH_POSITIONS: LaunchPosition[] = [{ x: 0, y: 0, z: 0 }];
const DEFAULT_ACCENT_RATIO = 0.22;
const HEX = /^#[0-9a-fA-F]{6}$/;

const ROLE_LABEL: Record<ColorRole, string> = {
  main: 'Whole burst',
  mix: 'Accent (random mix)',
  core: 'Centre / core',
};

const ROLE_HINT: Record<ColorRole, string> = {
  main: 'The main colour every star starts as.',
  mix: 'A share of the stars fire in this colour instead, scattered randomly through the burst.',
  core: 'Colours the inner core of the shell, for a two-tone "flower with a heart" look.',
};

function parseJsonObject(text: string): ParsedJson {
  try {
    const value = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ok: false, error: 'JSON must be an object.' };
    }
    return { ok: true, value: value as JsonRecord };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse JSON.' };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneRecord(value: JsonRecord): JsonRecord {
  return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function readRecord(parent: JsonRecord, key: string): JsonRecord {
  return isRecord(parent[key]) ? (parent[key] as JsonRecord) : {};
}

function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const [r, g, b] = hexToRgb(hex);
  return { r, g, b };
}

function rgbObjectToHex(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const r = Number(value.r);
  const g = Number(value.g);
  const b = Number(value.b);
  if (![r, g, b].every(Number.isFinite)) return null;
  const toByte = (channel: number) => Math.max(0, Math.min(255, Math.round(channel * 255)));
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

function ReplayCanvasSkeleton() {
  return <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-[#0b1020]" />;
}

function buildInitialColorSlots(firework: AdminFireworkDetail, overrides: JsonRecord): ColorSlot[] {
  const slots: ColorSlot[] = [
    { id: 'initial-main', hex: firework.primaryColor ?? '#ff0043', role: 'main' },
  ];
  const accent =
    firework.secondaryColor ??
    firework.colorPalette.find(
      (hex) => hex.toLowerCase() !== (firework.primaryColor ?? '').toLowerCase(),
    ) ??
    null;
  if (accent) slots.push({ id: 'initial-mix', hex: accent, role: 'mix' });

  const pistil = isRecord(overrides.pistil) ? overrides.pistil : null;
  const coreHex = pistil ? rgbObjectToHex(pistil.color) : null;
  if (coreHex) slots.push({ id: 'initial-core', hex: coreHex, role: 'core' });

  return slots;
}

export function FireworkEditor({ firework }: { firework: AdminFireworkDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [elapsed, setElapsed] = useState(PREVIEW_START_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const playbackRef = useRef(PREVIEW_START_SECONDS);
  const startedAtRef = useRef(0);

  const initialOverrides = useMemo<JsonRecord>(
    () => (isRecord(firework.renderOverridesJson) ? firework.renderOverridesJson : {}),
    [firework.renderOverridesJson],
  );

  const [name, setName] = useState(firework.name);
  const [description, setDescription] = useState(firework.description ?? '');
  const [effectId, setEffectId] = useState(
    firework.effectId ?? firework.effectOptions[0]?.id ?? '',
  );
  const [caliber, setCaliber] = useState(firework.caliber ?? '');
  const [durationSeconds, setDurationSeconds] = useState(
    firework.durationSeconds == null ? '' : String(firework.durationSeconds),
  );
  const [heightMeters, setHeightMeters] = useState(
    firework.heightMeters == null ? '' : String(firework.heightMeters),
  );
  const initialColorSlots = useMemo(
    () => buildInitialColorSlots(firework, initialOverrides),
    [firework, initialOverrides],
  );
  const [colorSlots, setColorSlots] = useState<ColorSlot[]>(initialColorSlots);
  const nextColorSlotIdRef = useRef(initialColorSlots.length);
  const [accentAmount, setAccentAmount] = useState<number>(() => {
    const raw = Number(initialOverrides.secondaryColorRatio);
    return Number.isFinite(raw) ? Math.min(0.6, Math.max(0.05, raw)) : DEFAULT_ACCENT_RATIO;
  });
  const [overridesText, setOverridesText] = useState(
    JSON.stringify(firework.renderOverridesJson ?? {}, null, 2),
  );

  const parsedOverrides = useMemo(() => parseJsonObject(overridesText), [overridesText]);
  const overridesRecord = useMemo<JsonRecord>(
    () => (parsedOverrides.ok ? parsedOverrides.value : {}),
    [parsedOverrides],
  );

  const mainColor = colorSlots.find((slot) => slot.role === 'main')?.hex ?? null;
  const accentColor = colorSlots.find((slot) => slot.role === 'mix')?.hex ?? null;
  const coreColor = colorSlots.find((slot) => slot.role === 'core')?.hex ?? null;
  const usedRoles = new Set(colorSlots.map((slot) => slot.role));

  const baseModel = useMemo(
    () => (firework.effectModels[effectId] ?? firework.effectModelJson) as Json,
    [effectId, firework.effectModels, firework.effectModelJson],
  );
  const calibrationDefaults = useMemo(() => {
    const model = isRecord(baseModel) ? baseModel : {};
    return readRecord(canonicaliseEffectModelJson(model), 'renderDefaults');
  }, [baseModel]);

  const palette = useMemo(
    () =>
      Array.from(
        new Set(
          [mainColor, accentColor]
            .filter((hex): hex is string => Boolean(hex))
            .map((hex) => hex.toLowerCase()),
        ),
      ),
    [mainColor, accentColor],
  );

  /** Overrides merged with the colour choices, used for both preview and save. */
  const mergedOverrides = useMemo<JsonRecord>(() => {
    const base = cloneRecord(overridesRecord);
    if (accentColor) base.secondaryColorRatio = Number(accentAmount.toFixed(3));
    else delete base.secondaryColorRatio;

    if (coreColor) {
      const pistil = isRecord(base.pistil) ? { ...base.pistil } : {};
      pistil.enabled = true;
      pistil.color = hexToRgbObject(coreColor);
      base.pistil = pistil;
    } else if (isRecord(base.pistil)) {
      const pistil = { ...base.pistil };
      delete pistil.color;
      base.pistil = pistil;
    }
    return base;
  }, [overridesRecord, accentColor, accentAmount, coreColor]);

  const previewDesign = useMemo(
    () =>
      compileFireworkDesign({
        baseModel,
        variantOverrides: mergedOverrides,
        primaryColor: mainColor,
        colorPalette: palette.length ? palette : null,
      }),
    [baseModel, mergedOverrides, mainColor, palette],
  );

  // Head-orb appearance is saved into the firework's render overrides, so the
  // sliders read from the compiled design and write straight back. A firework
  // inherits its effect's saved look and customises it from here.
  const heads = previewDesign.stars.heads;
  const glowPadding = heads.glowPadding;
  const whiteCoreSizePercent = heads.whiteCoreSizePercent;
  const whiteCoreBlurPercent = heads.whiteCoreBlurPercent;
  const coreSoftness = heads.coreSoftness;
  const coreBrightness = heads.coreBrightness;
  const coreOpacityFalloff = heads.coreOpacityFalloff;
  const glowSize = heads.glowSize;
  const glowSoftness = heads.glowSoftness;
  const glowOpacityFalloff = heads.glowOpacityFalloff;
  const glowBlur = heads.glowBlur;
  const backgroundGlowOpacityFalloff = heads.backgroundGlowOpacityFalloff;
  const backgroundGlowSoftness = heads.backgroundGlowSoftness;

  const previewDuration = useMemo(() => {
    const estimated = PREVIEW_CUE_TIME_SECONDS + estimateDesignDurationSeconds(previewDesign);
    return Math.max(4, Math.ceil(estimated * 2) / 2);
  }, [previewDesign]);

  const selectedEffect = firework.effectOptions.find((option) => option.id === effectId) ?? null;

  const previewCue = useMemo<ReplayCue>(
    () => ({
      id: `${firework.id}-preview`,
      position: 1,
      timeSeconds: PREVIEW_CUE_TIME_SECONDS,
      description: name,
      productId: firework.id,
      launchPositionIndex: 0,
      firework: {
        id: firework.id,
        slug: firework.slug,
        name,
        description: description || null,
        sortOrder: 0,
        durationSeconds: previewDuration,
        heightMeters: null,
        caliber: caliber || null,
        shotCount: 1,
        spec: DEFAULT_FIREWORK_SPEC,
        rawSpec: mergedOverrides,
        renderDesign: previewDesign,
        baseEffect: selectedEffect
          ? {
              id: selectedEffect.id,
              slug: selectedEffect.slug,
              name: selectedEffect.name,
              patternKey: selectedEffect.patternKey,
            }
          : null,
        variant: null,
      },
    }),
    [
      caliber,
      description,
      firework.id,
      firework.slug,
      name,
      mergedOverrides,
      previewDesign,
      previewDuration,
      selectedEffect,
    ],
  );

  useEffect(() => {
    if (!isPlaying) return;
    let frameId = 0;
    let lastUiUpdate = 0;
    startedAtRef.current = performance.now() - playbackRef.current * 1000;

    function tick(now: number) {
      const raw = (now - startedAtRef.current) / 1000;
      let next = raw;
      if (raw >= previewDuration) {
        if (!isLooping) {
          playbackRef.current = previewDuration;
          setElapsed(previewDuration);
          setIsPlaying(false);
          return;
        }
        next = raw % previewDuration;
        startedAtRef.current = now - next * 1000;
      }
      playbackRef.current = next;
      if (now - lastUiUpdate > 90) {
        setElapsed(next);
        lastUiUpdate = now;
      }
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, isLooping, previewDuration]);

  function setPreviewTime(seconds: number) {
    startedAtRef.current = performance.now() - seconds * 1000;
    playbackRef.current = seconds;
    setElapsed(seconds);
  }

  function mutateOverrides(updater: (defaults: JsonRecord) => void) {
    if (!parsedOverrides.ok) return;
    const draft = cloneRecord(parsedOverrides.value);
    updater(draft);
    setOverridesText(JSON.stringify(draft, null, 2));
  }

  function updateSlotHex(id: string, hex: string) {
    setColorSlots((slots) => slots.map((slot) => (slot.id === id ? { ...slot, hex } : slot)));
  }

  function updateSlotRole(id: string, role: ColorRole) {
    setColorSlots((slots) => slots.map((slot) => (slot.id === id ? { ...slot, role } : slot)));
  }

  function removeSlot(id: string) {
    setColorSlots((slots) => slots.filter((slot) => slot.id !== id));
  }

  function addColor() {
    const nextRole: ColorRole | null = !usedRoles.has('mix')
      ? 'mix'
      : !usedRoles.has('core')
        ? 'core'
        : null;
    if (!nextRole) return;
    const id = `added-${nextColorSlotIdRef.current}`;
    nextColorSlotIdRef.current += 1;
    setColorSlots((slots) => [...slots, { id, hex: '#1e7fff', role: nextRole }]);
  }

  function save() {
    setError(null);
    if (!parsedOverrides.ok) {
      setError(parsedOverrides.error);
      return;
    }
    if (!effectId) {
      setError('Choose a base effect.');
      return;
    }
    if (!mainColor) {
      setError('Pick a main colour.');
      return;
    }
    startTransition(async () => {
      const result = await updateFirework({
        id: firework.id,
        name,
        description,
        fireworkEffectId: effectId,
        caliber,
        durationSeconds: durationSeconds === '' ? null : Number(durationSeconds),
        heightMeters: heightMeters === '' ? null : Number(heightMeters),
        primaryColor: mainColor,
        secondaryColor: accentColor,
        colorPalette: palette,
        renderOverridesJson: JSON.stringify(mergedOverrides, null, 2),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Firework saved');
      router.refresh();
    });
  }

  const effectOptions = firework.effectOptions.map((option) => ({
    value: option.id,
    label: option.name,
    description: option.family,
  }));
  const canAddColor = !usedRoles.has('mix') || !usedRoles.has('core');

  return (
    <div className="flex flex-col gap-5 xl:h-[calc(100vh-6.5rem)] xl:flex-row xl:items-stretch">
      <Card radius="lg" className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
        <div className="relative h-[min(62vw,560px)] min-h-[360px] bg-[#05070d] xl:h-auto xl:min-h-0 xl:flex-1">
          <LazyFireworkReplayCanvas
            cues={[previewCue]}
            elapsed={elapsed}
            playbackRef={playbackRef}
            launchPositions={PREVIEW_LAUNCH_POSITIONS}
            muted
            interactive
            controlsVisible
            showFps
            renderTuning={{ glowPadding, whiteCoreSizePercent, whiteCoreBlurPercent }}
            headStyle={{
              coreSoftness,
              coreBrightness,
              coreOpacityFalloff,
              glowSize,
              glowSoftness,
              glowOpacityFalloff,
              glowBlur,
              backgroundGlowOpacityFalloff,
              backgroundGlowSoftness,
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => {
                if (!isPlaying && playbackRef.current >= previewDuration - 0.05) {
                  setPreviewTime(PREVIEW_START_SECONDS);
                }
                setIsPlaying((playing) => !playing);
              }}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => {
                setIsPlaying(false);
                setPreviewTime(PREVIEW_START_SECONDS);
              }}
              aria-label="Reset preview"
            >
              <RotateCcw size={16} />
            </Button>
            <Button
              variant={isLooping ? 'primary' : 'secondary'}
              size="icon"
              onClick={() => setIsLooping((looping) => !looping)}
              aria-pressed={isLooping}
              aria-label={isLooping ? 'Disable looping' : 'Enable looping'}
            >
              <Repeat size={16} />
            </Button>
          </div>
          <Slider
            value={[Math.min(elapsed, previewDuration)]}
            min={0}
            max={previewDuration}
            step={0.05}
            onValueChange={(next) => setPreviewTime(next[0] ?? 0)}
            aria-label="Preview timeline"
            className="min-w-40 flex-1"
          />
          <div className="font-mono text-sm text-[color:var(--color-content-subtle)] tabular-nums">
            {elapsed.toFixed(1)}s / {previewDuration.toFixed(1)}s
          </div>
        </div>
      </Card>

      <Card
        radius="lg"
        className="flex w-full min-w-0 flex-col p-0 xl:w-[460px] xl:shrink-0 xl:self-stretch"
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 pb-8">
          {error ? (
            <InlineAlert tone="danger" title="Could not save">
              {error}
            </InlineAlert>
          ) : null}

          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="fw-name">Name</FieldLabel>
              <Input id="fw-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Base effect</FieldLabel>
              <SelectField
                value={effectId}
                onChange={setEffectId}
                options={effectOptions}
                ariaLabel="Base effect"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="fw-caliber">Calibre</FieldLabel>
                <Input
                  id="fw-caliber"
                  placeholder="30mm"
                  value={caliber}
                  onChange={(e) => setCaliber(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fw-duration">Duration (s)</FieldLabel>
                <Input
                  id="fw-duration"
                  inputMode="decimal"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fw-height">Height (m)</FieldLabel>
                <Input
                  id="fw-height"
                  inputMode="decimal"
                  value={heightMeters}
                  onChange={(e) => setHeightMeters(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="fw-description">Description</FieldLabel>
              <Textarea
                id="fw-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-4 border-t border-[color:var(--color-border-subtle)] pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--color-content-emphasis)]">
                Colour
              </h3>
              <Button size="sm" variant="secondary" onClick={addColor} disabled={!canAddColor}>
                <Plus size={14} /> Add colour
              </Button>
            </div>

            {colorSlots.map((slot) => {
              const roleOptions = (['mix', 'core'] as ColorRole[])
                .filter((role) => role === slot.role || !usedRoles.has(role))
                .map((role) => ({ value: role, label: ROLE_LABEL[role] }));
              return (
                <div
                  key={slot.id}
                  className="space-y-3 rounded-lg border border-[color:var(--color-border-subtle)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    {slot.role === 'main' ? (
                      <span className="text-xs font-semibold text-[color:var(--color-content-emphasis)]">
                        {ROLE_LABEL.main}
                      </span>
                    ) : (
                      <div className="min-w-44">
                        <SelectField
                          value={slot.role}
                          onChange={(value) => updateSlotRole(slot.id, value as ColorRole)}
                          options={roleOptions}
                          ariaLabel="Where this colour applies"
                        />
                      </div>
                    )}
                    {slot.role !== 'main' ? (
                      <button
                        type="button"
                        aria-label="Remove colour"
                        className="text-[color:var(--color-content-subtle)] hover:text-[color:var(--color-content-emphasis)]"
                        onClick={() => removeSlot(slot.id)}
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-[color:var(--color-content-subtle)]">
                    {ROLE_HINT[slot.role]}
                  </p>
                  <ColorField
                    label="Colour"
                    value={HEX.test(slot.hex) ? slot.hex : '#ffffff'}
                    onChange={(hex) => updateSlotHex(slot.id, hex ?? '#ffffff')}
                  />
                  {slot.role === 'mix' ? (
                    <SliderField
                      label="Accent share"
                      min={5}
                      max={60}
                      step={1}
                      value={Math.round(accentAmount * 100)}
                      formatValue={(value) => `${value}%`}
                      hint="How much of the burst fires in the accent colour. 50% is an even split; 10% is the odd highlight star."
                      onChange={(value) => setAccentAmount(value / 100)}
                    />
                  ) : null}
                </div>
              );
            })}
            <p className="text-xs text-[color:var(--color-content-subtle)]">
              One colour by default. Add an accent for a random two-colour mix, or a centre colour
              for a contrasting core.
            </p>
          </div>

          <FireworkRenderControls
            design={previewDesign}
            defaults={overridesRecord}
            calibrationDefaults={calibrationDefaults}
            mutate={mutateOverrides}
            disabled={!parsedOverrides.ok}
            showLaunch
            showStarCount
          />
        </div>

        <div className="border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-surface)] p-4">
          <Button
            className="w-full"
            onClick={save}
            loading={isPending}
            disabled={!parsedOverrides.ok}
          >
            <Save size={16} />
            Save firework
          </Button>
        </div>
      </Card>
    </div>
  );
}
