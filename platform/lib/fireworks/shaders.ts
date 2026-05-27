/**
 * GLSL shader strings for the fireworks particle material.
 *
 * Kept inline as template strings so they can be shipped to the browser
 * without an extra build step. `gl_PointSize` is computed from particle
 * size and view-space depth so distant bursts shrink naturally.
 */

export const VERTEX_SHADER = /* glsl */ `
attribute float size;
varying vec3 vColor;
varying float vDepthFade;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float distanceScale = 500.0 / max(-mvPosition.z, 1.0);
  gl_PointSize = clamp(size * distanceScale, 1.5, 38.0);
  vDepthFade = smoothstep(6200.0, 800.0, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vDepthFade;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float squareDistance = max(abs(centered.x), abs(centered.y));
  float roundDistance = length(centered);

  float squareCore = 1.0 - smoothstep(0.16, 0.39, squareDistance);
  float hotInner = 1.0 - smoothstep(0.0, 0.17, roundDistance);
  float softHalo = 1.0 - smoothstep(0.22, 0.72, roundDistance);
  float edgeSpark = 1.0 - smoothstep(0.41, 0.5, squareDistance);

  vec3 whiteHot = vec3(1.0, 0.94, 0.78);
  vec3 sparkColor = mix(vColor, whiteHot, hotInner * 0.46);
  float sparkIntensity = squareCore * 1.0 + softHalo * 0.32 + edgeSpark * 0.08;
  float sparkAlpha = squareCore * 0.86 + softHalo * 0.25;
  float intensity = sparkIntensity;
  float alpha = clamp(sparkAlpha * vDepthFade, 0.0, 1.0);

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(sparkColor * intensity, alpha);
}
`;

export const SMOKE_VERTEX_SHADER = /* glsl */ `
attribute float size;
varying vec3 vColor;
varying float vDepthFade;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float distanceScale = 520.0 / max(-mvPosition.z, 1.0);
  gl_PointSize = clamp(size * distanceScale, 5.0, 56.0);
  vDepthFade = smoothstep(5600.0, 700.0, -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const SMOKE_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vDepthFade;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float roundDistance = length(centered);
  if (roundDistance > 0.56) discard;

  float body = 1.0 - smoothstep(0.1, 0.54, roundDistance);
  float rim = smoothstep(0.22, 0.38, roundDistance) * (1.0 - smoothstep(0.38, 0.56, roundDistance));
  float strength = clamp(max(max(vColor.r, vColor.g), vColor.b) * 3.1, 0.0, 1.0);
  vec3 smokeColor = clamp(vec3(0.22, 0.24, 0.28) + vColor * 0.45, vec3(0.0), vec3(0.38));
  float alpha = (body * 0.36 + rim * 0.22) * strength * vDepthFade;

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(smokeColor, alpha);
}
`;
