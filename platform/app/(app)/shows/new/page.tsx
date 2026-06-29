/**
 * The "create new show" flow.
 *
 * Six minimal full-screen steps, one question each, everything answerable
 * by tapping a card (the brief is the only typed field):
 *   0. Describe — big-type creative brief + style pills.
 *   1. Sound — drop a track, or pick "No soundtrack".
 *      Upload + music analysis start in the background immediately.
 *   2. Length — match the track, or pick a fixed show length.
 *   3. Budget — four human-labelled tiers, no sliders.
 *   4. Fireworks — multi-select type cards, at least one required.
 *   5. Site — width presets with firing-position dot diagrams.
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
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Dices,
  Hourglass,
  MicOff,
  Sparkles,
  Timer,
  Waves,
  Zap,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { CueModelSelect } from '@/app/components/app/CueModelSelect';
import { Input, Textarea } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client';
import {
  FIREWORK_TYPES,
  FIREWORK_TYPE_KEYS,
  launchPositionsForWidth,
  type FireworkTypeKey,
} from '@/lib/cue-generation/show-options';
import { DEFAULT_SHOW_STYLE, type ShowStyleKey } from '@/lib/cue-generation/show-styles';
import { CUE_MODEL_OPTIONS, FALLBACK_CUE_MODEL, normaliseCueModel } from '@/lib/cue-models';
import {
  clearPersistedGenerationStart,
  persistGenerationStartedAt,
} from '@/lib/generation-progress-storage';
import { slugifyTitle } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { createShowAction } from './actions';
import { AudioUpload } from './_components/AudioUpload';
import { ChoiceCard, PositionDots } from './_components/cards';
import { StepDots } from './_components/StepDots';
import { StepPanel } from './_components/StepPanel';
import {
  AUDIO_BUCKET,
  BUDGET_TIERS,
  MAX_AUDIO_BYTES,
  SHOW_LENGTH_PRESETS,
  RANDOM_BRIEFS,
  STEPS,
  WIDTH_PRESETS,
} from './constants';
import type { AudioUploadState, FieldError as FieldErrorKey, UploadedAudio } from './types';
import {
  deriveTitleFromDescription,
  formatDuration,
  inferAudioContentType,
  sanitizeStorageName,
  suggestTitleFromFilename,
} from './utils';

type SoundtrackMode = 'song' | 'none';

/** Either "match the track" (use the uploaded audio's duration) or one of the
 * fixed preset lengths. `null` means the user has not chosen yet. */
type LengthChoice = 'match' | (typeof SHOW_LENGTH_PRESETS)[number]['minutes'];

/** Diagram icon for each preset, in SHOW_LENGTH_PRESETS order. */
const LENGTH_PRESET_ICONS = [Zap, Timer, Hourglass] as const;
const DEFAULT_GENERATE_CREDIT_COST = 3;

