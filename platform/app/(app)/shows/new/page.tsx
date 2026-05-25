/**
 * The "create new show" wizard page.
 *
 * Three-step form:
 *   0. Constraints — budget, duration, location, time of day.
 *   1. Sound — title + audio upload (uploads + kicks off music analysis).
 *   2. Brief — free-text prompt + mood tag chips.
 *
 * Critical invariants enforced by the wizard tests in
 * `tests/new-show-wizard.test.mjs`:
 *   - The form's `onSubmit` only advances the wizard; it must never call
 *     `createShowAction`.
 *   - The create-show server action is invoked once, and only inside
 *     {@link triggerGenerate}, so accidental Enter-presses can't create a draft.
 *   - The audio file is uploaded directly to Supabase Storage and only the
 *     path + `musicAnalysisId` are submitted via the action.
 *
 * Step UI primitives, pickers, helper formatters, and constants are extracted
 * into `./_components/`, `./constants.ts`, and `./utils.ts` to keep this file
 * focused on orchestration.
 */
'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, Music4, Sparkles } from 'lucide-react';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { ChoiceChip } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input, Textarea } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client';
import { createShowAction } from './actions';
import { AudioUpload } from './_components/AudioUpload';
import { BudgetPicker } from './_components/BudgetPicker';
import { DurationPicker } from './_components/DurationPicker';
import { Field, FieldError } from './_components/Field';
import { ProgressTrack } from './_components/ProgressTrack';
import { StepPanel } from './_components/StepPanel';
import {
  AUDIO_BUCKET,
  DURATION_PRESETS,
  MAX_AUDIO_BYTES,
  MOOD_TAGS,
  STEPS,
  TIME_OF_DAY,
} from './constants';
import type {
  AudioUploadState,
  FieldError as FieldErrorKey,
  TimeOfDay,
  UploadedAudio,
} from './types';
import { inferAudioContentType, sanitizeStorageName } from './utils';

