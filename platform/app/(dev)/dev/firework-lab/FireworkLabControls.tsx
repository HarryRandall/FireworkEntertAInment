'use client';

/**
 * Tabbed renderer-control panel for the dev firework lab. Every tab reuses the
 * admin `FireworkRenderControls` leaf component so the lab exposes the full
 * set of calibration controls, including the complete burst-trail surface in
 * the Trail tab. The parent owns the draft `model_json` and passes a `mutate`
 * callback that writes edits back into `renderDefaults`.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { CircleDot, Cloud, Rocket, Shapes, Sparkles, Volume2, Wind, Zap } from 'lucide-react';
import {
  FireworkRenderControls,
  supportsGeometryTuningControls,
  type JsonRecord,
} from '@/app/components/admin/FireworkRenderControls';
import type { FireworkDesign } from '@/lib/fireworks/design';
import { cn } from '@/lib/utils';

type TabId = 'star' | 'starInner' | 'trail' | 'geometry' | 'launch' | 'fx' | 'smoke' | 'sound';

type TabDef = { id: TabId; label: string; icon: ComponentType<{ size?: number }> };

const TABS: TabDef[] = [
  { id: 'star', label: 'Star', icon: Sparkles },
  { id: 'starInner', label: 'Star Inner', icon: CircleDot },
  { id: 'trail', label: 'Trail', icon: Wind },
  { id: 'geometry', label: 'Geometry', icon: Shapes },
  { id: 'launch', label: 'Launch', icon: Rocket },
  { id: 'fx', label: 'FX', icon: Zap },
  { id: 'smoke', label: 'Smoke', icon: Cloud },
  { id: 'sound', label: 'Sound', icon: Volume2 },
];

export type FireworkLabControlsProps = {
  design: FireworkDesign;
  defaults: JsonRecord;
  calibrationDefaults: JsonRecord;
  disabled?: boolean;
  mutate: (updater: (defaults: JsonRecord) => void) => void;
};

export function FireworkLabControls({
  design,
  defaults,
  calibrationDefaults,
  disabled = false,
  mutate,
}: FireworkLabControlsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('star');
  const tabs = TABS.filter(
    (tab) => tab.id !== 'geometry' || supportsGeometryTuningControls(design.geometry),
  );

  useEffect(() => {
    if (activeTab === 'geometry' && !supportsGeometryTuningControls(design.geometry)) {
      setActiveTab('star');
    }
  }, [activeTab, design.geometry]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Firework controls"
        className="border-outline-variant/15 flex shrink-0 flex-wrap gap-1 border-b p-2"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'focus-glow-action flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary-container/25 text-on-surface'
                  : 'text-on-surface/60 hover:bg-surface-container-high/60 hover:text-on-surface',
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'star' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            showStarCount
            controlScope="star"
          />
        ) : null}
        {activeTab === 'starInner' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            showStarCount
            controlScope="starInner"
          />
        ) : null}
        {activeTab === 'trail' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            controlScope="trail"
          />
        ) : null}
        {activeTab === 'geometry' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            controlScope="geometry"
          />
        ) : null}
        {activeTab === 'launch' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            showLaunch
            controlScope="launch"
          />
        ) : null}
        {activeTab === 'fx' ? (
          <div className="space-y-6">
            <FireworkRenderControls
              design={design}
              defaults={defaults}
              calibrationDefaults={calibrationDefaults}
              mutate={mutate}
              disabled={disabled}
              controlScope="strobe"
            />
            <FireworkRenderControls
              design={design}
              defaults={defaults}
              calibrationDefaults={calibrationDefaults}
              mutate={mutate}
              disabled={disabled}
              controlScope="crackle"
            />
            <FireworkRenderControls
              design={design}
              defaults={defaults}
              calibrationDefaults={calibrationDefaults}
              mutate={mutate}
              disabled={disabled}
              controlScope="split"
            />
          </div>
        ) : null}
        {activeTab === 'smoke' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            controlScope="smoke"
          />
        ) : null}
        {activeTab === 'sound' ? (
          <FireworkRenderControls
            design={design}
            defaults={defaults}
            calibrationDefaults={calibrationDefaults}
            mutate={mutate}
            disabled={disabled}
            controlScope="sound"
          />
        ) : null}
      </div>
    </div>
  );
}
