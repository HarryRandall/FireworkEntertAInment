'use client';

/** Registry controls for browser-wide renderer preferences. */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { SETTINGS, onSettings, setSetting, type Viewer } from '@showcrafter/renderer/view';
import { Settings2 } from 'lucide-react';
import { Button } from '@/ui/patterns/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/primitives/popover';
import { Switch } from '@/ui/primitives/switch';

const OPTIONS = [
  ['smoke', 'Smoke'],
  ['ground', 'Ground lattice'],
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

/** Displays renderer statistics when native viewer chrome is disabled. */
export function ReplayViewerStats({ viewerRef }: { viewerRef: MutableRefObject<Viewer | null> }) {
  const [visible, setVisible] = useState(SETTINGS.stats);
  const readout = useRef<HTMLSpanElement>(null);
  useEffect(() => onSettings(() => setVisible(SETTINGS.stats)), []);
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const instance = viewerRef.current;
      if (readout.current && instance)
        readout.current.textContent = `${Math.round(instance.fps)} fps · ${instance.count} particles`;
    };
    update();
    const timer = window.setInterval(update, STATS_READOUT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [visible, viewerRef]);
  return visible ? (
    <span
      ref={readout}
      className="bg-card/90 text-foreground pointer-events-none absolute top-3 left-3 rounded-md px-2 py-1 text-xs tabular-nums"
    />
  ) : null;
}
