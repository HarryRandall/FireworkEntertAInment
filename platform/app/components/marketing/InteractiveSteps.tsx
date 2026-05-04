"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Music4, Sliders, Sparkles } from "lucide-react";
import { Container } from "@/app/components/ui/Container";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

type Step = {
  num: string;
  title: string;
  description: string;
  Icon: typeof Music4;
  Visual: () => ReactNode;
};

const STEPS: Step[] = [
  {
    num: "01",
    title: "Choose your song",
    description:
      "Upload any track or paste a Spotify link. Our analyser finds the BPM, key drops, and frequency peaks in seconds.",
    Icon: Music4,
    Visual: SongVisual,
  },
  {
    num: "02",
    title: "Set your preferences",
    description:
      "Pick a budget, your local vendor, and the vibe — calm and elegant, hard-hitting finale, family-friendly. We do the rest.",
    Icon: Sliders,
    Visual: PreferencesVisual,
  },
  {
    num: "03",
    title: "Get your show",
    description:
      "A 3D preview, a printable firing script, and a one-click shopping list — every shell mapped to a real product on a real shelf.",
    Icon: Sparkles,
    Visual: ShowVisual,
  },
];

export function InteractiveSteps() {
  return (
    <section
      id="how-it-works"
      className="relative bg-surface-container-low py-24 lg:py-32"
    >
      <Container>
        <Reveal className="mb-16 max-w-2xl space-y-3 md:mb-20">
          <span className="block text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Workflow
          </span>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface md:text-6xl">
            From a song to the sky{" "}
            <span className="bg-gradient-to-br from-primary-fixed via-primary to-primary-container bg-clip-text text-transparent">
              in three steps.
            </span>
          </h2>
          <p className="text-lg text-on-surface-variant">
            Three live demos — each screen below is interactive.
          </p>
        </Reveal>

        <div className="space-y-24 md:space-y-32">
          {STEPS.map((step, idx) => {
            const reverse = idx % 2 === 1;
            return (
              <Reveal key={step.num}>
                <div
                  className={`flex flex-col gap-10 md:flex-row md:items-center md:gap-16 ${
                    reverse ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Copy */}
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
                        <step.Icon size={20} strokeWidth={1.75} />
                      </div>
                      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70 tabular-nums">
                        Step {step.num}
                      </span>
                    </div>
                    <h3 className="text-3xl font-bold leading-tight tracking-tight text-on-surface md:text-5xl">
                      {step.title}
                    </h3>
                    <p className="max-w-xl text-lg leading-relaxed text-on-surface-variant">
                      {step.description}
                    </p>
                  </div>

                  {/* Visual stage — surfaces follow the active theme so
                      panels and chips stay readable in light mode too. */}
                  <div className="flex-1">
                    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-3xl border border-outline-variant/20 bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-low shadow-[var(--shadow-card-hover)]">
                      <step.Visual />
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ---------- Visuals ---------- */

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10% 0px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function SongVisual() {
  // Animated waveform.
  const bars = 48;
  return (
    <motion.div {...fadeIn} className="absolute inset-0 flex flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
          </span>
          Analysing
        </div>
        <span className="font-mono text-[10px] tabular-nums text-on-surface-variant/60">
          BPM 128 · KEY F♯m
        </span>
      </div>

      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container/60 p-6 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
          <span>Track · Midnight Symphony 04</span>
          <span className="font-mono tabular-nums">02:44 / 03:18</span>
        </div>
        <div className="flex h-32 items-end gap-[3px]">
          {Array.from({ length: bars }).map((_, i) => {
            const base = 0.3 + 0.7 * Math.abs(Math.sin((i / bars) * Math.PI * 3));
            return (
              <motion.div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  background:
                    i % 8 === 0
                      ? "var(--color-primary)"
                      : "color-mix(in srgb, var(--color-primary) 35%, transparent)",
                }}
                initial={{ height: "20%" }}
                animate={{ height: [`${base * 35}%`, `${base * 100}%`, `${base * 55}%`] }}
                transition={{
                  duration: 0.8 + (i % 5) * 0.1,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                  delay: (i % 7) * 0.04,
                }}
              />
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3 text-[11px] text-on-surface-variant">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full w-2/3 bg-tertiary shadow-[0_0_15px_var(--color-tertiary)]" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { k: "DROPS", v: "4" },
          { k: "PEAKS", v: "27" },
          { k: "BARS", v: "84" },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-lg border border-outline-variant/10 bg-surface-container-highest/60 px-4 py-3"
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
              {s.k}
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-on-surface">
              {s.v}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function PreferencesVisual() {
  const [budget, setBudget] = useState(750);
  const [intensity, setIntensity] = useState(65);
  return (
    <motion.div {...fadeIn} className="absolute inset-0 flex flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Your show settings
        </span>
        <span className="font-mono text-[10px] tabular-nums text-on-surface-variant/60">
          AUSTIN, TX
        </span>
      </div>

      <div className="space-y-5 rounded-2xl border border-outline-variant/15 bg-surface-container/60 p-6 backdrop-blur-sm">
        <SliderRow
          label="Budget"
          valueLabel={`$${budget}`}
          value={budget}
          min={150}
          max={2500}
          step={25}
          onChange={setBudget}
        />
        <SliderRow
          label="Intensity"
          valueLabel={`${intensity}%`}
          value={intensity}
          min={0}
          max={100}
          step={1}
          onChange={setIntensity}
        />

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
            Vibe
          </div>
          <div className="flex flex-wrap gap-2">
            {["Elegant", "Hard finale", "Family", "Wedding", "Stadium"].map(
              (chip, i) => (
                <span
                  key={chip}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    i === 1
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-outline-variant/20 bg-surface-container-highest/40 text-on-surface-variant",
                  )}
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
            Vendor
          </div>
          <div className="flex items-center justify-between rounded-lg bg-surface-container-highest/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Sparkles size={14} strokeWidth={2} />
              </div>
              <div>
                <div className="text-sm font-bold text-on-surface">
                  ICON Pyrotechnics
                </div>
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/70">
                  342 products in stock
                </div>
              </div>
            </div>
            <div className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-tertiary">
              Connected
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SliderRow({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/70">
          {label}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-primary">
          {valueLabel}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-container-highest">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary-container"
          style={{ width: `${pct}%`, boxShadow: "0 0 12px var(--color-primary)" }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_12px_var(--color-primary)]
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
        />
      </div>
    </div>
  );
}

function ShowVisual() {
  // Stylised burst burst over a horizon.
  const bursts = [
    { x: 25, y: 30, delay: 0, color: "var(--color-primary)", size: 90 },
    { x: 55, y: 22, delay: 0.4, color: "var(--color-tertiary)", size: 120 },
    { x: 78, y: 35, delay: 0.8, color: "var(--color-primary)", size: 70 },
    { x: 40, y: 50, delay: 1.2, color: "var(--color-primary-container)", size: 100 },
    { x: 65, y: 55, delay: 1.6, color: "var(--color-primary)", size: 60 },
  ];
  return (
    <motion.div {...fadeIn} className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_85%)]" />
      {/* Stars */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 22%, #fff7, transparent 50%), radial-gradient(1px 1px at 70% 60%, #fff5, transparent 50%), radial-gradient(1px 1px at 40% 80%, #fff6, transparent 50%), radial-gradient(1px 1px at 85% 25%, #fff5, transparent 50%), radial-gradient(1px 1px at 30% 50%, #fff4, transparent 50%)",
        }}
      />

      {bursts.map((b, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${b.x}%`, top: `${b.y}%`, transform: "translate(-50%, -50%)" }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 1, 0.85, 0], scale: [0.2, 1.15, 1, 0.95] }}
          transition={{
            duration: 1.6,
            delay: b.delay,
            repeat: Infinity,
            repeatDelay: 1.5,
            ease: "easeOut",
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: b.size,
              height: b.size,
              background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
              boxShadow: `0 0 ${b.size * 0.7}px ${b.color}`,
            }}
          />
        </motion.div>
      ))}

      {/* Skyline silhouette */}
      <svg
        aria-hidden
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[28%] w-full"
      >
        <path
          d="M0 120 V70 L30 70 L30 50 L60 50 L60 80 L90 80 L90 40 L120 40 L120 60 L160 60 L160 30 L180 30 L180 55 L220 55 L220 75 L260 75 L260 45 L290 45 L290 65 L330 65 L330 35 L360 35 L360 60 L400 60 L400 80 L440 80 L440 50 L470 50 L470 70 L510 70 L510 55 L540 55 L540 75 L600 75 L600 120 Z"
          fill="rgba(0,0,0,0.8)"
        />
      </svg>

      {/* Stat overlay */}
      <div className="absolute left-6 top-6 rounded-xl border border-outline-variant/20 bg-surface-container/70 px-4 py-3 backdrop-blur-md">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
          Show ready
        </div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-on-surface">
          184 shells
        </div>
      </div>
      <div className="absolute right-6 bottom-6 rounded-xl border border-outline-variant/20 bg-surface-container/70 px-4 py-3 backdrop-blur-md">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Total
        </div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-on-surface">
          $742
        </div>
      </div>
    </motion.div>
  );
}
