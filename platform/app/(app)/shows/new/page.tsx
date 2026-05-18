"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  MapPin,
  Music4,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AppPageHeader } from "@/app/components/app/AppPageHeader";
import { ChoiceChip } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Input, Textarea } from "@/app/components/ui/Input";
import { toast } from "@/app/components/ui/toast";
import { cn } from "@/lib/utils";
import { createShowAction } from "./actions";

const BUDGET_PRESETS = [250, 500, 1000, 2500, 5000] as const;
const DURATION_PRESETS = [1, 2, 3, 5, 10] as const;
const TIME_OF_DAY = ["Daytime", "Dusk", "Night"] as const;
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
    title: "Show constraints",
    description: "Set the practical limits first.",
  },
  {
    key: "sound",
    label: "Sound",
    title: "Sound and title",
    description: "Add the track and a clear working title.",
  },
  {
    key: "brief",
    label: "Brief",
    title: "Creative brief",
    description: "Describe the show direction and mood.",
  },
] as const;

export default function NewShowPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [budget, setBudget] = useState(2500);
  const [budgetMode, setBudgetMode] = useState<"preset" | "custom">("preset");
  const [customBudget, setCustomBudget] = useState("");
  const [durationMode, setDurationMode] = useState<"preset" | "custom">("preset");
  const [durationPreset, setDurationPreset] = useState<(typeof DURATION_PRESETS)[number]>(3);
  const [customDuration, setCustomDuration] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<(typeof TIME_OF_DAY)[number]>("Night");
  const [stepIndex, setStepIndex] = useState(0);
  const [activeMoods, setActiveMoods] = useState<Set<string>>(
    new Set(["High energy"]),
  );
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [fieldError, setFieldError] = useState<"location" | "title" | null>(null);
  const [isPending, startTransition] = useTransition();
  const durationValue = durationMode === "custom"
    ? `${customDuration.trim()} minute${customDuration.trim() === "1" ? "" : "s"}`
    : `${durationPreset} minute${durationPreset === 1 ? "" : "s"}`;
  const durationSummary = durationMode === "custom" && customDuration.trim()
    ? `${customDuration.trim()} minute${customDuration.trim() === "1" ? "" : "s"}`
    : `${durationPreset} minute${durationPreset === 1 ? "" : "s"}`;

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
    setFieldError(null);
    const data = new FormData(e.currentTarget);
    data.set("budget", String(budget));
    data.set("duration", durationValue);
    data.set("timeOfDay", timeOfDay);
    data.delete("moodTags");
    activeMoods.forEach((mood) => data.append("moodTags", mood));

    const location = String(data.get("location") ?? "").trim();
    const title = String(data.get("title") ?? "").trim();
    if (budgetMode === "custom" && !customBudget.trim()) {
      toast.error("Custom budget is required before you continue.");
      setStepIndex(0);
      return;
    }
    if (durationMode === "custom" && !customDuration.trim()) {
      toast.error("Custom duration is required before you continue.");
      setStepIndex(0);
      return;
    }
    if (!location) {
      setFieldError("location");
      toast.error("Event location is required before you continue.");
      setStepIndex(0);
      return;
    }
    if (!title) {
      setFieldError("title");
      toast.error("Show title is required before you continue.");
      setStepIndex(1);
      return;
    }

    if (audioFile) {
      if (audioFile.size > MAX_AUDIO_BYTES) {
        toast.error("Audio file must be 50MB or smaller.");
        return;
      }
      data.set("audio", audioFile);
    } else {
      data.delete("audio");
    }

    startTransition(async () => {
      const result = await createShowAction(data);
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  };
  const activeStep = STEPS[stepIndex];

  const validateStep = (index: number) => {
    if (!formRef.current) return false;
    const data = new FormData(formRef.current);

    if (index >= 0) {
      if (budgetMode === "custom" && !customBudget.trim()) {
        toast.error("Custom budget is required before you continue.");
        return false;
      }
      if (durationMode === "custom" && !customDuration.trim()) {
        toast.error("Custom duration is required before you continue.");
        return false;
      }
      const location = String(data.get("location") ?? "").trim();
      if (!location) {
        setFieldError("location");
        toast.error("Event location is required before you continue.");
        return false;
      }
    }

    if (index >= 1) {
      const title = String(data.get("title") ?? "").trim();
      if (!title) {
        setFieldError("title");
        toast.error("Show title is required before you continue.");
        return false;
      }
    }

    setFieldError(null);
    return true;
  };

  const goToStep = (nextIndex: number) => {
    if (nextIndex <= stepIndex) {
      setFieldError(null);
      setStepIndex(nextIndex);
      return;
    }

    for (let index = stepIndex; index < nextIndex; index++) {
      if (!validateStep(index)) return;
    }

    setStepIndex(nextIndex);
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      className="w-full space-y-4 pb-2"
    >
      <AppPageHeader
        title={activeStep.title}
        description={activeStep.description}
      />

      <StepIndicator steps={STEPS} current={stepIndex} onSelect={goToStep} />

      <StepPanel active={stepIndex === 0}>
        <div className="grid grid-cols-1 gap-6">
          <Card elevation="low" radius="md" className="space-y-6 p-6 sm:p-8 xl:min-h-[34rem]">
            <BudgetPicker
              budget={budget}
              mode={budgetMode}
              customValue={customBudget}
              onBudgetChange={setBudget}
              onModeChange={setBudgetMode}
              onCustomValueChange={setCustomBudget}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <DurationPicker
                mode={durationMode}
                preset={durationPreset}
                customValue={customDuration}
                onModeChange={setDurationMode}
                onPresetChange={setDurationPreset}
                onCustomValueChange={setCustomDuration}
              />

              <LabeledField label="Event location">
                <Input
                  name="location"
                  required={stepIndex === 0}
                  invalid={fieldError === "location"}
                  placeholder="Park, venue, or suburb"
                  iconLeft={<MapPin size={16} strokeWidth={1.75} />}
                  onChange={() => {
                    if (fieldError === "location") setFieldError(null);
                  }}
                />
              </LabeledField>
            </div>

            <div className="space-y-2">
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
          </Card>
        </div>
      </StepPanel>

      <StepPanel active={stepIndex === 1}>
        <div className="grid grid-cols-1 gap-6 xl:items-stretch xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card elevation="low" radius="md" className="space-y-4 p-6 sm:p-8 xl:min-h-[34rem]">
            <Input
              name="title"
              required={stepIndex === 1}
              invalid={fieldError === "title"}
              placeholder="Show title"
              iconLeft={<Sparkles size={16} strokeWidth={1.75} />}
              className="h-12 text-base font-semibold"
              onChange={() => {
                if (fieldError === "title") setFieldError(null);
              }}
            />
            <label className="group relative flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/55 bg-surface-container-low/35 p-6 text-center transition-colors hover:cursor-pointer hover:border-primary/45 hover:bg-surface-container-low">
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
          </Card>

          <ConstraintsSidebar
            budget={budget}
            duration={durationSummary}
            timeOfDay={timeOfDay}
            moodsSelected={activeMoods.size}
          />
        </div>
      </StepPanel>

      <StepPanel active={stepIndex === 2}>
        <div className="grid grid-cols-1 gap-6 xl:items-stretch xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card elevation="low" radius="md" className="space-y-4 p-6 sm:p-8 xl:min-h-[34rem]">
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
          </Card>

          <ConstraintsSidebar
            budget={budget}
            duration={durationSummary}
            timeOfDay={timeOfDay}
            moodsSelected={activeMoods.size}
          />
        </div>
      </StepPanel>

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
              key="continue-step"
              type="button"
              onClick={() => goToStep(Math.min(STEPS.length - 1, stepIndex + 1))}
              className="sm:min-w-56"
            >
              Continue
              <ArrowRight size={16} />
            </Button>
          ) : (
            <Button
              key="submit-show"
              type="submit"
              size="lg"
              loading={isPending}
              className="sm:min-w-72"
            >
              Generate draft show
              <Sparkles size={19} strokeWidth={2} />
            </Button>
          )}
      </div>
    </form>
  );
}

