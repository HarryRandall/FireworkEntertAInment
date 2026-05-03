export const fireworkParticleVertexShader = /* glsl */ `
attribute vec3 aVelocity;
attribute vec3 aAcceleration;
attribute vec2 aSpawnLifetime;
attribute vec2 aSize;
attribute vec3 aColorStart;
attribute vec3 aColorMid;
attribute vec3 aColorEnd;
attribute vec4 aAlpha;
attribute vec2 aPhysics;
attribute vec4 aFlicker;
attribute vec2 aMotion;
attribute float aTransition;
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;
uniform float uPointScale;
uniform vec3 uWind;

varying vec3 vColorStart;
varying vec3 vColorMid;
varying vec3 vColorEnd;
varying vec4 vAlpha;
varying vec4 vFlicker;
varying float vAgeNorm;
varying float vTransition;
varying float vSeed;
varying float vEmissive;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  float spawnTime = aSpawnLifetime.x;
  float lifetime = max(aSpawnLifetime.y, 0.0001);
  float age = uTime - spawnTime;
  float visible = step(0.0, age) * step(age, lifetime);
  float t = clamp(age / lifetime, 0.0, 1.0);
  float drag = clamp(aPhysics.x, 0.0, 0.999);
  float k = max(0.0001, (1.0 - drag) * 3.0);
  float F = (1.0 - exp(-age * k)) / k;
  vec3 curl = vec3(
    sin(age * 1.7 + aSeed * 13.1),
    sin(age * 2.1 + aSeed * 7.7),
    cos(age * 1.9 + aSeed * 11.3)
  ) * hash11(aSeed + 2.0) * 0.035;
  float spinPhase = age * aMotion.y + aSeed * 19.17;
  vec3 spin = vec3(sin(spinPhase), 0.0, cos(spinPhase)) * aMotion.x;
  vec3 worldPosition = position
    + aVelocity * F
    + aAcceleration * (age - F) / k
    + uWind * age
    + curl * age
    + spin * smoothstep(0.0, 0.08, age);

  vec4 mvPosition = modelViewMatrix * vec4(worldPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float size = mix(aSize.x, aSize.y, t);
  size *= 1.0 + sin(uTime * aFlicker.x + aSeed * 19.17) * aFlicker.y;
  float projected = size * uPointScale * uPixelRatio * (72.0 / max(1.0, -mvPosition.z));
  gl_PointSize = max(0.0, visible * min(projected, 86.0 * uPixelRatio));

  vColorStart = aColorStart;
  vColorMid = aColorMid;
  vColorEnd = aColorEnd;
  vAlpha = aAlpha;
  vFlicker = aFlicker;
  vAgeNorm = t;
  vTransition = aTransition;
  vSeed = aSeed;
  vEmissive = aPhysics.y;
}
`;

export const fireworkParticleFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uExposure;
uniform float uSoftness;

varying vec3 vColorStart;
varying vec3 vColorMid;
varying vec3 vColorEnd;
varying vec4 vAlpha;
varying vec4 vFlicker;
varying float vAgeNorm;
varying float vTransition;
varying float vSeed;
varying float vEmissive;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float alphaCurve(float t, float curve) {
  if (curve < 0.5) return 1.0 - t;
  if (curve < 1.5) return pow(1.0 - t, 1.65);
  if (curve < 2.5) return pow(1.0 - t, 1.2) * (0.7 + 0.3 * sin(t * 75.0));
  if (curve < 3.5) return step(0.5, fract(t * 18.0));
  if (curve < 4.5) return pow(1.0 - t, 1.9) * (0.55 + 0.45 * hash21(gl_PointCoord + vSeed));
  return 1.0 - smoothstep(0.78, 1.0, t);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float r = dot(uv, uv);
  if (r > 1.0) discard;

  float transitionAt = clamp(vTransition, 0.02, 0.98);
  vec3 color = mix(vColorStart, vColorMid, smoothstep(0.0, min(0.16, transitionAt * 0.5), vAgeNorm));
  color = mix(color, vColorEnd, smoothstep(transitionAt, min(1.0, transitionAt + 0.2), vAgeNorm));
  float radial = exp(-r * mix(7.0, 18.0, uSoftness));
  float core = pow(smoothstep(0.62, 0.0, r), 1.85);
  float halo = pow(smoothstep(1.0, 0.0, r), 3.8);
  float alpha = mix(vAlpha.x, vAlpha.y, smoothstep(0.0, 0.35, vAgeNorm));
  alpha = mix(alpha, vAlpha.z, smoothstep(0.35, 1.0, vAgeNorm));
  alpha *= alphaCurve(vAgeNorm, vAlpha.w);

  if (vFlicker.z > 0.0) {
    float phase = fract((uTime + vSeed) * vFlicker.z);
    alpha *= step(phase, max(0.02, vFlicker.w));
  }

  float sparkle = 0.86 + 0.28 * hash21(gl_PointCoord * 18.0 + vSeed);
  vec3 bloomColor = color * (vEmissive * uExposure) * (0.34 + core * 1.35 + halo * 0.55);
  gl_FragColor = vec4(bloomColor, alpha * radial * sparkle);
}
`;

export const trailVertexShader = fireworkParticleVertexShader;
export const trailFragmentShader = fireworkParticleFragmentShader;
