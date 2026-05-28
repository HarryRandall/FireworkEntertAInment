/**
 * GLSL shader strings for the fireworks particle material.
 *
 * Kept inline as template strings so they can be shipped to the browser
 * without an extra build step. `gl_PointSize` is computed from particle
 * size and view-space depth so distant bursts shrink naturally.
 */

export const VERTEX_SHADER = /* glsl */ `
attribute float size;
attribute float shape;
varying vec3 vColor;
varying float vDepthFade;
varying float vShape;

void main() {
  vColor = color;
  vShape = shape;
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
varying float vShape;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float isSquare = step(0.5, vShape);
  float roundDistance = length(centered);
  float squareX = abs(centered.x);
  float squareY = abs(centered.y);
  float squareDistance = max(squareX, squareY);
  if (isSquare < 0.5 && roundDistance > 0.58) discard;
  if (isSquare > 0.5 && squareDistance > 0.5) discard;

  float roundCore = 1.0 - smoothstep(0.08, 0.25, roundDistance);
  float hotInner = 1.0 - smoothstep(0.0, 0.14, roundDistance);
  float softHalo = 1.0 - smoothstep(0.18, 0.58, roundDistance);
  float rimSpark = smoothstep(0.22, 0.34, roundDistance) * (1.0 - smoothstep(0.34, 0.58, roundDistance));
  float squareBody = 1.0 - smoothstep(0.34, 0.5, squareDistance);
  float squareHot = 1.0 - smoothstep(0.0, 0.22, squareDistance);
  float squareHalo = 1.0 - smoothstep(0.18, 0.5, squareDistance);

  vec3 whiteHot = vec3(1.0, 0.94, 0.78);
  vec3 sparkColor = mix(vColor, whiteHot, mix(hotInner * 0.46, squareHot * 0.42, isSquare));
  float sparkIntensity = mix(
    roundCore * 1.0 + softHalo * 0.26 + rimSpark * 0.07,
    squareBody * 1.05 + squareHalo * 0.18,
    isSquare
  );
  float sparkAlpha = mix(roundCore * 0.82 + softHalo * 0.22, squareBody * 0.76 + squareHalo * 0.15, isSquare);
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
