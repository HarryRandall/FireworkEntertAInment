import { hash } from './random';
import type { Vec3 } from './colour';
export interface StarDirection {
  x: number;
  y: number;
  z: number;
  h: number;
  h2: number;
  ph: number;
}
export function unit(k: number, seed: number): Vec3 {
  const z = 2 * hash(k, seed, 31) - 1,
    th = 6.2832 * hash(k, seed, 32),
    r = Math.sqrt(1 - z * z);
  return [r * Math.cos(th), z, r * Math.sin(th)];
}
// Special burst shapes are added in PR 2.3; never silently substitute a sphere.
export function directions(n: number, pattern: string, seed: number): StarDirection[] {
  if (pattern !== 'sphere' && pattern !== 'random')
    throw new RangeError(`Pattern ${pattern} is not implemented in the core simulation`);
  const out: StarDirection[] = [];
  const yaw = hash(seed, 91, 3) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (pattern === 'random') {
      z = 2 * hash(seed, i, 1) - 1;
      const th = 2 * Math.PI * hash(seed, i, 2),
        r = Math.sqrt(1 - z * z);
      x = r * Math.cos(th);
      y = Math.abs(r * Math.sin(th)) * 0.7 + 0.2;
      const l = Math.hypot(x, y, z);
      x /= l;
      y /= l;
      z /= l;
    } else {
      y = Math.max(-1, Math.min(1, 1 - (2 * (i + 0.5)) / n + (hash(seed, i, 8) - 0.5) * (2.4 / n)));
      const r = Math.sqrt(1 - y * y),
        phi = i * 2.399963 + (hash(seed, i, 7) - 0.5) * 0.9;
      x = r * Math.cos(phi);
      z = r * Math.sin(phi);
    }
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw);
    out.push({
      x: x * cy + z * sy,
      y,
      z: -x * sy + z * cy,
      h: hash(seed, i, 3),
      h2: hash(seed, i, 4),
      ph: hash(seed, i, 5) * 6.2832,
    });
  }
  return out;
}
