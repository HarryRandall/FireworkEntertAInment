/** Prototype crackle synthesis, with seeded variation and owned Web Audio nodes. */
import type { SoundPlayback } from './playback';
// Prototype crackle min length s, seconds.
const CRACKLE_MIN_LENGTH_S = 0.6;
// Prototype crackle max length s, seconds.
const CRACKLE_MAX_LENGTH_S = 0.9;
// Prototype crackle heavy pops, dimensionless acoustic tuning.
const CRACKLE_HEAVY_POPS = 90;
// Prototype crackle pops, dimensionless acoustic tuning.
const CRACKLE_POPS = 60;
// Prototype crackle pop time power, dimensionless acoustic tuning.
const CRACKLE_POP_TIME_POWER = 0.7;
// Prototype crackle pop min gain, dimensionless acoustic tuning.
const CRACKLE_POP_MIN_GAIN = 0.3;
// Prototype crackle heavy gain, dimensionless acoustic tuning.
const CRACKLE_HEAVY_GAIN = 1.3;
// Prototype crackle pop max rate, dimensionless acoustic tuning.
const CRACKLE_POP_MAX_RATE = 1.6;
// Prototype light crackle gain and minimum pop playback rate, dimensionless.
const CRACKLE_LIGHT_GAIN = 0.9;
const CRACKLE_POP_MIN_RATE = 0.6;
/** Schedules the crackle voice at playback.when audio seconds; mutates only its owned graph. */
export function playCrackle(playback: SoundPlayback): void {
  const { event, when, output, voice, random } = playback;
  // Crackling stars: a train of sharp pops that thickens, then thins out over a short burst.
  const duration = random(CRACKLE_MIN_LENGTH_S, CRACKLE_MAX_LENGTH_S);
  const popCount = event.heavy ? CRACKLE_HEAVY_POPS : CRACKLE_POPS;
  for (let popIndex = 0; popIndex < popCount; popIndex++) {
    const progress = Math.pow(random(0, 1), CRACKLE_POP_TIME_POWER);
    voice.play(voice.buffers.pop, when + progress * duration, output, {
      gain:
        random(CRACKLE_POP_MIN_GAIN, 1) * (event.heavy ? CRACKLE_HEAVY_GAIN : CRACKLE_LIGHT_GAIN),
      rate: random(CRACKLE_POP_MIN_RATE, CRACKLE_POP_MAX_RATE),
    });
  }
}