function StepIndicator({
  steps,
  current,
  onSelect,
}: {
  steps: readonly { key: string; label: string }[];
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-4 px-1"
      aria-label="Show creation steps"
    >
      {steps.map((step, index) => {
        const isActive = index === current;
        const isComplete = index < current;
        const isUpcoming = !isActive && !isComplete;
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="contents">
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={isActive ? "step" : undefined}
              aria-label={`Step ${index + 1}: ${step.label}`}
              className={cn(
                "group flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-content-emphasis)]",
                isLast && "justify-self-end",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  isActive &&
                    "border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]",
                  isComplete &&
                    "border-[color:var(--color-content-emphasis)] bg-[color:var(--color-content-emphasis)] text-[color:var(--color-content-inverted)]",
                  isUpcoming &&
                    "border-[color:var(--color-border-default)] bg-[color:var(--color-bg-default)] text-[color:var(--color-content-muted)]",
                )}
              >
                {isComplete ? <CheckCircle2 size={14} strokeWidth={2.4} /> : index + 1}
              </span>
            </button>
            {!isLast ? (
              <span
                aria-hidden="true"
                className={cn(
                  "h-px min-w-0 rounded-full",
                  index < current
                    ? "bg-[color:var(--color-content-emphasis)]"
                    : "bg-[color:var(--color-border-subtle)]",
                )}
              />
            ) : null}
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
  mode: "preset" | "custom";
  customValue: string;
  onBudgetChange: (n: number) => void;
  onModeChange: (mode: "preset" | "custom") => void;
  onCustomValueChange: (value: string) => void;
}) {
  const isPreset = mode === "preset" && BUDGET_PRESETS.includes(budget as (typeof BUDGET_PRESETS)[number]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--color-content-emphasis)]">
          <Wallet size={16} />
          Budget
        </span>
        <span className="text-xl font-semibold tabular-nums text-[color:var(--color-content-emphasis)]">
          ${budget.toLocaleString()}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {BUDGET_PRESETS.map((preset) => (
          <ChoiceChip
            key={preset}
            selected={isPreset && budget === preset}
            onClick={() => {
              onModeChange("preset");
              onBudgetChange(preset);
            }}
          >
            ${preset.toLocaleString()}
            {preset === 5000 ? "+" : ""}
          </ChoiceChip>
        ))}
        <ChoiceChip
          selected={mode === "custom"}
          onClick={() => {
            onModeChange("custom");
            onCustomValueChange(customValue || String(budget));
          }}
        >
          Custom
        </ChoiceChip>
      </div>
      {mode === "custom" ? (
        <Input
          type="number"
          min={50}
          max={5000}
          step={50}
          inputMode="numeric"
          value={customValue}
          placeholder="Custom budget"
          onChange={(e) => {
            const value = e.target.value;
            onCustomValueChange(value);
            if (value === "") return;
            const n = Number(value);
            if (Number.isFinite(n) && n >= 50) onBudgetChange(n);
          }}
        />
      ) : null}
    </div>
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
  mode: "preset" | "custom";
  preset: (typeof DURATION_PRESETS)[number];
  customValue: string;
  onModeChange: (mode: "preset" | "custom") => void;
  onPresetChange: (minutes: (typeof DURATION_PRESETS)[number]) => void;
  onCustomValueChange: (value: string) => void;
}) {
  return (
    <LabeledField label="Duration">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((minutes) => (
            <ChoiceChip
              key={minutes}
              selected={mode === "preset" && preset === minutes}
              onClick={() => {
                onModeChange("preset");
                onPresetChange(minutes);
              }}
            >
              {minutes} minute{minutes === 1 ? "" : "s"}
            </ChoiceChip>
          ))}
          <ChoiceChip
            selected={mode === "custom"}
            onClick={() => {
              onModeChange("custom");
              onCustomValueChange(customValue || String(preset));
            }}
          >
            Custom
          </ChoiceChip>
        </div>
        {mode === "custom" ? (
          <Input
            type="number"
            min={1}
            max={60}
            step={1}
            inputMode="numeric"
            value={customValue}
            placeholder="Custom duration in minutes"
            onChange={(e) => onCustomValueChange(e.target.value)}
          />
        ) : null}
      </div>
    </LabeledField>
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

function ConstraintsSidebar({
  budget,
  duration,
  timeOfDay,
  moodsSelected,
}: {
  budget: number;
  duration: string;
  timeOfDay: string;
  moodsSelected: number;
}) {
  return (
    <Card
      elevation="low"
      radius="md"
      className="space-y-4 p-6 xl:sticky xl:top-6 xl:self-start"
    >
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
        Current setup
      </p>
      <div className="space-y-3">
        <SummaryRow label="Budget" value={`$${budget.toLocaleString()}`} />
        <SummaryRow label="Duration" value={duration} />
        <SummaryRow label="Time" value={timeOfDay} />
        <SummaryRow label="Moods" value={`${moodsSelected} selected`} />
      </div>
    </Card>
  );
}
