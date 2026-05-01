"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  ChevronDown,
  CloudUpload,
  MapPin,
  Music4,
  Sparkles,
  Wallet,
} from "lucide-react";
import { FormError } from "@/app/(marketing)/components/FormError";
import { AiGeneratedNotice } from "@/app/components/app/AiShowInsights";
import { Input, Textarea } from "@/app/components/ui/Input";
import { cn } from "@/lib/cn";
import { createShowAction } from "./actions";

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

export default function NewShowPage() {
  const [budget, setBudget] = useState(2500);
  const [timeOfDay, setTimeOfDay] = useState<(typeof TIME_OF_DAY)[number]>("Night");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <header className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            New show
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
            Build the brief in three steps
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Upload the track, describe the creative direction, then set the
            operating constraints. The generated show lands in your dashboard as
            a draft.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-2">
          {["Sound", "Brief", "Limits"].map((step, index) => (
            <div key={step} className="rounded-xl bg-surface-container-high px-3 py-4 text-center">
              <span className="block text-xs font-black text-primary">0{index + 1}</span>
              <span className="mt-1 block text-xs font-bold text-on-surface">{step}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <StepPanel number="01" title="Sound">
          <Input
            name="title"
            required
            placeholder="Show title"
            iconLeft={<Sparkles size={16} strokeWidth={1.75} />}
            className="h-12 text-base"
          />
          <label className="group relative flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low p-6 text-center transition-colors hover:bg-surface-container">
            <CloudUpload size={34} strokeWidth={1.5} className="mb-4 text-primary" />
            <span className="font-bold text-on-surface">
              {audioFile ? audioFile.name : "Upload audio"}
            </span>
            <span className="mt-1 text-xs text-on-surface-variant">
              MP3, WAV, AAC, or M4A up to 50MB
            </span>
            <input
              className="absolute inset-0 cursor-pointer opacity-0"
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Input
            name="vibe"
            placeholder="Track vibe or style"
            iconLeft={<Music4 size={16} strokeWidth={1.75} />}
          />
        </StepPanel>

        <StepPanel number="02" title="Creative brief">
          <Textarea
            name="description"
            rows={9}
            placeholder="Describe the sequence, colours, key moments, and desired finale."
          />
          <div className="flex flex-wrap gap-2">
            {MOOD_TAGS.map((mood) => {
              const active = activeMoods.has(mood);
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => toggleMood(mood)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-outline-variant/20 text-on-surface-variant hover:text-primary",
                  )}
                >
                  {mood}
                </button>
              );
            })}
          </div>
        </StepPanel>

        <StepPanel number="03" title="Constraints">
          <div className="space-y-4 rounded-xl bg-surface-container-low p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-on-surface">
                <Wallet size={16} />
                Budget
              </span>
              <span className="font-bold tabular-nums text-primary">
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
              className="w-full accent-primary"
            />
          </div>

          <label className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Duration
            </span>
            <span className="relative block">
              <select
                name="duration"
                defaultValue="3 minutes"
                className="h-12 w-full appearance-none rounded-md bg-surface-container-highest pl-4 pr-10 text-on-surface outline-none ring-primary/20 focus:ring-2"
              >
                <option>1 minute</option>
                <option>2 minutes</option>
                <option>3 minutes</option>
                <option>5 minutes</option>
                <option>10 minutes</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
            </span>
          </label>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              Time of day
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-container-highest p-1">
              {TIME_OF_DAY.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTimeOfDay(option)}
                  className={cn(
                    "rounded-full py-2 text-xs font-bold transition-colors",
                    option === timeOfDay
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <Input
            name="location"
            placeholder="Event location"
            iconLeft={<MapPin size={16} strokeWidth={1.75} />}
          />
        </StepPanel>
      </div>

      <AiGeneratedNotice />

      {error ? <FormError message={error} /> : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-primary-container text-base font-extrabold text-on-primary-container shadow-[var(--shadow-cta)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Generating..." : "Generate draft show"}
        <Sparkles size={19} strokeWidth={2} />
      </button>
    </form>
  );
}

function StepPanel({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 rounded-2xl border border-outline-variant/15 bg-surface-container-high p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
          {number}
        </span>
        <h2 className="text-xl font-bold text-on-surface">{title}</h2>
      </div>
      {children}
    </section>
  );
}
