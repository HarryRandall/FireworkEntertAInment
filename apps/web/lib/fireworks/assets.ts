import type { SoundAssets } from '@showcrafter/fireworks/SoundHandler';
const base = '/sounds/fireworks';
export const FIREWORK_SOUND_ASSETS: SoundAssets = {
  mortar: [1, 2, 3].map((n) => `${base}/up${n}.mp3`),
  lightBoom: [1, 2, 3].map((n) => `${base}/light_boom${n}.mp3`),
  heavyBoom: [1, 2].map((n) => `${base}/heavy_boom${n}.mp3`),
  crackle: [1, 2].map((n) => `${base}/crackle${n}.mp3`),
};
