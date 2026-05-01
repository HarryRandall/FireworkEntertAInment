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

  vec3 color = mix(vColorStart, vColorMid, smoothstep(0.0, 0.16, vAgeNorm));
  color = mix(color, vColorEnd, smoothstep(0.45, 1.0, vAgeNorm));
  // Tighter, more star-like falloff — the previous values (5..12) produced a very
  // soft glow that read as one big white disc when many particles overlapped.
  float radial = exp(-r * mix(14.0, 28.0, uSoftness));
  float core = pow(smoothstep(1.0, 0.0, r), 1.6);
  float alpha = mix(vAlpha.x, vAlpha.y, smoothstep(0.0, 0.35, vAgeNorm));
  alpha = mix(alpha, vAlpha.z, smoothstep(0.35, 1.0, vAgeNorm));
  alpha *= alphaCurve(vAgeNorm, vAlpha.w);

  if (vFlicker.z > 0.0) {
    float phase = fract((uTime + vSeed) * vFlicker.z);
    alpha *= step(phase, max(0.02, vFlicker.w));
  }

  float sparkle = 0.88 + 0.22 * hash21(gl_PointCoord * 18.0 + vSeed);
  gl_FragColor = vec4(color * (vEmissive * uExposure) * (0.55 + core), alpha * radial * sparkle);
}
