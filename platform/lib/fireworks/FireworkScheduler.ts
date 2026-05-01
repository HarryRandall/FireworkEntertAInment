import type { ReplayCue } from "@/lib/shows";
import {
  compileCueEvents,
  eventIsActiveAt,
  type CompiledEffectEvent,
} from "@/lib/fireworks/EffectCompiler";

export class FireworkScheduler {
  private cues: ReplayCue[] = [];
  private events: CompiledEffectEvent[] = [];

  setCues(cues: ReplayCue[]): void {
    this.cues = [...cues].sort((a, b) => a.timeSeconds - b.timeSeconds);
    this.events = this.cues.flatMap(compileCueEvents);
    this.events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  }

  getEventsBetween(previousElapsed: number, elapsed: number): CompiledEffectEvent[] {
    if (elapsed < previousElapsed) return this.getActiveEventsAt(elapsed);
    return this.events.filter(
      (event) => event.time > previousElapsed && event.time <= elapsed,
    );
  }

  getActiveEventsAt(elapsed: number): CompiledEffectEvent[] {
    return this.events.filter((event) => eventIsActiveAt(event, elapsed));
  }

  getEventCount(): number {
    return this.events.length;
  }

  getCueCount(): number {
    return this.cues.length;
  }
}
