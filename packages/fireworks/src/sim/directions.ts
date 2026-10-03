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
export function directions(n: number, pattern: string, seed: number, tilt = 0): StarDirection[] {
  const out: StarDirection[] = [];
  const yaw = pattern === 'heart' || pattern === 'spiral' ? 0 : hash(seed, 91, 3) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number;
    if (pattern === 'ring') {
      const a = (i / n) * Math.PI * 2;
      x = Math.cos(a);
      const angle = (tilt * Math.PI) / 2 + 0.3;
      y = Math.sin(a) * Math.cos(angle);
      z = Math.sin(a) * Math.sin(angle);
    } else if (pattern === 'heart') {
      const a = (i / n) * Math.PI * 2;
      x = (16 * Math.sin(a) ** 3) / 17;
      y = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17;
      z = 0;
    } else if (pattern === 'spiral') {
      const u = (i + 0.5) / n,
        a = u * Math.PI * 5 + (i % 2 ? Math.PI : 0);
      x = Math.cos(a) * (0.12 + u * 0.88);
      y = Math.sin(a) * (0.12 + u * 0.88);
      z = (hash(seed, i, 8) - 0.5) * 0.1;
    } else if (pattern === 'cone') {
      const a = hash(seed, i, 1) * Math.PI * 2,
        s = Math.sqrt(hash(seed, i, 2)) * Math.sin(0.42);
      x = Math.cos(a) * s;
      z = Math.sin(a) * s;
      y = Math.sqrt(1 - s * s);
    } else if (pattern === 'bottom') {
      y = -1 + 1.25 * ((i + 0.5) / n);
      const r = Math.sqrt(Math.max(0, 1 - y * y)),
        phi = i * 2.399963;
      x = r * Math.cos(phi);
      z = r * Math.sin(phi);
    } else if (pattern === 'random') {
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
