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
varying float vZoomAtten;
varying float vHeadGrow;
varying float vGlowFrac;

void main() {
  vColor = color;
  vShape = shape;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float depth = max(-mvPosition.z, 1.0);
  float linearScale = 500.0 / depth;
  float isHead = step(1.5, shape);
  // Compressed perspective response (exponent < 1) so apparent sprite size
  // changes far less with zoom: close-up sprites stop slamming into their
  // pixel caps and reading tiny against the scene, and far sprites never
  // shrink into sub-pixel noise. Heads compress hardest so they stay the
  // dominant, clearly-readable orbs at any camera distance.
  float exponent = mix(0.7, 0.55, isHead);
  float distanceScale = pow(linearScale, exponent);
  // Glow strength (encoded as shape = 2 + glow * 0.25) pads the sprite so
  // the halo has room around a constant-size body; the fragment shader
  // compensates the body radius by the actually-applied growth so the solid
  // orb never changes size when glow changes, even when the sprite is
  // clamped by the pixel cap.
  float glowT = clamp(max(shape - 2.0, 0.0) * 4.0 / 3.0, 0.0, 1.0) * isHead;
  // Head orbs (shape >= 2) get a much higher ceiling: with the shared 96px
  // cap, zooming right in let trail squares catch up to the heads so the
  // heads read smaller than their own trail. Heads must stay dominant.
  float maxPointSize = mix(96.0, 640.0, isHead);
  float minPointSize = mix(2.0, 4.0, isHead);
  float baseSize = clamp(size * distanceScale, minPointSize, maxPointSize);
  // Halo budget: an additive pixel pad driven by glow strength and camera
  // distance only - never by head size - so a tiny head at max glow wears
  // the same aura as a huge one. The distance exponent is slightly steeper
  // than the body's 0.55, so the halo shrinks a touch faster on zoom-out
  // and distant bursts resolve into clean orbs instead of stacked blur.
  float glowPad = sqrt(glowT) * 130.0 * pow(linearScale, 0.62);
  float pointSize = clamp(baseSize + glowPad, minPointSize, maxPointSize);
  gl_PointSize = pointSize;
  vHeadGrow = pointSize / max(baseSize, 0.0001);
  // Fraction of the sprite that is halo padding (after pixel caps). The
  // fragment shader sizes the Gaussian falloff from this, so the aura is a
  // fixed pixel width for a given glow strength whatever the head size.
  vGlowFrac = (pointSize - baseSize) / max(pointSize, 0.0001);
  vDepthFade = smoothstep(6200.0, 800.0, -mvPosition.z);
  // Zoomed out, dense square trails overlap per pixel and additive blending
  // saturates to white; rounds get a gentler version and heads none at all
  // so bursts stay bright and legible from far away.
  vZoomAtten = pow(clamp(linearScale, 0.0, 1.0), 0.5);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vDepthFade;
varying float vShape;
varying float vZoomAtten;
varying float vHeadGrow;
varying float vGlowFrac;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  // shape 0 = round spark, shape 1 = flat square, shape 2 = glowing head orb
  float isHead = step(1.5, vShape);
  float isSquare = step(0.5, vShape) * (1.0 - isHead);
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
  // Flat pixel-style square fill: any radial falloff inside the square reads
  // as a "square inside a square" once additive blending stacks up, so the
  // square branch uses pure flat colour with only edge anti-aliasing.
  float squareBody = 1.0 - smoothstep(0.46, 0.5, squareDistance);

  // Head orb: small white-hot core, saturated coloured body, diffuse halo.
  // One sprite per head so the core and its glow can never drift apart. Glow
  // strength is decoded from the shape attribute (shape = 2 + glow * 0.25).
  float headGlowStrength = max(vShape - 2.0, 0.0) * 4.0;
  float glowT = clamp(headGlowStrength / 3.0, 0.0, 1.0);
  // The vertex shader grows the sprite with glow strength; sampling the body
  // in growth-compensated space (vHeadGrow is the growth actually applied
  // after pixel caps) keeps the solid orb a constant size while the halo
  // expands into the extra sprite area.
  float headR = roundDistance * vHeadGrow;
  // Crisp body with a short anti-aliased shoulder: the solid orb must stay
  // sharply readable on its own, with all of the softness delegated to the
  // halo term below.
  float headCore = 1.0 - smoothstep(0.0, 0.12, headR);
  float headBody = 1.0 - smoothstep(0.16, 0.3, headR);
  // Diffuse halo: Gaussian falloff sized from the sprite's halo padding
  // fraction (vGlowFrac), which the vertex shader derives from glow strength
  // and camera distance only. That keeps the aura a constant pixel width for
  // a given glow whatever the head size, and exp() decays to ~nothing before
  // the 0.58 discard radius (an edge window guarantees zero there), so the
  // glow has no visible rim.
  float glowSigma = max(vGlowFrac * 0.42, 0.001);
  float headGlow = exp(-(roundDistance * roundDistance) / (2.0 * glowSigma * glowSigma));
  headGlow *= 1.0 - smoothstep(0.42, 0.56, roundDistance);
  // Halos overlap heavily mid-zoom and stack into a smear under additive
  // blending, so the halo (never the body) fades back with distance.
  headGlow *= mix(0.4, 1.0, vZoomAtten);
  float haloGain = 0.5 * glowT;
  float haloAlphaGain = 0.34 * glowT;

  vec3 whiteHot = vec3(1.0, 0.94, 0.78);
  vec3 sparkColor = mix(vColor, whiteHot, hotInner * 0.46 * (1.0 - isSquare) * (1.0 - isHead));
  // White-hot centre is part of the glow look: at glow 0 heads stay pure
  // saturated colour rather than blooming white.
  sparkColor = mix(sparkColor, mix(vColor, whiteHot, headCore * (0.12 + 0.38 * glowT)), isHead);
  float sparkIntensity = mix(
    roundCore * 1.0 + softHalo * 0.26 + rimSpark * 0.07,
    squareBody * 1.15,
    isSquare
  );
  // Bare heads (glow 0) sit well below full additive brightness so they
  // read as coloured orbs; brightness is something the glow slider buys.
  float headBodyGain = 0.72 + 0.28 * glowT;
  sparkIntensity = mix(sparkIntensity, headBody * headBodyGain + headGlow * haloGain, isHead);
  float sparkAlpha = mix(roundCore * 0.82 + softHalo * 0.22, squareBody * 0.9, isSquare);
  float headAlpha = headBody * (0.66 + 0.2 * glowT) + headGlow * haloAlphaGain;
  sparkAlpha = mix(sparkAlpha, clamp(headAlpha, 0.0, 1.0), isHead);
  // Distance attenuation: full strength on dense squares, gentle on rounds,
  // none on heads so zoomed-out bursts keep their clearly visible orbs.
  float zoomAtten = mix(mix(sqrt(vZoomAtten), vZoomAtten, isSquare), 1.0, isHead);
  float alpha = clamp(sparkAlpha * vDepthFade * zoomAtten, 0.0, 1.0);
  float intensity = sparkIntensity;

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
