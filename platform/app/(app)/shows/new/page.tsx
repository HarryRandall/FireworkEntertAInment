/**
 * The "create new show" flow.
 *
 * Five minimal full-screen steps, one question each, everything answerable
 * by tapping a card (the brief is the only typed field):
 *   0. Describe — big-type creative brief + style pills.
 *   1. Sound — drop a track, or pick "No soundtrack" (+ length cards).
 *      Upload + music analysis start in the background immediately.
 *   2. Budget — four human-labelled tiers, no sliders.
 *   3. Fireworks — multi-select type cards, all on by default.
 *   4. Site — width presets with firing-position dot diagrams.
 *
 * The show title is derived automatically (track filename, then the brief)
 * so nothing has to be typed beyond the description.
 *
 * Critical invariants enforced by the wizard tests in
 * `tests/new-show-wizard.test.mjs`:
 *   - The form's `onSubmit` only advances the flow; it must never call
 *     `createShowAction`.
 *   - The create-show server action is invoked once, and only inside
 *     {@link triggerGenerate}, so accidental Enter-presses can't create a draft.
 *   - The audio file is uploaded directly to Supabase Storage and only the
 *     path + `musicAnalysisId` are submitted via the action.
 */
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, MicOff, Sparkles, X } from 'lucide-react';
import { ChoiceChip } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client';
import {
  FIREWORK_TYPES,
  FIREWORK_TYPE_KEYS,
  launchPositionsForWidth,
  type FireworkTypeKey,
} from '@/lib/cue-generation/show-options';
import {
  DEFAULT_SHOW_STYLE,
  SHOW_STYLE_LIST,
  type ShowStyleKey,
} from '@/lib/cue-generation/show-styles';
import {
  clearPersistedGenerationStart,
  persistGenerationStartedAt,
} from '@/lib/generation-progress-storage';
import { slugifyTitle } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { createShowAction } from './actions';
import { AudioUpload } from './_components/AudioUpload';
import { ChoiceCard, PositionDots } from './_components/cards';
import { StepPanel } from './_components/StepPanel';
import {
  AUDIO_BUCKET,
  BUDGET_TIERS,
  MAX_AUDIO_BYTES,
  NO_MUSIC_DURATIONS,
  STEPS,
  WIDTH_PRESETS,
} from './constants';
import type { AudioUploadState, FieldError as FieldErrorKey, UploadedAudio } from './types';
import {
  deriveTitleFromDescription,
  inferAudioContentType,
  sanitizeStorageName,
  suggestTitleFromFilename,
} from './utils';

type SoundtrackMode = 'song' | 'none';

