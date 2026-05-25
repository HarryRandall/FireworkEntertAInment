'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CloudUpload,
  MapPin,
  Moon,
  Music4,
  Pencil,
  Sparkles,
  Sun,
  Sunset,
  Trash2,
  Wallet,
} from 'lucide-react';
import { AppPageHeader } from '@/app/components/app/AppPageHeader';
import { ChoiceChip } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input, Textarea } from '@/app/components/ui/Input';
import { toast } from '@/app/components/ui/toast';
import { cn } from '@/lib/utils';
import { createClient as createSupabaseBrowserClient } from '@/utils/supabase/client';
import { createShowAction } from './actions';

const BUDGET_PRESETS = [250, 500, 1000, 2500, 5000] as const;
const DURATION_PRESETS = [1, 2, 3, 5, 10] as const;
const TIME_OF_DAY = [
  { value: 'Daytime', icon: Sun },
  { value: 'Dusk', icon: Sunset },
  { value: 'Night', icon: Moon },
] as const;
type TimeOfDay = (typeof TIME_OF_DAY)[number]['value'];
const MOOD_TAGS = [
  'Patriotic',
  'Romantic',
  'High energy',
  'Elegant',
  'Minimalist',
  'Grand finale focused',
];
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const AUDIO_BUCKET = 'audio';
const STEPS = [
  {
    key: 'constraints',
    label: 'Constraints',
    title: 'Set the show constraints',
    description: "Tell us the budget, length, and where it'll happen.",
  },
  {
    key: 'sound',
    label: 'Sound',
    title: 'Add a track and title',
    description: 'Pick the music you want the show choreographed to.',
  },
  {
    key: 'brief',
    label: 'Brief',
    title: 'Describe the show',
    description: 'A short brief helps us draft something close to your vision.',
  },
] as const;

type FieldError = 'location' | 'title' | null;
type AudioUploadState = 'idle' | 'uploading' | 'ready' | 'error';
type UploadedAudio = {
  audioPath: string;
  musicAnalysisId: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
};

export default function NewShowPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [budget, setBudget] = useState(2500);
  const [budgetMode, setBudgetMode] = useState<'preset' | 'custom'>('preset');
  const [customBudget, setCustomBudget] = useState('');
  const [durationMode, setDurationMode] = useState<'preset' | 'custom'>('preset');
  const [durationPreset, setDurationPreset] = useState<(typeof DURATION_PRESETS)[number]>(3);
  const [customDuration, setCustomDuration] = useState('');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('Night');
  const [stepIndex, setStepIndex] = useState(0);
  const [activeMoods, setActiveMoods] = useState<Set<string>>(new Set(['High energy']));
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioUploadState, setAudioUploadState] = useState<AudioUploadState>('idle');
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<UploadedAudio | null>(null);
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<FieldError>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPromiseRef = useRef<Promise<UploadedAudio> | null>(null);
  const uploadTokenRef = useRef(0);

  const durationValue =
    durationMode === 'custom'
      ? `${customDuration.trim()} minute${customDuration.trim() === '1' ? '' : 's'}`
      : `${durationPreset} minute${durationPreset === 1 ? '' : 's'}`;

  const stepValid = useMemo(() => {
    if (stepIndex === 0) {
      const budgetOk = budgetMode === 'preset' || !!customBudget.trim();
      const durationOk = durationMode === 'preset' || !!customDuration.trim();
      return budgetOk && durationOk && location.trim().length > 0;
    }
    if (stepIndex === 1) return title.trim().length > 0;
    return true;
  }, [stepIndex, budgetMode, customBudget, durationMode, customDuration, location, title]);

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

  // The form's submit handler is intent-only: it advances the wizard on
  // Enter and never creates a show. Generation runs ONLY when the user
  // explicitly clicks the "Generate show" button (see triggerGenerate).
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(null);
    if (stepIndex < STEPS.length - 1) {
      goToStep(stepIndex + 1);
    }
  };

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

