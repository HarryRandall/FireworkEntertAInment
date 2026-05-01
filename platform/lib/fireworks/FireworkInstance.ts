import type { CompiledEffectEvent } from "@/lib/fireworks/EffectCompiler";

export class FireworkInstance {
  readonly id: string;
  readonly event: CompiledEffectEvent;
  readonly startedAt: number;
  readonly expiresAt: number;

  constructor(event: CompiledEffectEvent) {
    this.id = event.id;
    this.event = event;
    this.startedAt = event.time;
    this.expiresAt = event.expiresAt;
  }

  isAlive(elapsed: number): boolean {
    return elapsed <= this.expiresAt;
  }
}
