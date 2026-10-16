'use client';

/** Registry controls for browser-wide renderer preferences. */
import { useEffect, useState, type MutableRefObject } from 'react';
import { SETTINGS, onSettings, setSetting, type Viewer } from '@showcrafter/renderer/view';
import { Settings2 } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { FPS_HISTORY_SIZE, FpsGraph } from '@/ui/replay/FpsGraph';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { Switch } from '@/ui/primitives/switch';

const OPTIONS = [
  ['smoke', 'Smoke'],
  ['ground', 'Ground lattice'],
  ['dusk', 'Finale dusk sky'],
  ['shake', 'Camera shake'],
  ['stats', 'Frame rate stats'],
  ['free', 'Free camera'],
] as const;

/** Keeps external settings chrome synchronised with all mounted viewers. */
export function ReplayViewerSettings() {
  const [settings, updateSettings] = useState({ ...SETTINGS });
  useEffect(() => onSettings(() => updateSettings({ ...SETTINGS })), []);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary" aria-label="Preview settings">
          <Settings2 size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-[110] w-60 gap-3 p-3">
        <span className="text-sm font-semibold">Preview settings</span>
        {OPTIONS.map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">
            {label}
            <Switch checked={settings[key]} onCheckedChange={(value) => setSetting(key, value)} />
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Readouts sample the renderer at 10 Hz without adding React work to each drawn frame.
const STATS_READOUT_INTERVAL_MS = 100;

type StatsReadout = { fps: number; samples: number[]; particles: number };

/** Displays the renderer frame-rate graph when native viewer chrome is disabled. */
export function ReplayViewerStats({ viewerRef }: { viewerRef: MutableRefObject<Viewer | null> }) {
  const [visible, setVisible] = useState(SETTINGS.stats);
  const [readout, setReadout] = useState<StatsReadout | null>(null);
  useEffect(() => onSettings(() => setVisible(SETTINGS.stats)), []);
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const instance = viewerRef.current;
      if (!instance) return;
      const fps = Math.round(instance.fps);
      setReadout((current) => ({
        fps,
        samples: [...(current?.samples ?? []).slice(-(FPS_HISTORY_SIZE - 1)), fps],
        particles: instance.count,
      }));
    };
    update();
    const timer = window.setInterval(update, STATS_READOUT_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      setReadout(null);
    };
  }, [visible, viewerRef]);
  return visible ? (
    <FpsGraph
      fps={readout?.fps ?? null}
      samples={readout?.samples ?? []}
      detail={readout ? `${readout.particles.toLocaleString()} particles` : undefined}
      onClose={() => setSetting('stats', false)}
    />
  ) : null;
}
