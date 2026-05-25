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

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(size * (300.0 / max(-mvPosition.z, 1.0)), 1.0, 18.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;

void main() {
  gl_FragColor = vec4(vColor, 1.0);
}
`;
