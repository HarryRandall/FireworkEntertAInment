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

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Dices,
  Hourglass,
  MicOff,
  RotateCcw,
  Sparkles,
  Timer,
  Waves,
  Zap,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { CueModelSelect } from '@/app/components/app/CueModelSelect';
import { Skeleton } from '@/app/components/ui/Feedback';
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
  SHOW_STYLES,
  SHOW_STYLE_LIST,
  type ShowStyleKey,
} from '@/lib/cue-generation/show-styles';
import { CUE_MODEL_OPTIONS, FALLBACK_CUE_MODEL, normaliseCueModel } from '@/lib/cue-models';
import {
  clearPersistedGenerationCover,
  clearPersistedGenerationStart,
  copyPersistedGenerationCover,
  persistGenerationStartedAt,
  resolvePersistedGenerationCover,
} from '@/lib/generation-progress-storage';
import { formatDuration, slugifyTitle } from '@/lib/show-domain';
import { cn } from '@/lib/utils';
import { createShowAction, getShowGenerationPresentationAction } from './actions';
import { AudioUpload } from './_components/AudioUpload';
import { LaunchOverlay } from './_components/LaunchOverlay';
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
import type { AudioUploadState, ShowGenerationPresentation, UploadedAudio } from './types';
import {
  deriveTitleFromDescription,
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

type MusicAnalysisResponse = { ok: true; musicAnalysisId: string } | { ok: false; error: string };

function parseMusicAnalysisResponse(value: unknown, responseOk: boolean): MusicAnalysisResponse {
  if (
    responseOk &&
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === true &&
    'musicAnalysisId' in value &&
    typeof value.musicAnalysisId === 'string'
  ) {
    return { ok: true, musicAnalysisId: value.musicAnalysisId };
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string' &&
    value.error.trim()
  ) {
    return { ok: false, error: value.error };
  }
  return { ok: false, error: 'Could not start music analysis. Please try again.' };
}

async function cleanupUnusedMusicAnalysis(uploaded: UploadedAudio): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('/api/music-analysis', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          musicAnalysisId: uploaded.musicAnalysisId,
          audioPath: uploaded.audioPath,
        }),
      });
      if (response.ok) return;
      lastError = new Error(`Unused audio cleanup returned HTTP ${response.status}.`);
      if (response.status < 500) break;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unused audio cleanup failed.');
}