export default function NewShowPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // === Step 0: describe ====================================================
  const [description, setDescription] = useState('');
  const [styleKey, setStyleKey] = useState<ShowStyleKey>(DEFAULT_SHOW_STYLE);
  const promptPrefilledRef = useRef(false);

  // === Step 1: sound =======================================================
  const [soundtrackMode, setSoundtrackMode] = useState<SoundtrackMode>('song');
  const [durationMinutes, setDurationMinutes] =
    useState<(typeof NO_MUSIC_DURATIONS)[number]['minutes']>(3);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUploadState, setAudioUploadState] = useState<AudioUploadState>('idle');
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<UploadedAudio | null>(null);
  const [title, setTitle] = useState('');
  const titleRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Promise of the in-flight upload so `triggerGenerate` can await it if the
  // user clicks Generate before the upload finishes.
  const uploadPromiseRef = useRef<Promise<UploadedAudio> | null>(null);
  // Monotonic token: lets late upload responses ignore themselves if the user
  // has already attached a different file.
  const uploadTokenRef = useRef(0);
  const autoBriefUploadIdRef = useRef<string | null>(null);

  // === Step 2: budget ======================================================
  const [budget, setBudget] = useState<number>(1000);

  // === Step 3: firework types =============================================
  const [fireworkTypes, setFireworkTypes] = useState<Set<FireworkTypeKey>>(
    () => new Set(FIREWORK_TYPE_KEYS),
  );

  // === Step 4: site width ==================================================
  const [widthFeet, setWidthFeet] = useState<number>(80);
  const [measuredWidth, setMeasuredWidth] = useState('');

  // === Flow nav ============================================================
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldError, setFieldError] = useState<FieldErrorKey>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  const durationValue = `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`;
  const measuredFeet = Number(measuredWidth);
  const effectiveWidthFeet =
    measuredWidth.trim() && Number.isFinite(measuredFeet) && measuredFeet >= 5
      ? Math.min(Math.round(measuredFeet), 2000)
      : widthFeet;
  const effectivePositions = launchPositionsForWidth(effectiveWidthFeet);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (promptPrefilledRef.current) return;
    const prompt = searchParams.get('prompt')?.trim();
    if (!prompt) return;
    promptPrefilledRef.current = true;
    setDescription(prompt.slice(0, 2000));
  }, [searchParams]);

  /** True when the user can advance past the current step. */
  const stepValid = useMemo(() => {
    if (stepIndex === 0) return description.trim().length > 0;
    return true;
  }, [stepIndex, description]);

  // Resolve the audio file's duration locally so we can show "M:SS" in the
  // attached-track pill. The `<audio>` element is throwaway and never plays.
  useEffect(() => {
    if (!audioFile) {
      setAudioDuration(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    const audio = new Audio(url);
    const onLoaded = () => setAudioDuration(audio.duration || null);
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  useEffect(() => {
    if (
      stepIndex === 1 &&
      uploadedAudio &&
      audioUploadState === 'ready' &&
      title.trim() &&
      autoBriefUploadIdRef.current !== uploadedAudio.musicAnalysisId
    ) {
      autoBriefUploadIdRef.current = uploadedAudio.musicAnalysisId;
      setFieldError(null);
      setStepIndex(2);
    }
  }, [audioUploadState, stepIndex, title, uploadedAudio]);

  const focusTitleRequirement = () => {
    window.requestAnimationFrame(() => {
      const titleInput = formRef.current?.elements.namedItem('title');
      if (titleInput instanceof HTMLInputElement) titleInput.focus();
    });
  };

  const toggleFireworkType = (type: FireworkTypeKey) => {
    setFireworkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Keep at least one type selected — an empty show isn't a show.
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const onFilePicked = (file: File | null) => {
    if (!file) {
      uploadTokenRef.current += 1;
      setAudioFile(null);
      setUploadedAudio(null);
      setAudioUploadState('idle');
      setAudioUploadError(null);
      uploadPromiseRef.current = null;
      autoBriefUploadIdRef.current = null;
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      toast.error('File too large', { description: 'Audio must be 50MB or smaller.' });
      return;
    }
    if (file.type && !file.type.startsWith('audio/')) {
      toast.error('Unsupported file', { description: 'Please pick an audio file.' });
      return;
    }
    // Nothing else to type: the title comes from the track name (editable
    // later on the show page).
    if (!titleRef.current.trim()) {
      const suggested = suggestTitleFromFilename(file.name);
      if (suggested) {
        titleRef.current = suggested;
        setTitle(suggested);
        if (fieldError === 'title') setFieldError(null);
      }
    }
    setSoundtrackMode('song');
    setAudioFile(file);
    setUploadedAudio(null);
    setAudioUploadError(null);
    const token = uploadTokenRef.current + 1;
    uploadTokenRef.current = token;
    const uploadPromise = uploadAudioAndStartAnalysis(file, token);
    uploadPromiseRef.current = uploadPromise;
    void uploadPromise.catch(() => {
      // The visible error state is set inside uploadAudioAndStartAnalysis.
    });
    toast.success('Track attached', { description: file.name });
  };

  const clearAudio = () => {
    uploadTokenRef.current += 1;
    setAudioFile(null);
    setUploadedAudio(null);
    setAudioUploadState('idle');
    setAudioUploadError(null);
    uploadPromiseRef.current = null;
    autoBriefUploadIdRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const chooseNoSoundtrack = () => {
    clearAudio();
    setSoundtrackMode('none');
  };

  /**
   * Direct-to-storage audio upload + music analysis kickoff.
   *
   * The upload is gated on the current `token` — if the user picks a new
   * file mid-flight, the in-flight promise's resolved values are dropped on
   * the floor so we don't show a stale "ready" state.
   */
  const uploadAudioAndStartAnalysis = async (file: File, token: number): Promise<UploadedAudio> => {
    setAudioUploadState('uploading');
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      const message = 'You are not signed in. Refresh and sign back in.';
      if (uploadTokenRef.current === token) {
        setAudioUploadState('error');
        setAudioUploadError(message);
      }
      throw new Error(message);
    }

    const contentType = inferAudioContentType(file);
    const audioPath = `${user.id}/${crypto.randomUUID()}-${sanitizeStorageName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, file, {
        contentType,
        upsert: false,
      });
    if (uploadError) {
      if (uploadTokenRef.current === token) {
        setAudioUploadState('error');
        setAudioUploadError(uploadError.message || 'Upload failed.');
      }
      throw new Error(uploadError.message || 'Upload failed.');
    }

    let analysisResult: { ok: true; musicAnalysisId: string } | { ok: false; error: string };
    try {
      const response = await fetch('/api/music-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioPath,
          originalFilename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      const json = (await response.json()) as
        | { ok: true; musicAnalysisId: string }
        | { ok: false; error: string };
      analysisResult = json;
    } catch (error) {
      analysisResult = {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not start music analysis.',
      };
    }
    if (!analysisResult.ok) {
      // Best-effort: roll back the upload if the analysis row couldn't be
      // created so we don't leave orphaned files in storage.
      await supabase.storage.from(AUDIO_BUCKET).remove([audioPath]);
      if (uploadTokenRef.current === token) {
        setAudioUploadState('error');
        setAudioUploadError(analysisResult.error);
      }
      throw new Error(analysisResult.error);
    }

    const uploaded = {
      audioPath,
      musicAnalysisId: analysisResult.musicAnalysisId,
      originalName: file.name,
      sizeBytes: file.size,
      contentType,
    };
    if (uploadTokenRef.current === token) {
      setUploadedAudio(uploaded);
      setAudioUploadState('ready');
      setAudioUploadError(null);
      if (!titleRef.current.trim()) {
        setFieldError('title');
        setStepIndex(1);
        focusTitleRequirement();
      }
    }
    return uploaded;
  };

  /**
   * The form's submit handler is intent-only: it advances the flow on
   * Enter and never creates a show. Generation runs ONLY when the user
   * explicitly clicks the "Generate show" button (see triggerGenerate).
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(null);
    if (stepIndex < STEPS.length - 1) {
      goToStep(stepIndex + 1);
    }
  };

  /** Enter advances the flow from anywhere except textareas and buttons. */
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement) return;
    if (target.closest('button')) return;
    e.preventDefault();
    if (stepIndex < STEPS.length - 1) goToStep(stepIndex + 1);
  };

  /** Click handler for the Generate button. Derives the title, awaits any
   * pending upload, then submits the show via the server action. */
  const triggerGenerate = () => {
    setFieldError(null);
    // No manual title entry anywhere: track name first, then the brief.
    const finalTitle =
      title.trim() ||
      suggestTitleFromFilename(audioFile?.name ?? '') ||
      deriveTitleFromDescription(description) ||
      'Untitled show';
    if (finalTitle !== title) {
      titleRef.current = finalTitle;
      setTitle(finalTitle);
    }
    setIsLaunching(true);
    // Navigate to the generating route immediately so the URL and splash swap
    // happens on click, not after the server action returns. If the server
    // needs to suffix the slug, the stored start time is copied across below.
    const desiredSlug = slugifyTitle(finalTitle);
    const titleParam = encodeURIComponent(finalTitle);
    const generationStartedAt = persistGenerationStartedAt(desiredSlug);
    router.push(`/shows/${desiredSlug}/generating?creating=1&t=${titleParam}`);
    startTransition(async () => {
      let finalUploadedAudio = uploadedAudio;
      if (audioFile && !finalUploadedAudio && uploadPromiseRef.current) {
        try {
          finalUploadedAudio = await uploadPromiseRef.current;
        } catch (error) {
          setIsLaunching(false);
          clearPersistedGenerationStart(desiredSlug);
          router.replace('/shows/new');
          toast.error('Could not upload track', {
            description: error instanceof Error ? error.message : 'Try replacing the audio file.',
          });
          return;
        }
      }
      if (audioFile && audioUploadState === 'error') {
        setIsLaunching(false);
        clearPersistedGenerationStart(desiredSlug);
        router.replace('/shows/new');
        toast.error('Could not upload track', {
          description: audioUploadError ?? 'Try replacing the audio file.',
        });
        return;
      }

      const data = new FormData();
      data.set('budget', String(budget));
      data.set('duration', durationValue);
      data.set('timeOfDay', 'Night');
      data.set('title', finalTitle);
      data.set('description', description);
      data.set('showStyle', styleKey);
      data.set('siteWidthFeet', String(effectiveWidthFeet));
      data.set('desiredSlug', desiredSlug);
      fireworkTypes.forEach((type) => data.append('fireworkTypes', type));
      if (finalUploadedAudio) {
        data.set('audioPath', finalUploadedAudio.audioPath);
        data.set('musicAnalysisId', finalUploadedAudio.musicAnalysisId);
      }

      const result = await createShowAction(data);
      if (!result.ok) {
        setIsLaunching(false);
        clearPersistedGenerationStart(desiredSlug);
        router.replace('/shows/new');
        toast.error(result.error);
        return;
      }
      // Collision: the server assigned a suffixed slug. Redirect to the real
      // one so the route stops waiting on a row that will never appear.
      if (result.slug !== desiredSlug) {
        persistGenerationStartedAt(result.slug, generationStartedAt);
        clearPersistedGenerationStart(desiredSlug);
        router.replace(`/shows/${result.slug}/generating`);
      } else {
        router.refresh();
      }
    });
  };

  /**
   * Move the flow to `nextIndex`. Going backward is always allowed; going
   * forward requires the current step to be valid (otherwise toast).
   */
  const goToStep = (nextIndex: number) => {
    if (nextIndex <= stepIndex) {
      setFieldError(null);
      setStepIndex(nextIndex);
      return;
    }
    if (!stepValid) {
      toast.error('Describe the show first - a sentence is plenty.');
      return;
    }
    setFieldError(null);
    setStepIndex(nextIndex);
  };

  const activeStep = STEPS[stepIndex];
  const isFinalStep = stepIndex === STEPS.length - 1;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="-mx-6 -my-6 flex flex-1 sm:-mx-8 lg:-mx-10"
    >
      {/* Hidden derived title — kept as a named element for focus targeting. */}
      <input type="hidden" name="title" value={title} readOnly />

      <div className="flex w-full flex-col px-6 pt-5 pb-6 sm:px-10">
        {/* === Top bar: counter + close ================================== */}
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs tracking-[0.18em] text-[color:var(--color-content-muted)] tabular-nums">
            {stepIndex + 1} / {STEPS.length}
          </p>
          <Link
            href="/shows"
            aria-label="Close"
            className="rounded-full p-2 text-[color:var(--color-content-muted)] transition-colors hover:bg-[color:var(--color-bg-subtle)] hover:text-[color:var(--color-content-emphasis)]"
          >
            <X size={18} strokeWidth={1.75} />
          </Link>
        </div>

        {/* === Step content, vertically centred ========================== */}
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-8">
          <h1 className="text-3xl font-black tracking-tight text-[color:var(--color-content-emphasis)] sm:text-5xl">
            {activeStep.title}
          </h1>
          <p className="mt-3 text-sm text-[color:var(--color-content-subtle)] sm:text-base">
            {activeStep.description}
          </p>

          <div className="mt-8">
            <StepPanel active={stepIndex === 0}>
              <div className="space-y-6">
                <Textarea
                  name="description"
                  rows={4}
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Gold and silver, slow elegant start, everything ends in one huge crackling finale."
                  className="text-base sm:text-lg"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 font-mono text-[10px] tracking-[0.18em] text-[color:var(--color-content-muted)] uppercase">
                    Style
                  </span>
                  {SHOW_STYLE_LIST.map((style) => (
                    <ChoiceChip
                      key={style.key}
                      size="md"
                      selected={styleKey === style.key}
                      onClick={() => setStyleKey(style.key)}
                      title={style.tagline}
                    >
                      {style.name}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 1}>
              <div className="space-y-3">
                <div className={cn(soundtrackMode === 'none' && 'opacity-50')}>
                  <AudioUpload
                    file={audioFile}
                    duration={audioDuration}
                    uploadState={audioUploadState}
                    error={audioUploadError}
                    inputRef={fileInputRef}
                    onFile={onFilePicked}
                    onClear={clearAudio}
                  />
                </div>
                <ChoiceCard
                  selected={soundtrackMode === 'none'}
                  title="No soundtrack"
                  description="Design to a rhythm instead - the show builds its own arc."
                  diagram={
                    <MicOff
                      size={16}
                      strokeWidth={1.75}
                      className="text-[color:var(--color-content-muted)]"
                    />
                  }
                  onClick={chooseNoSoundtrack}
                />
                {soundtrackMode === 'none' ? (
                  <div className="grid gap-3 pt-3 sm:grid-cols-3">
                    {NO_MUSIC_DURATIONS.map((option) => (
                      <ChoiceCard
                        key={option.minutes}
                        selected={durationMinutes === option.minutes}
                        title={option.label}
                        hint={`${option.minutes} min`}
                        description={option.description}
                        onClick={() => setDurationMinutes(option.minutes)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 2}>
              <div className="grid gap-3 sm:grid-cols-2">
                {BUDGET_TIERS.map((tier) => (
                  <ChoiceCard
                    key={tier.value}
                    selected={budget === tier.value}
                    title={tier.label}
                    hint={tier.hint}
                    description={tier.description}
                    onClick={() => setBudget(tier.value)}
                  />
                ))}
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 3}>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIREWORK_TYPE_KEYS.map((key) => {
                  const type = FIREWORK_TYPES[key];
                  return (
                    <ChoiceCard
                      key={key}
                      multi
                      selected={fireworkTypes.has(key)}
                      title={type.label}
                      description={type.description}
                      onClick={() => toggleFireworkType(key)}
                    />
                  );
                })}
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 4}>
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {WIDTH_PRESETS.map((preset) => (
                    <ChoiceCard
                      key={preset.feet}
                      selected={!measuredWidth.trim() && widthFeet === preset.feet}
                      title={preset.label}
                      description={preset.description}
                      diagram={<PositionDots count={preset.positions} />}
                      onClick={() => {
                        setMeasuredWidth('');
                        setWidthFeet(preset.feet);
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 text-sm text-[color:var(--color-content-subtle)]">
                  <span>I&apos;ve measured:</span>
                  <Input
                    type="number"
                    min={5}
                    max={2000}
                    inputMode="numeric"
                    value={measuredWidth}
                    onChange={(e) => setMeasuredWidth(e.target.value)}
                    placeholder="width"
                    className="h-9 w-24 text-center tabular-nums"
                  />
                  <span>ft</span>
                  {measuredWidth.trim() ? <PositionDots count={effectivePositions} /> : null}
                </div>
              </div>
            </StepPanel>
          </div>
        </div>

        {/* === Bottom bar: navigation ==================================== */}
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            disabled={mounted && stepIndex === 0}
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[11px] text-[color:var(--color-content-muted)] sm:inline">
              press Enter ↵
            </span>
            {!isFinalStep ? (
              <Button
                type="button"
                onClick={() => goToStep(stepIndex + 1)}
                disabled={mounted && !stepValid}
              >
                Continue
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button type="button" onClick={triggerGenerate} disabled={mounted && isLaunching}>
                Generate show
                <Sparkles size={16} strokeWidth={2} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
