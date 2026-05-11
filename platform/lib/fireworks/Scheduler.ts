import type { ReplayCue } from "@/lib/show-domain";

export type ScheduledCue = {
  cue: ReplayCue;
  fired: boolean;
};

export class Scheduler {
  private cues: ScheduledCue[] = [];

  setCues(cues: ReplayCue[]): void {
    this.cues = cues
      .slice()
      .sort((a, b) => a.timeSeconds - b.timeSeconds)
      .map((cue) => ({ cue, fired: false }));
  }

  /**
   * Reset all cues to unfired (used on a backwards seek).
   */
  resetFiredAfter(time: number): void {
    for (const sc of this.cues) {
      if (sc.cue.timeSeconds >= time) sc.fired = false;
    }
  }

  resetAll(): void {
    for (const sc of this.cues) sc.fired = false;
  }

  /**
   * Returns cues that should fire in (prev, now], marking them fired.
   */
  pop(prev: number, now: number): ReplayCue[] {
    const due: ReplayCue[] = [];
    for (const sc of this.cues) {
      if (sc.fired) continue;
      if (sc.cue.timeSeconds > prev && sc.cue.timeSeconds <= now) {
        due.push(sc.cue);
        sc.fired = true;
      }
    }
    return due;
  }

  size(): number {
    return this.cues.length;
  }
}
