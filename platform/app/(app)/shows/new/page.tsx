"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CloudUpload,
  MapPin,
  Music4,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from "lucide-react";
import { FormError } from "@/app/(marketing)/components/FormError";
import { AiGeneratedNotice } from "@/app/components/app/AiShowInsights";
import { ChoiceChip } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Textarea } from "@/app/components/ui/Input";
import { SelectField } from "@/app/components/ui/SelectField";
import { cn } from "@/lib/cn";
import { createShowAction } from "./actions";

const TIME_OF_DAY = ["Daytime", "Dusk", "Night"] as const;
const DURATION_OPTIONS = [
  { value: "1 minute", label: "1 minute" },
  { value: "2 minutes", label: "2 minutes" },
  { value: "3 minutes", label: "3 minutes" },
  { value: "5 minutes", label: "5 minutes" },
  { value: "10 minutes", label: "10 minutes" },
];
const MOOD_TAGS = [
  "Patriotic",
  "Romantic",
  "High energy",
  "Elegant",
  "Minimalist",
  "Grand finale focused",
];
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const STEPS = [
  {
    key: "constraints",
    label: "Constraints",
    eyebrow: "Start with the limits",
    title: "Set the operating window",
    description:
      "Budget, duration, time, and location shape what the generator should attempt before you pick the sound.",
  },
  {
    key: "sound",
    label: "Sound",
    eyebrow: "Pick the sound",
    title: "Choose the track and vibe",
    description:
      "Upload the audio, name the show, and capture the musical style that should drive the choreography.",
  },
  {
    key: "brief",
    label: "Brief",
    eyebrow: "Creative direction",
    title: "Describe the show you want",
    description:
      "Add the visual brief and mood tags so the draft has a clear creative target.",
  },
] as const;