export default function NewShowPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // === Step 0: describe ====================================================
  const [description, setDescription] = useState('');
  const [styleKey] = useState<ShowStyleKey>(DEFAULT_SHOW_STYLE);
  const [selectedCueModel, setSelectedCueModel] = useState(FALLBACK_CUE_MODEL);
  const promptPrefilledRef = useRef(false);
  const modelPrefilledRef = useRef(false);

  // === Step 1: sound =======================================================
  const [soundtrackMode, setSoundtrackMode] = useState<SoundtrackMode>('song');
  // === Step 2: length ======================================================
  const [lengthChoice, setLengthChoice] = useState<LengthChoice | null>(null);
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

  // === Step 3: budget ======================================================
  const [budget, setBudget] = useState<number | null>(null);

  // === Step 4: firework types =============================================
  const [fireworkTypes, setFireworkTypes] = useState<Set<FireworkTypeKey>>(() => new Set());

  // === Step 5: site width ==================================================
  const [widthFeet, setWidthFeet] = useState<number>(80);
  const [measuredWidth, setMeasuredWidth] = useState('');

  // === Flow nav ============================================================
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldError, setFieldError] = useState<FieldErrorKey>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  const measuredFeet = Number(measuredWidth);
  const effectiveWidthFeet =
    measuredWidth.trim() && Number.isFinite(measuredFeet) && measuredFeet >= 5
      ? Math.min(Math.round(measuredFeet), 2000)
      : widthFeet;
  const effectivePositions = launchPositionsForWidth(effectiveWidthFeet);
  const selectedCueModelOption = CUE_MODEL_OPTIONS.find(
    (option) => option.value === selectedCueModel,
  );
  const selectedCueModelLabel = selectedCueModelOption?.label ?? 'selected model';
  const selectedCueModelCost = selectedCueModelOption?.creditCost ?? DEFAULT_GENERATE_CREDIT_COST;

  // "Match the track" sends the audio's exact duration in seconds so the show
  // runs for the whole song; presets send the round-minute form the action's
  // duration map already understands.
  const durationValue =
    lengthChoice === 'match'
      ? audioDuration && Number.isFinite(audioDuration) && audioDuration > 0
        ? `${Math.round(audioDuration)} seconds`
        : '3 minutes'
      : `${lengthChoice ?? 3} minute${lengthChoice === 1 ? '' : 's'}`;

  // A track is attached (still uploading or ready). Drives whether the Length
  // step offers the "match the track" option.
  const hasSoundtrack = soundtrackMode === 'song' && Boolean(audioFile);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let shouldCleanUrl = false;
    const prompt = searchParams.get('prompt')?.trim();
    if (prompt && !promptPrefilledRef.current) {
      promptPrefilledRef.current = true;
      setDescription(prompt.slice(0, 2000));
      setStepIndex((index) => (index === 0 ? 1 : index));
      shouldCleanUrl = true;
    }
    const model = searchParams.get('model');
    if (model && !modelPrefilledRef.current) {
      modelPrefilledRef.current = true;
      setSelectedCueModel(normaliseCueModel(model, FALLBACK_CUE_MODEL));
      shouldCleanUrl = true;
    }
    if (!shouldCleanUrl) return;
    // Strip consumed query params so a refresh or share link starts clean.
    // Use history directly to avoid a navigation that would re-render the flow.
    window.history.replaceState(null, '', '/shows/new');
  }, [searchParams]);

  /** True when the user can advance past the current step. */
  const stepValid = useMemo(() => {
    if (stepIndex === 0) return description.trim().length > 0;
    if (stepIndex === 4) return fireworkTypes.size > 0;
    return true;
  }, [stepIndex, description, fireworkTypes]);

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

  /** Dice: replace the whole brief with a random ready-made example. */
  const rollDice = () => {
    const options = RANDOM_BRIEFS.filter((brief) => brief !== description.trim());
    const pool = options.length > 0 ? options : RANDOM_BRIEFS;
    setDescription(pool[Math.floor(Math.random() * pool.length)]);
  };

  const toggleFireworkType = (type: FireworkTypeKey) => {
    setFireworkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
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
    setLengthChoice(null);
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
    goToStep(stepIndex + 1);
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
    setLengthChoice((prev) => (prev === 'match' ? null : prev));
  };

  const chooseNoSoundtrack = () => {
    clearAudio();
    setSoundtrackMode('none');
    setLengthChoice(null);
    goToStep(stepIndex + 1);
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
      data.set('budget', String(budget ?? 1000));
      data.set('duration', durationValue);
      data.set('timeOfDay', 'Night');
      data.set('title', finalTitle);
      data.set('description', description);
      data.set('showStyle', styleKey);
      data.set('selectedCueModel', selectedCueModel);
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
      className="new-show-wizard-screen -mx-6 -my-6 flex flex-1 sm:-mx-8 lg:-mx-10"
    >
      {/* Hidden derived title — kept as a named element for focus targeting. */}
      <input type="hidden" name="title" value={title} readOnly />

      <div className="relative z-10 flex w-full flex-col px-6 pt-5 pb-6 sm:px-10">
        {/* === Step content, vertically centred ========================== */}
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-8 sm:py-10">
          <div className="relative isolate mx-auto w-full max-w-4xl">
            <div className="prompt-hero-glow" aria-hidden />
            <div className="text-center">
              <h1 className="text-3xl leading-tight font-bold tracking-tight text-[color:var(--color-content-emphasis)] sm:text-4xl lg:text-5xl">
                {activeStep.title}
              </h1>
              <p className="mt-3 text-sm text-[color:var(--color-content-subtle)] sm:text-base">
                {activeStep.description}
              </p>
            </div>

            <div className="mt-8 w-full">
              <StepPanel active={stepIndex === 0}>
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/70 shadow-xs backdrop-blur-xl">
                    <Textarea
                      name="description"
                      rows={4}
                      autoFocus
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your show, or hit the dice to randomise."
                      className="h-36 resize-none rounded-none border-0 bg-transparent p-4 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:text-lg"
                    />
                    <div className="bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-bg-default)_24%,transparent)_100%)] px-4 pt-2 pb-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CueModelSelect
                          value={selectedCueModel}
                          onChange={setSelectedCueModel}
                          className="sm:w-[164px]"
                        />
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={rollDice}
                            aria-label="Randomise the brief"
                            title="Randomise the brief"
                            className="h-12 w-12 rounded-full px-0"
                          >
                            <Dices size={18} />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => goToStep(stepIndex + 1)}
                            disabled={mounted && !stepValid}
                            size="lg"
                            className="rounded-full px-8"
                          >
                            Continue
                            <ArrowRight size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </StepPanel>

              <StepPanel active={stepIndex === 1}>
                <div className="space-y-4">
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
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-[color:var(--color-border-default)]" />
                    <span className="text-xs font-medium tracking-wide text-[color:var(--color-content-muted)] uppercase">
                      or
                    </span>
                    <span className="h-px flex-1 bg-[color:var(--color-border-default)]" />
                  </div>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={soundtrackMode === 'none'}
                    onClick={chooseNoSoundtrack}
                    className={cn(
                      'focus-visible:ring-ring/50 relative flex w-full items-center gap-4 rounded-xl border-2 bg-[color:var(--color-bg-elevated)] p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] focus:outline-none focus-visible:ring-3 active:scale-[0.99] sm:p-5',
                      soundtrackMode === 'none'
                        ? 'border-[color:var(--color-content-emphasis)]'
                        : 'border-[color:var(--color-border-default)] hover:border-[color:var(--color-content-emphasis)]/40',
                    )}
                  >
                    {soundtrackMode === 'none' ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-3 right-3 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)] shadow-sm"
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]">
                      <MicOff
                        size={18}
                        strokeWidth={1.75}
                        className="text-[color:var(--color-content-muted)]"
                      />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[color:var(--color-content-emphasis)] sm:text-base">
                        No soundtrack
                      </span>
                      <span className="text-xs leading-relaxed text-[color:var(--color-content-subtle)] sm:text-sm">
                        Design to a rhythm instead - the show builds its own arc.
                      </span>
                    </span>
                  </button>
                </div>
              </StepPanel>

              <StepPanel active={stepIndex === 2}>
                <div className="space-y-4">
                  {hasSoundtrack ? (
                    <>
                      <ChoiceCard
                        selected={lengthChoice === 'match'}
                        title="Match the track"
                        hint={audioDuration ? formatDuration(audioDuration) : 'Auto'}
                        description="Run the show for the full length of your soundtrack."
                        diagram={
                          <Waves
                            size={16}
                            strokeWidth={1.75}
                            className="text-[color:var(--color-content-muted)]"
                          />
                        }
                        onClick={() => {
                          setLengthChoice('match');
                          goToStep(stepIndex + 1);
                        }}
                      />
                      <div className="flex items-center gap-3 py-1">
                        <span className="h-px flex-1 bg-[color:var(--color-border-default)]" />
                        <span className="text-xs font-medium tracking-wide text-[color:var(--color-content-muted)] uppercase">
                          or
                        </span>
                        <span className="h-px flex-1 bg-[color:var(--color-border-default)]" />
                      </div>
                    </>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {SHOW_LENGTH_PRESETS.map((option, index) => {
                      const Icon = LENGTH_PRESET_ICONS[index] ?? Timer;
                      return (
                        <ChoiceCard
                          key={option.minutes}
                          selected={lengthChoice === option.minutes}
                          title={option.label}
                          hint={`${option.minutes} min`}
                          description={option.description}
                          diagram={
                            <Icon
                              size={16}
                              strokeWidth={1.75}
                              className="text-[color:var(--color-content-muted)]"
                            />
                          }
                          onClick={() => {
                            setLengthChoice(option.minutes);
                            goToStep(stepIndex + 1);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </StepPanel>

              <StepPanel active={stepIndex === 3}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {BUDGET_TIERS.map((tier) => (
                    <ChoiceCard
                      key={tier.value}
                      selected={budget === tier.value}
                      title={tier.label}
                      hint={tier.hint}
                      description={tier.description}
                      onClick={() => {
                        setBudget(tier.value);
                        goToStep(stepIndex + 1);
                      }}
                    />
                  ))}
                </div>
              </StepPanel>

              <StepPanel active={stepIndex === 4}>
                <div className="space-y-6">
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
                  <div className="flex justify-center pt-2">
                    <Button
                      type="button"
                      onClick={() => goToStep(stepIndex + 1)}
                      disabled={mounted && fireworkTypes.size === 0}
                      size="lg"
                      className="rounded-full px-8"
                    >
                      Continue
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                </div>
              </StepPanel>

              <StepPanel active={stepIndex === 5}>
                <div className="space-y-6">
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
                  <div className="flex items-center justify-center gap-3 text-sm text-[color:var(--color-content-subtle)]">
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
                  <div className="flex flex-col items-center pt-2">
                    <Button
                      type="button"
                      onClick={triggerGenerate}
                      disabled={mounted && isLaunching}
                      size="lg"
                      className="rounded-full px-8"
                    >
                      <Sparkles size={16} strokeWidth={2} />
                      Generate show
                    </Button>
                    <p className="mt-3 text-center text-xs text-[color:var(--color-content-subtle)]">
                      This will use {selectedCueModelCost} AI credit
                      {selectedCueModelCost === 1 ? '' : 's'} with {selectedCueModelLabel}.
                    </p>
                  </div>
                </div>
              </StepPanel>
            </div>
          </div>
        </div>

        {/* === Footer: circular Back (left edge), minimal dot stepper (centre),
                pill Skip (right edge) - spans the full content width ========== */}
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
            disabled={mounted && stepIndex === 0}
            aria-label="Back"
            className="h-10 w-10 rounded-full px-0"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </Button>
          <StepDots stepIndex={stepIndex} total={STEPS.length} />
          {isFinalStep ? (
            <span className="inline-block h-10 w-10" aria-hidden="true" />
          ) : (
            <Button
              type="button"
              onClick={() => goToStep(stepIndex + 1)}
              disabled={mounted && !stepValid}
              variant="ghost"
              className="rounded-full px-5"
            >
              Skip
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
