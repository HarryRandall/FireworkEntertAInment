/** Hover clocks include late modifiers and focus on the selected break instead of a still's best moment. */
import { shotDuration, resolveDesign, type Design } from '@showcrafter/fireworks';
import { selectedLayer } from './layers';
import { inspectorLayer } from './inspector';
import { partEnvelope } from './library';

const CLIMB_AFTERGLOW_S = 0.35; // Prototype tail-card allowance after apex, seconds.
/** A clip's absolute clock window, in seconds from firing. */
export interface PreviewWindow {
  from_s: number;
  to_s: number;
}
/** Returns a clip window for a selected star group or launch climb, without mutating stored values. */
export function previewWindow(document: Design, address: string, climb: boolean): PreviewWindow {
  const resolved = resolveDesign(document);
  const launchTime = resolved.kind === 'mine' ? 0 : (resolved.launch?.time_s ?? 0);
  if (climb) return { from_s: 0, to_s: launchTime + CLIMB_AFTERGLOW_S };
  const selection = selectedLayer(resolved, address);
  const layer = selection ? inspectorLayer(resolved, selection) : undefined;
  if (selection && layer) {
    const from_s = launchTime + resolved.breaks[selection.breakIndex].at_s + layer.delay_s;
    const duration_s = shotDuration(partEnvelope(resolved, address)) - launchTime;
    return { from_s, to_s: from_s + duration_s };
  }
  return { from_s: launchTime, to_s: shotDuration(resolved) };
}