export default function NewShowPage() {
  const [budget, setBudget] = useState(2500);
  const [duration, setDuration] = useState("3 minutes");
  const [timeOfDay, setTimeOfDay] = useState<(typeof TIME_OF_DAY)[number]>("Night");
  const [stepIndex, setStepIndex] = useState(0);
  const [activeMoods, setActiveMoods] = useState<Set<string>>(
    new Set(["High energy"]),
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleMood = (mood: string) => {
    setActiveMoods((prev) => {
      const next = new Set(prev);
      if (next.has(mood)) next.delete(mood);
      else next.add(mood);
      return next;
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    data.set("budget", String(budget));
    data.set("timeOfDay", timeOfDay);
    data.delete("moodTags");
    activeMoods.forEach((mood) => data.append("moodTags", mood));

    if (audioFile) {
      if (audioFile.size > MAX_AUDIO_BYTES) {
        setError("Audio file must be 50MB or smaller.");
        return;
      }
      data.set("audio", audioFile);
    } else {
      data.delete("audio");
    }

    startTransition(async () => {
      const result = await createShowAction(data);
      if (result && !result.ok) setError(result.error);
    });
  };
  const activeStep = STEPS[stepIndex];

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <header className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            New show
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
            Build the show in three phases
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Start with the practical constraints, then choose the sound and
            finish with the creative brief. The generated show lands in your
            dashboard as a draft.
          </p>
        </div>
        <Card elevation="low" radius="md" className="p-2">
          <div className="grid grid-cols-3 gap-2">
            {STEPS.map((step, index) => (
              <button
                key={step.key}
                type="button"
                onClick={() => setStepIndex(index)}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  index === stepIndex
                    ? "border-primary/55 bg-primary-container text-on-primary-container"
                    : "border-outline-variant/35 bg-surface-container-low text-on-surface-variant hover:border-primary/35 hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                <span className="block text-xs font-black">0{index + 1}</span>
                <span className="mt-1 block text-sm font-bold">{step.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </header>

      <Card elevation="high" radius="lg" className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-outline-variant/45 bg-surface-container-low p-5 lg:border-b-0 lg:border-r">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              {activeStep.eyebrow}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">
              {activeStep.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              {activeStep.description}
            </p>
            <div className="mt-6 space-y-3">
              <SummaryRow label="Budget" value={`$${budget.toLocaleString()}`} />
              <SummaryRow label="Duration" value={duration} />
              <SummaryRow label="Time" value={timeOfDay} />
              <SummaryRow label="Moods" value={`${activeMoods.size} selected`} />
            </div>
          </aside>

          <div className="p-5 sm:p-6">
            <StepPanel active={stepIndex === 0}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-outline-variant/45 bg-surface p-4 sm:col-span-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-on-surface">
                      <Wallet size={17} />
                      Budget
                    </span>
                    <span className="font-extrabold tabular-nums text-primary">
                      ${budget.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={5000}
                    step={50}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-container-highest accent-primary"
                    aria-label="Budget"
                  />
                </div>

                <LabeledField label="Duration">
                  <SelectField
                    name="duration"
                    value={duration}
                    onChange={setDuration}
                    options={DURATION_OPTIONS}
                    iconLeft={<CalendarClock size={16} />}
                  />
                </LabeledField>

                <LabeledField label="Event location">
                  <Input
                    name="location"
                    placeholder="Park, venue, or suburb"
                    iconLeft={<MapPin size={16} strokeWidth={1.75} />}
                  />
                </LabeledField>

                <div className="space-y-2 sm:col-span-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Time of day
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_OF_DAY.map((option) => (
                      <ChoiceChip
                        key={option}
                        selected={option === timeOfDay}
                        onClick={() => setTimeOfDay(option)}
                      >
                        {option}
                      </ChoiceChip>
                    ))}
                  </div>
                </div>
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 1}>
              <div className="space-y-4">
                <Input
                  name="title"
                  placeholder="Show title"
                  iconLeft={<Sparkles size={16} strokeWidth={1.75} />}
                  className="h-12 text-base font-semibold"
                />
                <label className="group relative flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-outline-variant/55 bg-surface p-6 text-center transition-colors hover:border-primary/45 hover:bg-surface-container-low">
                  <CloudUpload size={38} strokeWidth={1.5} className="mb-4 text-primary" />
                  <span className="max-w-full truncate font-bold text-on-surface">
                    {audioFile ? audioFile.name : "Upload audio"}
                  </span>
                  <span className="mt-1 text-xs text-on-surface-variant">
                    MP3, WAV, AAC, or M4A up to 50MB
                  </span>
                  <input
                    className="absolute inset-0 cursor-pointer opacity-0"
                    type="file"
                    name="audio"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <Input
                  name="vibe"
                  placeholder="Track vibe or style"
                  iconLeft={<Music4 size={16} strokeWidth={1.75} />}
                />
              </div>
            </StepPanel>

            <StepPanel active={stepIndex === 2}>
              <div className="space-y-4">
                <Textarea
                  name="description"
                  rows={10}
                  placeholder="Describe the sequence, colours, key moments, crowd reaction, and desired finale."
                />
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                    Mood tags
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_TAGS.map((mood) => {
                      const active = activeMoods.has(mood);
                      return (
                        <ChoiceChip
                          key={mood}
                          selected={active}
                          onClick={() => toggleMood(mood)}
                          className="min-h-9 px-3 py-1.5 text-xs"
                        >
                          {active ? <CheckCircle2 size={14} /> : null}
                          {mood}
                        </ChoiceChip>
                      );
                    })}
                  </div>
                </div>
              </div>
            </StepPanel>
          </div>
        </div>
      </Card>

      <AiGeneratedNotice />

      {error ? <FormError message={error} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          <Button
            type="button"
            onClick={() => setStepIndex((index) => Math.min(STEPS.length - 1, index + 1))}
            className="sm:min-w-56"
          >
            Continue
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={isPending} className="sm:min-w-72">
            Generate draft show
            <Sparkles size={19} strokeWidth={2} />
          </Button>
        )}
      </div>
    </form>
  );
}

function StepPanel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <section className={cn("space-y-5", !active && "hidden")}>
      {children}
    </section>
  );
}

function LabeledField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/35 bg-surface px-3 py-2">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        <SlidersHorizontal size={13} />
        {label}
      </span>
      <span className="truncate text-sm font-bold text-on-surface">{value}</span>
    </div>
  );
}