function ProgressTrack({
  steps,
  current,
  onSelect,
}: {
  steps: readonly { key: string; label: string }[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {steps.map((step, index) => {
        const isActive = index === current;
        const isComplete = index < current;
        const isClickable = index <= current;
        return (
          <li key={step.key}>
            <button
              type="button"
              onClick={() => onSelect(index)}
              disabled={!isClickable}
              className={cn(
                'inline-flex items-center gap-2 rounded-md py-1 text-sm transition-colors',
                isActive
                  ? 'text-[color:var(--color-content-emphasis)]'
                  : isComplete
                    ? 'text-[color:var(--color-content-default)] hover:text-[color:var(--color-content-emphasis)]'
                    : 'cursor-not-allowed text-[color:var(--color-content-muted)]',
              )}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium',
                  isComplete &&
                    'border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]',
                  isActive &&
                    'border-[color:var(--color-content-emphasis)] text-[color:var(--color-content-emphasis)]',
                  !isActive &&
                    !isComplete &&
                    'border-[color:var(--color-border-default)] text-[color:var(--color-content-muted)]',
                )}
              >
                {isComplete ? <Check size={12} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="font-medium">{step.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function BudgetPicker({
  budget,
  mode,
  customValue,
  onBudgetChange,
  onModeChange,
  onCustomValueChange,
}: {
  budget: number;
  mode: 'preset' | 'custom';
  customValue: string;
  onBudgetChange: (n: number) => void;
  onModeChange: (mode: 'preset' | 'custom') => void;
  onCustomValueChange: (value: string) => void;
}) {
  const isPreset =
    mode === 'preset' && BUDGET_PRESETS.includes(budget as (typeof BUDGET_PRESETS)[number]);
  return (
    <Field
      label="Budget"
      required
      icon={<Wallet size={13} strokeWidth={1.75} />}
      trailing={
        <span className="text-sm font-semibold text-[color:var(--color-content-emphasis)] tabular-nums">
          ${budget.toLocaleString()}
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {BUDGET_PRESETS.map((preset) => (
          <ChoiceChip
            key={preset}
            selected={isPreset && budget === preset}
            onClick={() => {
              onModeChange('preset');
              onBudgetChange(preset);
            }}
          >
            ${preset.toLocaleString()}
            {preset === 5000 ? '+' : ''}
          </ChoiceChip>
        ))}
        <ChoiceChip
          selected={mode === 'custom'}
          onClick={() => {
            onModeChange('custom');
            onCustomValueChange(customValue || String(budget));
          }}
        >
          Custom
        </ChoiceChip>
      </div>
      {mode === 'custom' ? (
        <Input
          type="number"
          min={50}
          max={5000}
          step={50}
          inputMode="numeric"
          value={customValue}
          placeholder="Custom budget"
          className="mt-3"
          onChange={(e) => {
            const value = e.target.value;
            onCustomValueChange(value);
            if (value === '') return;
            const n = Number(value);
            if (Number.isFinite(n) && n >= 50) onBudgetChange(n);
          }}
        />
      ) : null}
    </Field>
  );
}

function DurationPicker({
  mode,
  preset,
  customValue,
  onModeChange,
  onPresetChange,
  onCustomValueChange,
}: {
  mode: 'preset' | 'custom';
  preset: (typeof DURATION_PRESETS)[number];
  customValue: string;
  onModeChange: (mode: 'preset' | 'custom') => void;
  onPresetChange: (minutes: (typeof DURATION_PRESETS)[number]) => void;
  onCustomValueChange: (value: string) => void;
}) {
  return (
    <Field label="Duration" required>
      <div className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map((minutes) => (
          <ChoiceChip
            key={minutes}
            selected={mode === 'preset' && preset === minutes}
            onClick={() => {
              onModeChange('preset');
              onPresetChange(minutes);
            }}
          >
            {minutes} min
          </ChoiceChip>
        ))}
        <ChoiceChip
          selected={mode === 'custom'}
          onClick={() => {
            onModeChange('custom');
            onCustomValueChange(customValue || String(preset));
          }}
        >
          Custom
        </ChoiceChip>
      </div>
      {mode === 'custom' ? (
        <Input
          type="number"
          min={1}
          max={60}
          step={1}
          inputMode="numeric"
          value={customValue}
          placeholder="Custom duration in minutes"
          className="mt-3"
          onChange={(e) => onCustomValueChange(e.target.value)}
        />
      ) : null}
    </Field>
  );
}

function AudioUpload({
  file,
  duration,
  uploadState,
  error,
  inputRef,
  onFile,
  onClear,
}: {
  file: File | null;
  duration: number | null;
  uploadState: AudioUploadState;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | null) => void;
  onClear: () => void;
}) {
  if (file) {
    const statusText =
      uploadState === 'uploading'
        ? 'Uploading track'
        : uploadState === 'error'
          ? (error ?? 'Upload failed')
          : 'Track ready';
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border p-4',
          uploadState === 'error'
            ? 'border-[color:var(--color-status-danger)]/40 bg-[color-mix(in_srgb,var(--color-status-danger)_8%,transparent)]'
            : 'border-[color:var(--color-status-success)]/40 bg-[color-mix(in_srgb,var(--color-status-success)_8%,transparent)]',
        )}
      >
        <span
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color:var(--color-bg-default)]',
            uploadState === 'error'
              ? 'text-[color:var(--color-status-danger)]'
              : 'text-[color:var(--color-status-success)]',
          )}
        >
          <Music4 size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Check
              size={14}
              strokeWidth={2.5}
              className={cn(
                'shrink-0',
                uploadState === 'error'
                  ? 'text-[color:var(--color-status-danger)]'
                  : 'text-[color:var(--color-status-success)]',
              )}
            />
            <span className="truncate text-sm font-medium text-[color:var(--color-content-emphasis)]">
              {file.name}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">
            {formatBytes(file.size)}
            {duration ? ` · ${formatDuration(duration)}` : ''}
            {` · ${statusText}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            <Pencil size={13} />
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove track"
            onClick={onClear}
            className="h-8 w-8"
          >
            <Trash2 size={14} />
          </Button>
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="audio/*"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  return (
    <label className="group relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[color:var(--color-border-default)] bg-[color:var(--color-bg-subtle)]/40 p-6 text-center transition-colors hover:border-[color:var(--color-content-emphasis)]/45 hover:bg-[color:var(--color-bg-subtle)]">
      <CloudUpload
        size={28}
        strokeWidth={1.5}
        className="mb-3 text-[color:var(--color-content-subtle)]"
      />
      <span className="text-sm font-medium text-[color:var(--color-content-emphasis)]">
        Drop track or click to browse
      </span>
      <span className="mt-1 text-xs text-[color:var(--color-content-subtle)]">
        MP3, WAV, AAC, or M4A · up to 50MB
      </span>
      <input
        ref={inputRef}
        className="absolute inset-0 cursor-pointer opacity-0"
        type="file"
        accept="audio/*"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function StepPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return <section className={cn(!active && 'hidden')}>{children}</section>;
}

function Field({
  label,
  required,
  helper,
  icon,
  trailing,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <label className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-content-emphasis)]">
            {icon}
            {label}
            {required ? (
              <span aria-label="required" className="text-[color:var(--color-status-danger)]">
                *
              </span>
            ) : null}
          </label>
          {helper ? (
            <p className="mt-0.5 text-xs text-[color:var(--color-content-subtle)]">{helper}</p>
          ) : null}
        </div>
        {trailing}
      </div>
      {children}
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return <p className="text-xs text-[color:var(--color-status-danger)]">{children}</p>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sanitizeStorageName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'audio';
}

function inferAudioContentType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'mp3':
    default:
      return 'audio/mpeg';
  }
}
