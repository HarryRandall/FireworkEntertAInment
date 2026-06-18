/**
 * Landing step mockups — small, static product-UI previews used as the
 * "imagery" inside the zigzag how-it-works steps. CSS/SVG recreations of
 * the real ShowCrafter screens (song, budget, choreography, shopping,
 * firing), driven by design tokens.
 */
import { Check, Music4, Play, Wand2 } from 'lucide-react';
import { EnergyWaveform, PaletteDots } from './decor';

const cardClass =
  'bg-card border-outline-variant/60 w-full rounded-2xl border shadow-[var(--shadow-card)]';

export function SongMock() {
  const bars = [0.5, 0.8, 0.35, 0.95, 0.6, 0.75, 0.45, 0.9, 0.55, 0.7, 0.4, 0.85];
  return (
    <div className={`${cardClass} p-[18px]`}>
      <div className="flex items-center gap-3.5">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#7a3df0,#e8447f_60%,#efb93f)] text-white">
          <Music4 size={22} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-on-surface text-sm font-semibold">Bohemian Rhapsody</div>
          <div className="text-on-surface-variant text-xs">Queen · uploaded</div>
        </div>
        <span className="border-outline-variant/60 text-on-surface-variant rounded-full border px-2.5 py-1 text-[11px] tabular-nums">
          BPM 128 · F&#9839;m
        </span>
      </div>
      <div className="mt-4 flex h-12 items-end gap-1">
        {bars.map((b, i) => (
          <div
            key={i}
            className="lp-eq-bar flex-1 rounded-[3px]"
            style={{
              height: `${b * 100}%`,
              background: i > 8 ? 'var(--hl)' : 'var(--color-bg-emphasis)',
              animationDelay: `${i * 0.09}s`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--hl-ink)]">
          <Check size={13} strokeWidth={2.4} /> 42 beats · 6 drops detected
        </span>
      </div>
    </div>
  );
}

function BudgetRow({ label, val, pct }: { label: string; val: string; pct: number }) {
  return (
    <div className="mt-3.5">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-on-surface-variant">{label}</span>
        <span className="text-on-surface font-semibold tabular-nums">{val}</span>
      </div>
      <div className="bg-muted relative h-2 rounded-full">
        <div
          className="bg-primary absolute inset-y-0 left-0 rounded-full"
          style={{ right: `${100 - pct}%` }}
        />
        <div
          className="bg-card border-primary absolute -top-1 h-4 w-4 rounded-full border-2 shadow-[var(--shadow-card)]"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
  );
}

export function BudgetMock() {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-baseline justify-between">
        <span className="text-on-surface text-[13px] font-semibold">Show budget</span>
        <span className="text-on-surface text-[28px] font-bold tabular-nums">$742</span>
      </div>
      <BudgetRow label="Spend cap" val="$742 / $900" pct={72} />
      <BudgetRow label="Venue size" val="Large yard" pct={58} />
      <BudgetRow label="Finale weight" val="Heavy" pct={84} />
      <div className="mt-4 flex flex-wrap gap-2">
        {['Backyard', 'Beach', 'Lake'].map((t, i) => (
          <span
            key={t}
            className="border-outline-variant/60 rounded-full border px-2.5 py-1.5 text-[11px] font-medium"
            style={
              i === 0
                ? { background: 'var(--primary)', color: 'var(--primary-foreground)' }
                : { color: 'var(--color-content-subtle)' }
            }
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChoreoMock() {
  const cues = [
    { t: '00:14', name: 'Comet rise', pal: ['#efb93f', '#fb7185'] },
    { t: '01:02', name: 'Crossette fan', pal: ['#2ec487', '#38bdf8'] },
    { t: '02:48', name: 'Willow drop', pal: ['#8f7be8', '#38bdf8'] },
    { t: '05:31', name: 'Gold finale wall', pal: ['#efb93f', '#fb7185', '#8f7be8'] },
  ];
  return (
    <div className={`${cardClass} p-[18px]`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-on-surface inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <span className="text-[var(--hl-ink)]">
            <Wand2 size={16} strokeWidth={1.8} />
          </span>{' '}
          Choreography
        </span>
        <span className="text-on-surface-variant text-[11px] tabular-nums">184 cues</span>
      </div>
      <EnergyWaveform height={34} style={{ margin: '6px 0 12px' }} />
      <div className="flex flex-col gap-1.5">
        {cues.map((c) => (
          <div key={c.t} className="bg-muted flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5">
            <span className="text-on-surface-variant w-[42px] text-[11px] tabular-nums">{c.t}</span>
            <span className="text-on-surface flex-1 text-xs font-medium">{c.name}</span>
            <PaletteDots palette={c.pal} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShopMock() {
  const items = [
    { name: 'Saturn Missile Battery', qty: '×2', price: '$58' },
    { name: '500g Gold Willow Cake', qty: '×1', price: '$129' },
    { name: 'Crossette Comet Pack', qty: '×3', price: '$84' },
  ];
  return (
    <div className={`${cardClass} p-[18px]`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-on-surface text-[13px] font-semibold">Shopping list</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--hl-ink)]">
          <span className="lp-live-dot h-1.5 w-1.5" /> In stock locally
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-2.5">
            <span className="border-outline-variant/60 h-[38px] w-[38px] flex-shrink-0 rounded-lg border bg-[repeating-linear-gradient(45deg,var(--color-bg-muted)_0_5px,var(--color-bg-subtle)_5px_10px)]" />
            <span className="text-on-surface flex-1 text-xs">{it.name}</span>
            <span className="text-on-surface-variant text-[11px] tabular-nums">{it.qty}</span>
            <span className="text-on-surface w-11 text-right text-xs font-semibold tabular-nums">
              {it.price}
            </span>
          </div>
        ))}
      </div>
      <div className="border-outline-variant/60 mt-3.5 flex items-center justify-between border-t pt-3.5">
        <span className="text-on-surface-variant text-xs">14 products · 1 stockist</span>
        <span className="text-on-surface text-base font-bold tabular-nums">$742</span>
      </div>
    </div>
  );
}

export function FireMock() {
  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[radial-gradient(120%_120%_at_50%_0%,#16161c,#09090b)] p-5">
      <div className="flex items-center justify-between text-white">
        <span className="inline-flex items-center gap-2 text-xs font-semibold">
          <span className="lp-live-dot" /> Firing live
        </span>
        <span className="text-[11px] text-white/60 tabular-nums">CUE 42 / 184</span>
      </div>
      <div className="mt-4 mb-1.5 text-center">
        <div className="text-[44px] leading-none font-bold tracking-[-0.02em] text-white tabular-nums">
          03:18
        </div>
        <div className="mt-1.5 text-xs font-semibold text-[var(--hl)]">
          NOW — light Cue 42 · Gold willow
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-[62%] rounded-full bg-[linear-gradient(90deg,var(--hl),#38bdf8)]" />
      </div>
      <div className="mt-4 flex justify-center">
        <span className="inline-flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white text-[#09090b]">
          <Play size={20} fill="currentColor" strokeWidth={0} />
        </span>
      </div>
    </div>
  );
}