export default function NewShowPage() {
  const formRef = useRef<HTMLFormElement>(null);

  // === Step 0: constraints =================================================
  const [budget, setBudget] = useState(2500);
  const [budgetMode, setBudgetMode] = useState<'preset' | 'custom'>('preset');
  const [customBudget, setCustomBudget] = useState('');
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');
  const [durationPreset, setDurationPreset] = useState<(typeof DURATION_PRESETS)[number]>(3);
  const [customDuration, setCustomDuration] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('Night');
  const [location, setLocation] = useState('');

  // === Step 1: sound =======================================================
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUploadState, setAudioUploadState] = useState<AudioUploadState>('idle');
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<UploadedAudio | null>(null);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Promise of the in-flight upload so `triggerGenerate` can await it if the
  // user clicks Generate before the upload finishes.
  const uploadPromiseRef = useRef<Promise<UploadedAudio> | null>(null);
  // Monotonic token: lets late upload responses ignore themselves if the user
  // has already attached a different file.
  const uploadTokenRef = useRef(0);

  // === Step 2: brief =======================================================
  const [activeMoods, setActiveMoods] = useState<Set<string>>(new Set(['High energy']));
  const [description, setDescription] = useState('');

  // === Wizard nav ==========================================================
  const [stepIndex, setStepIndex] = useState(0);
  const [fieldError, setFieldError] = useState<FieldErrorKey>(null);
  const [isPending, startTransition] = useTransition();

  const durationValue =
    durationMode === 'custom'
      ? `${customDuration.trim()} minute${customDuration.trim() === '1' ? '' : 's'}`
      : `${durationPreset} minute${durationPreset === 1 ? '' : 's'}`;

  /** True when the user can advance past the current step. */
  const stepValid = useMemo(() => {
    if (stepIndex === 0) {
      const budgetOk = budgetMode === 'preset' || !!customBudget.trim();
      const durationOk = durationMode === 'preset' || !!customDuration.trim();
      return budgetOk && durationOk && location.trim().length > 0;
    }
    if (stepIndex === 1) return title.trim().length > 0;
    return true;
  }, [stepIndex, budgetMode, customBudget, durationMode, customDuration, location, title]);

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

  const toggleMood = (mood: string) => {
    setActiveMoods((prev) => {
      const next = new Set(prev);
      if (next.has(mood)) next.delete(mood);
      else next.add(mood);
      return next;
    });
  };

  const onFilePicked = (file: File | null) => {
    if (!file) {
      setAudioFile(null);
      setUploadedAudio(null);
      setAudioUploadState('idle');
      setAudioUploadError(null);
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    }
    return uploaded;
  };

  /**
   * The form's submit handler is intent-only: it advances the wizard on
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

  /** Click handler for the Generate button. Guards required fields, awaits
   * any pending upload, then submits the show via the server action. */
  const triggerGenerate = () => {
    setFieldError(null);
    if (!title.trim()) {
      setFieldError('title');
      setStepIndex(1);
      toast.error('Show title is required.');
      return;
    }
    startTransition(async () => {
      let finalUploadedAudio = uploadedAudio;
      if (audioFile && !finalUploadedAudio && uploadPromiseRef.current) {
        try {
          finalUploadedAudio = await uploadPromiseRef.current;
        } catch (error) {
          toast.error('Could not upload track', {
            description: error instanceof Error ? error.message : 'Try replacing the audio file.',
          });
          return;
        }
      }
      if (audioFile && audioUploadState === 'error') {
        toast.error('Could not upload track', {
          description: audioUploadError ?? 'Try replacing the audio file.',
        });
        return;
      }

      const data = new FormData();
      data.set('budget', String(budget));
      data.set('duration', durationValue);
      data.set('timeOfDay', timeOfDay);
      data.set('location', location.trim());
      data.set('title', title.trim());
      data.set('description', description);
      const vibeInput = formRef.current?.elements.namedItem('vibe');
      if (vibeInput instanceof HTMLInputElement) data.set('vibe', vibeInput.value);
      activeMoods.forEach((mood) => data.append('moodTags', mood));
      if (finalUploadedAudio) {
        data.set('audioPath', finalUploadedAudio.audioPath);
        data.set('musicAnalysisId', finalUploadedAudio.musicAnalysisId);
      }

      const result = await createShowAction(data);
      if (result && !result.ok) toast.error(result.error);
    });
  };

  /**
   * Move the wizard to `nextIndex`. Going backward is always allowed; going
   * forward requires the current step to be valid (otherwise we set
   * `fieldError` and toast).
   */
  const goToStep = (nextIndex: number) => {
    if (nextIndex <= stepIndex) {
      setFieldError(null);
      setStepIndex(nextIndex);
      return;
    }
    if (!stepValid) {
      if (stepIndex === 0 && !location.trim()) {
        setFieldError('location');
        toast.error('Event location is required.');
      } else if (stepIndex === 1 && !title.trim()) {
        setFieldError('title');
        toast.error('Show title is required.');
      } else {
        toast.error('Complete the required fields to continue.');
      }
      return;
    }
    setFieldError(null);
    setStepIndex(nextIndex);
  };

  const activeStep = STEPS[stepIndex];

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-6">
      <AppPageHeader
        title="Create a new show"
        description="Three quick steps to save the brief, music, and constraints."
      />

      <div className="mx-auto max-w-3xl">
        <Card radius="lg" className="overflow-hidden">
          <div className="border-b border-[color:var(--color-border-subtle)] px-5 py-4 sm:px-6">
            <ProgressTrack steps={STEPS} current={stepIndex} onSelect={goToStep} />
            <div className="mt-5">
              <h2 className="text-base font-semibold tracking-tight text-[color:var(--color-content-emphasis)]">
                {activeStep.title}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--color-content-subtle)]">
                {activeStep.description}
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <StepPanel active={stepIndex === 0}>
              <div className="space-y-6">
                <BudgetPicker
                  budget={budget}
                  mode={budgetMode}
                  customValue={customBudget}
                  onBudgetChange={setBudget}
                  onModeChange={setBudgetMode}
                  onCustomValueChange={setCustomBudget}
                />

                <DurationPicker
                  mode={durationMode}
                  preset={durationPreset}
                  customValue={customDuration}
                  onModeChange={setDurationMode}
                  onPresetChange={setDurationPreset}
                  onCustomValueChange={setCustomDuration}
                />

                <Field label="Event location" required helper="Where the show will be fired.">
                  <Input
                    name="location"
                    value={location}
                    invalid={fieldError === 'location'}
                    placeholder="Park, venue, or suburb"
                    iconLeft={<MapPin size={16} strokeWidth={1.75} />}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      if (fieldError === 'location') setFieldError(null);
                    }}
                  />
                  {fieldError === 'location' ? (
                    <FieldError>Event location is required.</FieldError>
                  ) : null}
                </Field>

                <Field label="Time of day" required>
                  <div className="flex flex-wrap gap-2">
                    {TIME_OF_DAY.map(({ value, icon: Icon }) => (
                      <ChoiceChip
                        key={value}
                        selected={value === timeOfDay}
                        onClick={() => setTimeOfDay(value)}
                      >
                        <Icon size={13} strokeWidth={1.75} />
                        {value}
                      </ChoiceChip>
                    ))}
                  </div>
                </Field>
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 1}>
              <div className="space-y-6">
                <Field label="Show title" required helper="A working title — you can rename later.">
                  <Input
                    name="title"
                    value={title}
                    invalid={fieldError === 'title'}
                    placeholder="e.g. New Year's Eve at Bondi"
                    iconLeft={<Sparkles size={16} strokeWidth={1.75} />}
                    className="h-11"
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (fieldError === 'title') setFieldError(null);
                    }}
                  />
                  {fieldError === 'title' ? <FieldError>Show title is required.</FieldError> : null}
                </Field>

                <Field label="Audio track" helper="Optional — drives the choreography if added.">
                  <AudioUpload
                    file={audioFile}
                    duration={audioDuration}
                    uploadState={audioUploadState}
                    error={audioUploadError}
                    inputRef={fileInputRef}
                    onFile={onFilePicked}
                    onClear={clearAudio}
                  />
                </Field>

                <Field
                  label="Track vibe"
                  helper="Optional — a word or two about the energy or style."
                >
                  <Input
                    name="vibe"
                    placeholder="e.g. cinematic build into a euphoric drop"
                    iconLeft={<Music4 size={16} strokeWidth={1.75} />}
                  />
                </Field>
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 2}>
              <div className="space-y-6">
                <Field
                  label="Custom prompt for the AI"
                  helper="This is sent verbatim to the choreography model. Be specific about colours, pacing, key moments, and the finale."
                >
                  <Textarea
                    name="description"
                    rows={8}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Slow elegant opening with single white shells, gradual build through the first chorus, dense red/gold climax on the final drop, finish with a crackling palm finale."
                  />
                  <div className="mt-1 text-right text-xs text-[color:var(--color-content-muted)]">
                    {description.length} chars
                  </div>
                </Field>

                <Field label="Mood tags" helper="Pick any that fit — guides the AI's tone.">
                  <div className="flex flex-wrap gap-2">
                    {MOOD_TAGS.map((mood) => {
                      const active = activeMoods.has(mood);
                      return (
                        <ChoiceChip key={mood} selected={active} onClick={() => toggleMood(mood)}>
                          {active ? <Check size={12} strokeWidth={2.5} /> : null}
                          {mood}
                        </ChoiceChip>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </StepPanel>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[color:var(--color-border-subtle)] px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              disabled={stepIndex === 0}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button type="button" onClick={() => goToStep(stepIndex + 1)} disabled={!stepValid}>
                Continue
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={triggerGenerate}
                loading={isPending}
                disabled={!title.trim()}
              >
                Generate show
                <Sparkles size={16} strokeWidth={2} />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
