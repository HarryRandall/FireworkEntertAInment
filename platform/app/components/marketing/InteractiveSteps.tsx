'use client';

/**
 * InteractiveSteps — three-step "how it works" marketing section on
 * the public landing page. Each step pairs a description with an
 * animated visual that reacts to which step is currently selected.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Music4, Sliders, Sparkles } from 'lucide-react';
import { Container } from '@/app/components/ui/Container';
import { Reveal } from './Reveal';
import { cn } from '@/lib/utils';

type Step = {
  num: string;
  title: string;
  description: string;
  Icon: typeof Music4;
  Visual: () => ReactNode;
};

const STEPS: Step[] = [
  {
    num: '01',
    title: 'Choose your song',
    description:
      'Upload any track or paste a Spotify link. Our analyser finds the BPM, key drops, and frequency peaks in seconds.',
    Icon: Music4,
    Visual: SongVisual,
  },
  {
    num: '02',
    title: 'Set your preferences',
    description:
      'Pick a budget, your local vendor, and the vibe — calm and elegant, hard-hitting finale, family-friendly. We do the rest.',
    Icon: Sliders,
    Visual: PreferencesVisual,
  },
  {
    num: '03',
    title: 'Get your show',
    description:
      'A 3D preview, a printable firing script, and a one-click shopping list — every shell mapped to a real product on a real shelf.',
    Icon: Sparkles,
    Visual: ShowVisual,
  },
];

export function InteractiveSteps() {
  return (
    <section id="how-it-works" className="bg-surface-container-low relative py-24 lg:py-32">
      <Container>
        <Reveal className="mb-16 max-w-2xl space-y-3 md:mb-20">
          <span className="text-primary block text-xs font-bold tracking-[0.2em] uppercase">
            Workflow
          </span>
          <h2 className="text-on-surface text-4xl font-bold tracking-tight md:text-6xl">
            From a song to the sky{' '}
            <span className="from-primary-fixed via-primary to-primary-container bg-gradient-to-br bg-clip-text text-transparent">
              in three steps.
            </span>
          </h2>
          <p className="text-on-surface-variant text-lg">
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
                    reverse ? 'md:flex-row-reverse' : ''
                  }`}
                >
                  {/* Copy */}
                  <div className="flex-1 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/15 text-primary ring-primary/25 flex h-12 w-12 items-center justify-center rounded-xl ring-1">
                        <step.Icon size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-on-surface-variant/70 font-mono text-[11px] font-bold tracking-[0.2em] uppercase tabular-nums">
                        Step {step.num}
                      </span>
                    </div>
                    <h3 className="text-on-surface text-3xl leading-tight font-bold tracking-tight md:text-5xl">
                      {step.title}
                    </h3>
                    <p className="text-on-surface-variant max-w-xl text-lg leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Visual stage — surfaces follow the active theme so
                      panels and chips stay readable in light mode too. */}
                  <div className="flex-1">
                    <div className="border-outline-variant/20 from-surface-container-low via-surface-container to-surface-container-low relative aspect-[5/4] w-full overflow-hidden rounded-3xl border bg-gradient-to-br shadow-[var(--shadow-card-hover)]">
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
  viewport: { once: true, margin: '-10% 0px' },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function SongVisual() {
  // Animated waveform.
  const bars = 48;
  return (
    <motion.div {...fadeIn} className="absolute inset-0 flex flex-col p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-tertiary flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase">
          <span className="relative flex h-2 w-2">
            <span className="bg-tertiary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
            <span className="bg-tertiary relative inline-flex h-2 w-2 rounded-full" />
          </span>
          Analysing
        </div>
        <span className="text-on-surface-variant/60 font-mono text-[10px] tabular-nums">
          BPM 128 · KEY F♯m
        </span>
      </div>

      <div className="border-outline-variant/15 bg-surface-container/60 rounded-2xl border p-6 backdrop-blur-sm">
        <div className="text-on-surface-variant/70 mb-3 flex items-center justify-between text-[10px] font-bold tracking-[0.2em] uppercase">
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
                      ? 'var(--color-primary)'
                      : 'color-mix(in srgb, var(--color-primary) 35%, transparent)',
                }}
                initial={{ height: '20%' }}
                animate={{ height: [`${base * 35}%`, `${base * 100}%`, `${base * 55}%`] }}
                transition={{
                  duration: 0.8 + (i % 5) * 0.1,
                  repeat: Infinity,
                  repeatType: 'mirror',
                  ease: 'easeInOut',
                  delay: (i % 7) * 0.04,
                }}
              />
            );
          })}
        </div>
        <div className="text-on-surface-variant mt-4 flex items-center gap-3 text-[11px]">
          <div className="bg-surface-container-highest h-1 flex-1 overflow-hidden rounded-full">
            <div className="bg-tertiary h-full w-2/3 shadow-[0_0_15px_var(--color-tertiary)]" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { k: 'DROPS', v: '4' },
          { k: 'PEAKS', v: '27' },
          { k: 'BARS', v: '84' },
        ].map((s) => (
          <div
            key={s.k}
            className="border-outline-variant/10 bg-surface-container-highest/60 rounded-lg border px-4 py-3"
          >
            <div className="text-on-surface-variant/70 text-[9px] font-bold tracking-[0.2em] uppercase">
              {s.k}
            </div>
            <div className="text-on-surface mt-1 font-mono text-2xl font-bold tabular-nums">
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
        <span className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase">
          Your show settings
        </span>
        <span className="text-on-surface-variant/60 font-mono text-[10px] tabular-nums">
          AUSTIN, TX
        </span>
      </div>

      <div className="border-outline-variant/15 bg-surface-container/60 space-y-5 rounded-2xl border p-6 backdrop-blur-sm">
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
          <div className="text-on-surface-variant/70 mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
            Vibe
          </div>
          <div className="flex flex-wrap gap-2">
            {['Elegant', 'Hard finale', 'Family', 'Wedding', 'Stadium'].map((chip, i) => (
              <span
                key={chip}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  i === 1
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-outline-variant/20 bg-surface-container-highest/40 text-on-surface-variant',
                )}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-on-surface-variant/70 mb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
            Vendor
          </div>
          <div className="bg-surface-container-highest/60 flex items-center justify-between rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/15 text-primary flex h-8 w-8 items-center justify-center rounded-md">
                <Sparkles size={14} strokeWidth={2} />
              </div>
              <div>
                <div className="text-on-surface text-sm font-bold">ICON Pyrotechnics</div>
                <div className="text-on-surface-variant/70 text-[10px] tracking-widest uppercase">
                  342 products in stock
                </div>
              </div>
            </div>
            <div className="bg-tertiary/15 text-tertiary rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase">
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
        <span className="text-on-surface-variant/70 text-[10px] font-bold tracking-[0.2em] uppercase">
          {label}
        </span>
        <span className="text-primary font-mono text-sm font-bold tabular-nums">{valueLabel}</span>
      </div>
      <div className="bg-surface-container-highest relative h-2 rounded-full">
        <div
          className="from-primary to-primary-container absolute inset-y-0 left-0 rounded-full bg-gradient-to-r"
          style={{ width: `${pct}%`, boxShadow: '0 0 12px var(--color-primary)' }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="[&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_12px_var(--color-primary)]"
        />
      </div>
    </div>
  );
}

function ShowVisual() {
  // Stylised burst burst over a horizon.
  const bursts = [
    { x: 25, y: 30, delay: 0, color: 'var(--color-primary)', size: 90 },
    { x: 55, y: 22, delay: 0.4, color: 'var(--color-tertiary)', size: 120 },
    { x: 78, y: 35, delay: 0.8, color: 'var(--color-primary)', size: 70 },
    { x: 40, y: 50, delay: 1.2, color: 'var(--color-primary-container)', size: 100 },
    { x: 65, y: 55, delay: 1.6, color: 'var(--color-primary)', size: 60 },
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
            'radial-gradient(1px 1px at 12% 22%, #fff7, transparent 50%), radial-gradient(1px 1px at 70% 60%, #fff5, transparent 50%), radial-gradient(1px 1px at 40% 80%, #fff6, transparent 50%), radial-gradient(1px 1px at 85% 25%, #fff5, transparent 50%), radial-gradient(1px 1px at 30% 50%, #fff4, transparent 50%)',
        }}
      />

      {bursts.map((b, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 1, 0.85, 0], scale: [0.2, 1.15, 1, 0.95] }}
          transition={{
            duration: 1.6,
            delay: b.delay,
            repeat: Infinity,
            repeatDelay: 1.5,
            ease: 'easeOut',
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
      <div className="border-outline-variant/20 bg-surface-container/70 absolute top-6 left-6 rounded-xl border px-4 py-3 backdrop-blur-md">
        <div className="text-tertiary text-[10px] font-bold tracking-[0.2em] uppercase">
          Show ready
        </div>
        <div className="text-on-surface mt-1 font-mono text-2xl font-bold tabular-nums">
          184 shells
        </div>
      </div>
      <div className="border-outline-variant/20 bg-surface-container/70 absolute right-6 bottom-6 rounded-xl border px-4 py-3 backdrop-blur-md">
        <div className="text-primary text-[10px] font-bold tracking-[0.2em] uppercase">Total</div>
        <div className="text-on-surface mt-1 font-mono text-2xl font-bold tabular-nums">$742</div>
      </div>
    </motion.div>
  );
}
