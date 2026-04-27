"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  CloudUpload,
  Music4,
  MapPin,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Input, Textarea } from "@/app/components/ui/Input";
import { cn } from "@/lib/cn";
import { createShowAction } from "./actions";
import { FormError } from "@/app/(marketing)/components/FormError";

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
  const [timeOfDay, setTimeOfDay] = useState<(typeof TIME_OF_DAY)[number]>(
    "Night",
  );
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
    const form = e.currentTarget;
    const data = new FormData(form);
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
      if (result && !result.ok) {
        setError(result.error);
      }
      // On success the action calls redirect(); the navigation handles the rest.
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <header>
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Step 01 / 03
        </span>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          Craft your spectacle
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-on-surface-variant">
          Let AI orchestrate the perfect synchrony between light and sound.
          Complete the setup to begin generating your fireworks choreography.
        </p>
      </header>

      <Section
        title="Name your show"
        description="A short, memorable title. This is how it will appear on your dashboard."
      >
        <Input
          name="title"
          required
          placeholder="e.g. Midnight Galaxy"
          iconLeft={<Sparkles size={16} strokeWidth={1.75} />}
          className="h-12 text-base"
        />
      </Section>

      <Section
        title="Choose a song"
        description="The foundation of your choreography. Upload high-fidelity audio or describe the mood."
        bordered
      >
        <div className="space-y-6">
          <label className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low p-10 transition-all hover:bg-surface-container">
            <CloudUpload
              size={36}
              strokeWidth={1.5}
              className="mb-4 text-primary"
            />
            <p className="font-medium text-on-surface">
              {audioFile ? audioFile.name : "Drag and drop your audio file"}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              MP3, WAV, AAC, or M4A (max 50MB)
            </p>
            <input
              className="absolute inset-0 cursor-pointer opacity-0"
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Input
            name="vibe"
            placeholder="Or describe the vibe (e.g. cinematic orchestral with a heavy climax)"
            iconLeft={<Music4 size={16} strokeWidth={1.75} />}
          />
        </div>
      </Section>

      <Section
        title="Set your preferences"
        description="Define the scale and logistics of the performance."
        bordered
      >
        <Card
          elevation="low"
          radius="md"
          className="grid grid-cols-1 gap-x-8 gap-y-10 p-8 md:grid-cols-2"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label
                htmlFor="budget"
                className="text-sm font-semibold uppercase tracking-wider text-on-surface"
              >
                Budget range
              </label>
              <span className="font-bold tabular-nums text-primary">
                ${budget.toLocaleString()}
              </span>
            </div>
            <input
              id="budget"
              type="range"
              min={50}
              max={5000}
              step={50}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] font-medium tabular-nums text-on-surface-variant">
              <span>$50</span>
              <span>$5,000</span>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="duration"
              className="text-sm font-semibold uppercase tracking-wider text-on-surface"
            >
              Duration
            </label>
            <div className="relative">
              <select
                id="duration"
                name="duration"
                defaultValue="3 minutes"
                className="h-11 w-full appearance-none rounded-md border-none bg-surface-container-highest pl-4 pr-10 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option>1 minute</option>
                <option>2 minutes</option>
                <option>3 minutes</option>
                <option>5 minutes</option>
                <option>10 minutes</option>
              </select>
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className="pointer-events-none absolute inset-y-0 right-3 my-auto text-on-surface-variant"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-on-surface">
              Time of day
            </span>
            <div className="flex rounded-full bg-surface-container-highest p-1">
              {TIME_OF_DAY.map((option) => {
                const active = option === timeOfDay;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTimeOfDay(option)}
                    className={cn(
                      "flex-1 rounded-full py-2 text-xs font-bold transition-colors",
                      active
                        ? "bg-primary text-on-primary shadow-lg"
                        : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="location"
              className="text-sm font-semibold uppercase tracking-wider text-on-surface"
            >
              Location
            </label>
            <Input
              id="location"
              name="location"
              placeholder="Search event location…"
              iconLeft={<MapPin size={16} strokeWidth={1.75} />}
            />
          </div>
        </Card>
      </Section>

      <Section
        title="Describe your show"
        description="Tell the AI about the emotional journey and key visual themes."
        bordered
      >
        <div className="space-y-6">
          <Textarea
            name="description"
            rows={6}
            placeholder="Describe the sequence, preferred colours, or specific moments in the song where you want maximum impact…"
          />
          <div className="flex flex-wrap gap-3">
            {MOOD_TAGS.map((mood) => {
              const active = activeMoods.has(mood);
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => toggleMood(mood)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-outline-variant/20 text-on-surface-variant hover:border-primary hover:text-primary",
                  )}
                >
                  {mood}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {error && (
        <div className="pt-2">
          <FormError message={error} />
        </div>
      )}

      <div className="pt-8">
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-primary-container py-5 text-lg font-extrabold uppercase tracking-widest text-on-primary-container shadow-[0_24px_60px_-20px_rgba(245,158,11,0.5)] transition-all active:scale-[0.98] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Generating…" : "Generate my show"}
          <Sparkles size={20} strokeWidth={2} />
        </button>
        <p className="mt-6 text-center text-xs font-medium tracking-wide text-on-surface-variant">
          ESTIMATED COMPUTE TIME: 45 SECONDS
        </p>
      </div>
    </form>
  );
}

type SectionProps = {
  title: string;
  description: string;
  bordered?: boolean;
  children: React.ReactNode;
};

function Section({ title, description, bordered, children }: SectionProps) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 items-start gap-8 lg:grid-cols-12",
        bordered && "border-t border-outline-variant/10 pt-12",
      )}
    >
      <div className="lg:col-span-4">
        <h2 className="mb-2 text-2xl font-semibold text-on-surface">{title}</h2>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}