export default function NewShowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // === Step 0: describe ====================================================
  const [description, setDescription] = useState('');
  const [styleKey, setStyleKey] = useState<ShowStyleKey>(DEFAULT_SHOW_STYLE);
  const [selectedCueModel, setSelectedCueModel] = useState<string | null>(null);
  const [generationPresentation, setGenerationPresentation] =
    useState<ShowGenerationPresentation | null>(null);
  const [generationPresentationError, setGenerationPresentationError] = useState<string | null>(
    null,
  );
  const [generationPresentationRequest, setGenerationPresentationRequest] = useState(0);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioUploadErrorRef = useRef<HTMLDivElement>(null);
  const shouldFocusAudioUploadErrorRef = useRef(false);
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
  const [isLaunching, setIsLaunching] = useState(false);
  // Set on Generate; renders the instant client-side splash overlay that
  // covers the gap until the /generating route streams in.
  const [launch, setLaunch] = useState<{ slug: string; title: string; hasAudio: boolean } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);

  const hasMeasuredWidth = measuredWidth.trim().length > 0;
  const measuredFeet = Number(measuredWidth);
  const measuredWidthError =
    hasMeasuredWidth &&
    (!Number.isFinite(measuredFeet) ||
      !Number.isInteger(measuredFeet) ||
      measuredFeet < 5 ||
      measuredFeet > 2000)
      ? 'Enter a whole-number width between 5 and 2,000 ft.'
      : null;
  const effectiveWidthFeet =
    hasMeasuredWidth && !measuredWidthError ? Math.round(measuredFeet) : widthFeet;
  const effectivePositions = launchPositionsForWidth(effectiveWidthFeet);
  const effectiveCueModel =
    selectedCueModel ?? generationPresentation?.defaultCueModel ?? FALLBACK_CUE_MODEL;
  const selectedShowStyle = SHOW_STYLES[styleKey];
  const usesBeatPrecision = selectedShowStyle.engine === 'beat';
  const selectedCueModelOption = CUE_MODEL_OPTIONS.find(
    (option) => option.value === effectiveCueModel,
  );
  const selectedCueModelLabel =
    selectedCueModelOption?.label ?? effectiveCueModel.split('/').at(-1) ?? 'configured model';
  const selectedCueModelCost =
    generationPresentation?.modelCreditCosts[effectiveCueModel] ??
    selectedCueModelOption?.creditCost ??
    1;
  const displayedGenerationCost = usesBeatPrecision
    ? (generationPresentation?.fastCreditCost ?? 1)
    : generationPresentation?.generationMode === 'fast'
      ? generationPresentation.fastCreditCost
      : selectedCueModelCost;

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
    let active = true;
    setGenerationPresentation(null);
    setGenerationPresentationError(null);
    void getShowGenerationPresentationAction()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setGenerationPresentation(result.presentation);
          return;
        }
        setGenerationPresentationError(result.error);
      })
      .catch(() => {
        if (active) {
          setGenerationPresentationError('Could not load generation options. Please try again.');
        }
      });
    return () => {
      active = false;
    };
  }, [generationPresentationRequest]);

  const retryGenerationPresentation = () => {
    setGenerationPresentationRequest((request) => request + 1);
  };

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
    if (stepIndex === 4) {
      return fireworkTypes.size > 0 && (!usesBeatPrecision || fireworkTypes.has('aerial_shells'));
    }
    return true;
  }, [stepIndex, description, fireworkTypes, usesBeatPrecision]);

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
      autoBriefUploadIdRef.current !== uploadedAudio.musicAnalysisId
    ) {
      autoBriefUploadIdRef.current = uploadedAudio.musicAnalysisId;
      setStepIndex(2);
    }
  }, [audioUploadState, stepIndex, uploadedAudio]);

  useEffect(() => {
    if (
      stepIndex !== 1 ||
      audioUploadState !== 'error' ||
      !shouldFocusAudioUploadErrorRef.current
    ) {
      return;
    }
    shouldFocusAudioUploadErrorRef.current = false;
    audioUploadErrorRef.current?.focus();
  }, [audioUploadError, audioUploadState, stepIndex]);

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

  const discardUploadedAudio = (audio: UploadedAudio) => {
    void cleanupUnusedMusicAnalysis(audio).catch((error) => {
      console.error('[shows/new] unused audio cleanup failed:', error);
    });
  };

  const onFilePicked = (file: File | null) => {
    if (!file) {
      if (uploadedAudio) discardUploadedAudio(uploadedAudio);
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
    if (uploadedAudio) discardUploadedAudio(uploadedAudio);
    // Nothing else to type: the title comes from the track name (editable
    // later on the show page).
    if (!title.trim()) {
      const suggested = suggestTitleFromFilename(file.name);
      if (suggested) {
        setTitle(suggested);
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
    if (uploadedAudio) discardUploadedAudio(uploadedAudio);
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

    if (uploadTokenRef.current !== token) {
      await supabase.storage.from(AUDIO_BUCKET).remove([audioPath]);
      throw new Error('Audio selection changed before the upload completed.');
    }

    let analysisResult: MusicAnalysisResponse;
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
      const json: unknown = await response.json();
      analysisResult = parseMusicAnalysisResponse(json, response.ok);
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
    if (uploadTokenRef.current !== token) {
      try {
        await cleanupUnusedMusicAnalysis(uploaded);
      } catch (error) {
        console.error('[shows/new] stale audio cleanup failed:', error);
      }
      throw new Error('Audio selection changed before analysis was attached.');
    }
    if (uploadTokenRef.current === token) {
      setUploadedAudio(uploaded);
      setAudioUploadState('ready');
      setAudioUploadError(null);
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
    if (stepIndex < STEPS.length - 1) {
      goToStep(stepIndex + 1);
    }
  };

  /** Enter advances the flow from anywhere except textareas and buttons. */
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement) return;
    if (
      target instanceof HTMLInputElement &&
      (target.type === 'radio' || target.type === 'checkbox' || target.type === 'file')
    ) {
      return;
    }
    if (target.closest('button')) return;
    e.preventDefault();
    if (stepIndex < STEPS.length - 1) goToStep(stepIndex + 1);
  };

  // Prefetch the generating route while the user is on the final step so the
  // splash swap on Generate has its loading state cached and appears instantly.
  useEffect(() => {
    if (stepIndex !== STEPS.length - 1) return;
    const candidateTitle =
      title.trim() ||
      suggestTitleFromFilename(audioFile?.name ?? '') ||
      deriveTitleFromDescription(description) ||
      'Untitled show';
    router.prefetch(`/shows/${slugifyTitle(candidateTitle)}/generating`);
  }, [stepIndex, title, audioFile, description, router]);

  /**
   * Detached runner for the post-navigation generation work. Deliberately NOT
   * React's startTransition: an async React transition here entangles with the
   * router.push() transition dispatched in the same tick, so the wizard sat
   * frozen until createShowAction resolved before the generating splash could
   * appear. Running the work outside any transition lets the navigation commit
   * immediately while the server action continues in the background.
   */
  const startTransition = (work: () => Promise<void>) => {
    void work();
  };

  /** Click handler for the Generate button. Derives the title, navigates to
   * the generating splash immediately, awaits any pending upload, then submits
   * the show via the server action. */
  const triggerGenerate = () => {
    if (measuredWidthError) {
      toast.error('Check the measured width', { description: measuredWidthError });
      document.getElementById('measured-site-width')?.focus();
      return;
    }
    if (!generationPresentation) {
      toast.error('Generation options are not ready', {
        description:
          generationPresentationError ?? 'Wait a moment, then try generating the show again.',
      });
      if (generationPresentationError) retryGenerationPresentation();
      return;
    }
    // No manual title entry anywhere: track name first, then the brief.
    const finalTitle =
      title.trim() ||
      suggestTitleFromFilename(audioFile?.name ?? '') ||
      deriveTitleFromDescription(description) ||
      'Untitled show';
    if (finalTitle !== title) {
      setTitle(finalTitle);
    }
    setIsLaunching(true);
    // Navigate to the generating route immediately so the URL and splash swap
    // happens on click, not after the server action returns. If the server
    // needs to suffix the slug, the stored start time is copied across below.
    const desiredSlug = slugifyTitle(finalTitle);
    const titleParam = encodeURIComponent(finalTitle);
    const generationStartedAt = persistGenerationStartedAt(desiredSlug);
    const generationCover = resolvePersistedGenerationCover(desiredSlug);
    // Show the client-side splash overlay right away; the route's own splash
    // resumes the same persisted progress once it streams in.
    const hasAudio = Boolean(audioFile);
    setLaunch({ slug: desiredSlug, title: finalTitle, hasAudio });
    // `a=1` carries the soundtrack flag so the route's provisional splash
    // renders the same stage list as this overlay: no stage-row swap mid-run.
    router.push(
      `/shows/${desiredSlug}/generating?creating=1&t=${titleParam}${hasAudio ? '&a=1' : ''}`,
    );
    const returnToSoundtrackUploadError = (message: string) => {
      shouldFocusAudioUploadErrorRef.current = true;
      setAudioUploadState('error');
      setAudioUploadError(message);
      setStepIndex(1);
      setIsLaunching(false);
      setLaunch(null);
      clearPersistedGenerationStart(desiredSlug);
      router.replace('/shows/new');
      toast.error('Could not upload track', { description: message });
    };
    startTransition(async () => {
      let finalUploadedAudio = uploadedAudio;
      if (audioFile && !finalUploadedAudio && uploadPromiseRef.current) {
        try {
          finalUploadedAudio = await uploadPromiseRef.current;
        } catch (error) {
          returnToSoundtrackUploadError(
            error instanceof Error ? error.message : 'Try replacing the audio file.',
          );
          return;
        }
      }
      if (audioFile && audioUploadState === 'error') {
        returnToSoundtrackUploadError(audioUploadError ?? 'Try replacing the audio file.');
        return;
      }

      const data = new FormData();
      data.set('budget', String(budget ?? 1000));
      data.set('duration', durationValue);
      data.set('timeOfDay', 'Night');
      data.set('title', finalTitle);
      data.set('description', description);
      data.set('showStyle', styleKey);
      data.set('expectedGenerationMode', generationPresentation.generationMode);
      if (
        !usesBeatPrecision &&
        generationPresentation.generationMode === 'llm' &&
        selectedCueModel
      ) {
        data.set('selectedCueModel', selectedCueModel);
      }
      data.set('siteWidthFeet', String(effectiveWidthFeet));
      data.set('desiredSlug', desiredSlug);
      data.set('coverShader', JSON.stringify(generationCover));
      fireworkTypes.forEach((type) => data.append('fireworkTypes', type));
      if (finalUploadedAudio) {
        data.set('audioPath', finalUploadedAudio.audioPath);
        data.set('musicAnalysisId', finalUploadedAudio.musicAnalysisId);
      }

      const result = await createShowAction(data);
      if (!result.ok) {
        if (finalUploadedAudio) {
          try {
            await cleanupUnusedMusicAnalysis(finalUploadedAudio);
          } catch (error) {
            console.error('[shows/new] failed generation audio cleanup failed:', error);
          }
        }
        setIsLaunching(false);
        setLaunch(null);
        clearPersistedGenerationStart(desiredSlug);
        retryGenerationPresentation();
        router.replace('/shows/new');
        toast.error(result.error);
        return;
      }
      // Collision: the server assigned a suffixed slug. Redirect to the real
      // one so the route stops waiting on a row that will never appear.
      if (result.slug !== desiredSlug) {
        persistGenerationStartedAt(result.slug, generationStartedAt);
        copyPersistedGenerationCover(desiredSlug, result.slug);
        clearPersistedGenerationStart(desiredSlug);
        clearPersistedGenerationCover(desiredSlug);
        router.replace(`/shows/${result.slug}/generating`);
      } else {
        // Strip the provisional `creating=1` params: the row now exists and is
        // ours, and the completed handover only engages on the clean URL (a
        // completed show under `creating=1` is treated as a slug collision).
        router.replace(`/shows/${result.slug}/generating`);
      }
    });
  };

  /**
   * Move the flow to `nextIndex`. Going backward is always allowed; going
   * forward requires the current step to be valid (otherwise toast).
   */
  const goToStep = (nextIndex: number) => {
    if (nextIndex <= stepIndex) {
      setStepIndex(nextIndex);
      return;
    }
    if (!stepValid) {
      toast.error(
        stepIndex === 4 && usesBeatPrecision
          ? 'Beat precision needs Aerial shells selected.'
          : 'Describe the show first - a sentence is plenty.',
      );
      return;
    }
    setStepIndex(nextIndex);
  };

  const activeStep = STEPS[stepIndex];
  const isFinalStep = stepIndex === STEPS.length - 1;

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className={cn(
        'new-show-wizard-screen relative -mx-6 -mt-6 flex flex-1 sm:-mx-8 lg:-mx-10',
        // While the launch splash is up, cancel all of the app main's bottom
        // padding (the form's overflow-hidden would clip any overlay that
        // tried to extend past it) so the splash reaches the true bottom edge
        // and matches the /generating route splash exactly: no height jump
        // when the route streams in.
        launch ? '-mb-10 sm:-mb-12' : '-mb-6',
      )}
    >
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
                {/* Mirrors the home-page PromptHero panel sizing so the wizard's
                      describe step feels like a continuation of it. */}
                <div className="mx-auto w-full max-w-3xl">
                  <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-elevated)]/55 shadow-xs backdrop-blur-md">
                    <label htmlFor="show-description" className="sr-only">
                      Creative brief
                    </label>
                    <span id="show-description-hint" className="sr-only">
                      Describe the mood, colours, pacing, and key moments you want in the show.
                    </span>
                    <Textarea
                      id="show-description"
                      name="description"
                      rows={2}
                      autoFocus
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      aria-describedby="show-description-hint"
                      placeholder="Describe your show, or hit the dice to randomise."
                      className="h-28 resize-none rounded-none border-0 bg-transparent p-4 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0"
                    />
                    <div className="bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-bg-default)_24%,transparent)_100%)] px-4 pt-2 pb-3">
                      <div className="flex items-center justify-between gap-3">
                        {generationPresentation ? (
                          usesBeatPrecision ? (
                            <span
                              className="border-border bg-background/80 text-foreground inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2 text-[13px] shadow-sm backdrop-blur-xl"
                              aria-label={`Beat precision planner, ${generationPresentation.fastCreditCost} AI credit${generationPresentation.fastCreditCost === 1 ? '' : 's'}`}
                            >
                              <Waves size={14} aria-hidden="true" />
                              <span className="truncate font-medium">Beat precision</span>
                              <span className="bg-muted text-muted-foreground inline-flex h-[1.125rem] min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] leading-none font-medium tabular-nums">
                                {generationPresentation.fastCreditCost}
                              </span>
                            </span>
                          ) : generationPresentation.generationMode === 'llm' ? (
                            <CueModelSelect
                              value={effectiveCueModel}
                              onChange={setSelectedCueModel}
                              creditCosts={generationPresentation.modelCreditCosts}
                              className="min-w-0 flex-1 sm:max-w-[164px]"
                            />
                          ) : (
                            <span
                              className="border-border bg-background/80 text-foreground inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border px-2 text-[13px] shadow-sm backdrop-blur-xl"
                              aria-label={`Fast planner, ${generationPresentation.fastCreditCost} AI credit${generationPresentation.fastCreditCost === 1 ? '' : 's'}`}
                            >
                              <Zap size={14} aria-hidden="true" />
                              <span className="truncate font-medium">Fast planner</span>
                              <span className="bg-muted text-muted-foreground inline-flex h-[1.125rem] min-w-5 items-center justify-center rounded-md px-1.5 text-[10px] leading-none font-medium tabular-nums">
                                {generationPresentation.fastCreditCost}
                              </span>
                            </span>
                          )
                        ) : generationPresentationError ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={retryGenerationPresentation}
                            className="h-7 rounded-full px-2 text-xs"
                          >
                            <RotateCcw size={13} aria-hidden="true" />
                            Retry options
                          </Button>
                        ) : (
                          <Skeleton className="h-7 w-40 rounded-full" />
                        )}
                        <div className="flex shrink-0 items-center gap-2.5">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={rollDice}
                            aria-label="Randomise the brief"
                            title="Randomise the brief"
                            className="h-9 w-9 rounded-full px-0"
                          >
                            <Dices size={16} />
                          </Button>
                          <Button
                            type="button"
                            onClick={() => goToStep(stepIndex + 1)}
                            disabled={mounted && !stepValid}
                            className="h-9 rounded-full px-4 text-sm"
                          >
                            Continue
                            <ArrowRight size={15} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <fieldset className="mt-4">
                    <legend className="sr-only">Show style</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {SHOW_STYLE_LIST.map((style) => {
                        const selected = style.key === styleKey;
                        return (
                          <label
                            key={style.key}
                            title={style.description}
                            className={cn(
                              'has-[input:focus-visible]:ring-ring/50 min-w-0 cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] has-[input:focus-visible]:ring-3',
                              selected
                                ? 'border-foreground/55 text-foreground bg-[color:var(--accent)] shadow-sm'
                                : 'border-border bg-card/70 text-muted-foreground hover:border-foreground/25 hover:bg-[color:color-mix(in_srgb,var(--accent)_60%,transparent)]',
                            )}
                          >
                            <input
                              type="radio"
                              name="showStyle"
                              value={style.key}
                              checked={selected}
                              onChange={() => setStyleKey(style.key)}
                              aria-label={`${style.name}: ${style.description}`}
                              className="sr-only"
                            />
                            <span className="text-foreground block truncate text-xs font-semibold">
                              {style.name}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4">
                              {style.tagline}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </StepPanel>

              <StepPanel active={stepIndex === 1}>
                <div className="mx-auto w-full max-w-3xl space-y-4">
                  <div
                    ref={audioUploadErrorRef}
                    tabIndex={-1}
                    aria-label={
                      audioUploadState === 'error'
                        ? `Track upload error: ${audioUploadError ?? 'Upload failed'}`
                        : undefined
                    }
                    className={cn(
                      'rounded-xl focus:outline-none focus-visible:ring-3 focus-visible:ring-[color:var(--color-status-danger)]/35',
                      soundtrackMode === 'none' && 'opacity-50',
                    )}
                  >
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
                    aria-label="Continue without a soundtrack"
                    onClick={chooseNoSoundtrack}
                    className={cn(
                      'focus-visible:ring-ring/50 relative flex w-full items-center gap-4 rounded-xl border-2 bg-[color:var(--color-bg-elevated)] p-4 text-left shadow-sm transition-[border-color,box-shadow,transform] focus:outline-none focus-visible:ring-3 active:scale-[0.99]',
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
                <fieldset className="space-y-4">
                  <legend className="sr-only">Show length</legend>
                  {hasSoundtrack ? (
                    <>
                      <ChoiceCard
                        type="radio"
                        name="showLength"
                        value="match"
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
                        onSelect={() => {
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
                          type="radio"
                          name="showLength"
                          value={String(option.minutes)}
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
                          onSelect={() => {
                            setLengthChoice(option.minutes);
                            goToStep(stepIndex + 1);
                          }}
                        />
                      );
                    })}
                  </div>
                </fieldset>
              </StepPanel>

              <StepPanel active={stepIndex === 3}>
                <fieldset>
                  <legend className="sr-only">Show budget</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {BUDGET_TIERS.map((tier) => (
                      <ChoiceCard
                        key={tier.value}
                        type="radio"
                        name="showBudget"
                        value={String(tier.value)}
                        selected={budget === tier.value}
                        title={tier.label}
                        hint={tier.hint}
                        description={tier.description}
                        onSelect={() => {
                          setBudget(tier.value);
                          goToStep(stepIndex + 1);
                        }}
                      />
                    ))}
                  </div>
                </fieldset>
              </StepPanel>

              <StepPanel active={stepIndex === 4}>
                <fieldset className="space-y-6">
                  <legend className="sr-only">Firework types</legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {FIREWORK_TYPE_KEYS.map((key) => {
                      const type = FIREWORK_TYPES[key];
                      return (
                        <ChoiceCard
                          key={key}
                          type="checkbox"
                          name="fireworkTypes"
                          value={key}
                          selected={fireworkTypes.has(key)}
                          title={type.label}
                          description={type.description}
                          onSelect={() => toggleFireworkType(key)}
                        />
                      );
                    })}
                  </div>
                  {usesBeatPrecision && !fireworkTypes.has('aerial_shells') ? (
                    <p className="text-muted-foreground text-center text-xs">
                      Beat precision needs Aerial shells so each burst can be timed to the music.
                    </p>
                  ) : null}
                  <div className="flex justify-center pt-2">
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
                </fieldset>
              </StepPanel>

              <StepPanel active={stepIndex === 5}>
                <div className="space-y-6">
                  <fieldset>
                    <legend className="sr-only">Site width preset</legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {WIDTH_PRESETS.map((preset) => (
                        <ChoiceCard
                          key={preset.feet}
                          type="radio"
                          name="siteWidthPreset"
                          value={String(preset.feet)}
                          selected={!hasMeasuredWidth && widthFeet === preset.feet}
                          title={preset.label}
                          description={preset.description}
                          diagram={<PositionDots count={preset.positions} />}
                          onSelect={() => {
                            setMeasuredWidth('');
                            setWidthFeet(preset.feet);
                          }}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex flex-col items-center gap-1.5 text-sm text-[color:var(--color-content-subtle)]">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <label htmlFor="measured-site-width">I&apos;ve measured</label>
                      <Input
                        id="measured-site-width"
                        name="measuredSiteWidth"
                        type="number"
                        min={5}
                        max={2000}
                        step={1}
                        inputMode="numeric"
                        value={measuredWidth}
                        onChange={(e) => setMeasuredWidth(e.target.value)}
                        placeholder="Width…"
                        invalid={Boolean(measuredWidthError)}
                        aria-describedby={
                          measuredWidthError
                            ? 'measured-site-width-hint measured-site-width-error'
                            : 'measured-site-width-hint'
                        }
                        className="h-9 w-24 text-center tabular-nums"
                      />
                      <span aria-hidden="true">ft</span>
                      {hasMeasuredWidth && !measuredWidthError ? (
                        <PositionDots count={effectivePositions} />
                      ) : null}
                    </div>
                    <p id="measured-site-width-hint" className="text-xs">
                      Enter a whole number from 5 to 2,000 ft, or choose a preset above.
                    </p>
                    {measuredWidthError ? (
                      <p
                        id="measured-site-width-error"
                        role="alert"
                        className="text-xs font-medium text-[color:var(--color-status-danger)]"
                      >
                        {measuredWidthError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-center pt-2">
                    {generationPresentationError && !generationPresentation ? (
                      <Button
                        type="button"
                        onClick={retryGenerationPresentation}
                        size="lg"
                        variant="secondary"
                        className="rounded-full px-8"
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                        Retry generation options
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={triggerGenerate}
                        disabled={
                          mounted &&
                          (isLaunching || !generationPresentation || Boolean(measuredWidthError))
                        }
                        size="lg"
                        className="rounded-full px-8"
                      >
                        <Sparkles size={16} strokeWidth={2} />
                        Generate show
                      </Button>
                    )}
                    <p className="mt-3 text-center text-xs text-[color:var(--color-content-subtle)]">
                      {generationPresentation ? (
                        <>
                          This will use {displayedGenerationCost} AI credit
                          {displayedGenerationCost === 1 ? '' : 's'} with{' '}
                          {usesBeatPrecision
                            ? "ShowCrafter's beat precision planner"
                            : generationPresentation.generationMode === 'fast'
                              ? "ShowCrafter's fast planner"
                              : selectedCueModelLabel}
                          .
                        </>
                      ) : generationPresentationError ? (
                        'Generation options could not be loaded. Retry before generating.'
                      ) : (
                        'Checking the current generation cost...'
                      )}
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
          {stepIndex === 0 ? (
            <span className="inline-block h-10 w-10" aria-hidden="true" />
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              aria-label="Back"
              className="h-10 w-10 rounded-full px-0"
            >
              <ChevronLeft size={18} strokeWidth={2} />
            </Button>
          )}
          <StepDots stepIndex={stepIndex} total={STEPS.length} />
          {stepIndex === 0 || isFinalStep ? (
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

      {/* Instant splash: covers the round trip to the /generating route so the
          swap on Generate has no visible gap. */}
      {isLaunching && launch ? (
        <LaunchOverlay slug={launch.slug} title={launch.title} hasAudio={launch.hasAudio} />
      ) : null}
    </form>
  );
}
