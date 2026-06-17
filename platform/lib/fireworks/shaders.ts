/**
 * GLSL shader strings for the fireworks particle material.
 *
 * Kept inline as template strings so they can be shipped to the browser
 * without an extra build step. `gl_PointSize` is computed from particle
 * size and view-space depth so distant bursts shrink naturally.
 */

export const VERTEX_SHADER = /* glsl */ `
uniform float glowPadding;
uniform float whiteCoreSizePercent;
attribute float size;
attribute float shape;
attribute float rotation;
varying vec3 vColor;
varying float vDepthFade;
varying float vShape;
varying float vRotation;
varying float vZoomAtten;
varying float vHeadCoreRadius;
varying float vHeadWhiteCoreRadius;
varying float vHeadGlowStrength;
varying float vHeadSizeAtten;

void main() {
  vColor = color;
  vShape = shape;
  vRotation = rotation;
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
  float headGlowStrength = clamp(max(shape - 2.0, 0.0) * 4.0, 0.0, 3.0) * isHead;
  // Head orbs (shape >= 2) get a much higher ceiling: with the shared 96px
  // cap, zooming right in let trail squares catch up to the heads so the
  // heads read smaller than their own trail. Heads must stay dominant.
  float maxPointSize = mix(96.0, 1280.0, isHead);
  float minPointSize = mix(2.0, 4.0, isHead);
  // Background glow size is stored in the legacy glowPadding field, but the
  // value is now a percentage of the star core size. 300% reserves three star
  // sizes of room on each side of the core for the broad coloured wash.
  float backgroundGlowScale = clamp(glowPadding / 100.0, 0.0, 3.0) * isHead;
  float maxCoreSize = maxPointSize / max(1.0 + backgroundGlowScale * 2.0, 1.0);
  float coreSize = clamp(size * distanceScale, minPointSize, maxCoreSize);
  float haloPad = coreSize * backgroundGlowScale;
  float pointSize = clamp(coreSize + haloPad * 2.0, minPointSize, maxPointSize);
  gl_PointSize = pointSize;
  // The fragment shader works in normalised sprite coordinates. Shrinking this
  // radius as background glow room grows keeps the actual core diameter stable.
  float headCoreRadius = coreSize / max(pointSize * 2.0, 0.0001);
  vHeadCoreRadius = headCoreRadius;
  // 100% fills the coloured star core. Lower values keep a smaller white-hot
  // centre that scales with the star size.
  float whiteCoreVisualRadius = headCoreRadius * clamp(whiteCoreSizePercent / 100.0, 0.0, 1.0);
  vHeadWhiteCoreRadius = min(
    whiteCoreVisualRadius,
    headCoreRadius
  ) * isHead;
  vHeadGlowStrength = headGlowStrength;
  // Larger point sprites cover more pixels, which can read as "brighter" even
  // when the centre value is unchanged. Attenuate large heads so size edits
  // change scale, not heat.
  vHeadSizeAtten = mix(1.0, clamp(pow(16.0 / max(size, 1.0), 0.38), 0.58, 1.22), isHead);
  vDepthFade = smoothstep(6200.0, 800.0, -mvPosition.z);
  // Zoomed out, dense square trails overlap per pixel and additive blending
  // saturates to white; rounds get a gentler version and heads none at all
  // so bursts stay bright and legible from far away.
  vZoomAtten = pow(clamp(linearScale, 0.0, 1.0), 0.5);
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `
uniform float glowPadding;
uniform float whiteCoreBlurPercent;
uniform float coreSoftness;
uniform float coreBrightness;
uniform float coreOpacityFalloff;
uniform float glowSize;
uniform float glowSoftness;
uniform float glowOpacityFalloff;
uniform float glowBlur;
uniform float backgroundGlowOpacityFalloff;
uniform float backgroundGlowSoftness;
varying vec3 vColor;
varying float vDepthFade;
varying float vShape;
varying float vRotation;
varying float vZoomAtten;
varying float vHeadCoreRadius;
varying float vHeadWhiteCoreRadius;
varying float vHeadGlowStrength;
varying float vHeadSizeAtten;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float rotationCos = cos(vRotation);
  float rotationSin = sin(vRotation);
  vec2 rotated = vec2(
    centered.x * rotationCos - centered.y * rotationSin,
    centered.x * rotationSin + centered.y * rotationCos
  );
  // shape 0 = glowing disc, shape 1 = flat square, shape 1.25 = triangle, shape 2+ = glowing head orb
  float isHead = step(1.5, vShape);
  float isTriangle = step(1.15, vShape) * (1.0 - step(1.5, vShape));
  float isSquare = step(0.5, vShape) * (1.0 - isTriangle) * (1.0 - isHead);
  float isAngular = max(isSquare, isTriangle);
  float roundDistance = length(centered);
  float squareX = abs(rotated.x);
  float squareY = abs(rotated.y);
  float squareDistance = max(squareX, squareY);
  float triangleWidth = max((0.5 - rotated.y) * 0.5, 0.0);
  float triangleDistance = max(
    abs(rotated.x) - triangleWidth,
    max(rotated.y - 0.5, -rotated.y - 0.5)
  );
  if (isHead > 0.5 && roundDistance > 0.5) discard;
  if (isHead < 0.5 && isSquare < 0.5 && isTriangle < 0.5 && roundDistance > 0.58) discard;
  if (isSquare > 0.5 && squareDistance > 0.5) discard;
  if (isTriangle > 0.5 && triangleDistance > 0.0) discard;

  float roundCore = 1.0 - smoothstep(0.08, 0.25, roundDistance);
  float hotInner = 1.0 - smoothstep(0.0, 0.14, roundDistance);
  float softHalo = 1.0 - smoothstep(0.18, 0.58, roundDistance);
  float rimSpark = smoothstep(0.22, 0.34, roundDistance) * (1.0 - smoothstep(0.34, 0.58, roundDistance));
  // Flat pixel-style square fill: any radial falloff inside the square reads
  // as a "square inside a square" once additive blending stacks up, so the
  // square branch uses pure flat colour with only edge anti-aliasing.
  float squareBody = 1.0 - smoothstep(0.46, 0.5, squareDistance);
  float triangleBody = 1.0 - smoothstep(-0.02, 0.018, triangleDistance);

  // Head orb: a coloured core with a separate halo. Glow strength
  // only multiplies the halo; it never changes the core radius or opacity.
  float headGlowStrength = clamp(vHeadGlowStrength, 0.0, 3.0);
  float glowT = headGlowStrength / 3.0;
  float coreRadius = clamp(vHeadCoreRadius, 0.001, 0.5);
  float coreEdge = max(fwidth(roundDistance) * 1.5, 0.0015);
  float headCore = 1.0 - smoothstep(coreRadius - coreEdge, coreRadius + coreEdge, roundDistance);
  // Exemplar-style soft core: as softness rises the falloff slides inward from
  // the rim, turning the flat disc into a smoothly glowing orb. coreSoftness 0
  // reproduces the original hard disc exactly.
  float coreSoft = clamp(coreSoftness / 100.0, 0.0, 1.0);
  float coreSoftOverdrive = clamp((coreSoftness - 100.0) / 10.0, 0.0, 1.0);
  float coreGain = clamp(coreBrightness / 100.0, 0.0, 3.0);
  float coreBlurT = pow(coreSoft, 1.08);
  float softCoreRadius = max(coreRadius * mix(0.92, mix(0.56, 0.48, coreSoftOverdrive), coreBlurT), 0.001);
  float softCoreFalloff = mix(0.45, mix(2.35, 2.8, coreSoftOverdrive), coreBlurT);
  float softCore = exp(-pow(roundDistance / softCoreRadius, 2.0) * softCoreFalloff);
  softCore = pow(softCore, mix(0.9, 1.1, coreBlurT));
  float headCoreShaped = mix(headCore, softCore, coreSoft);
  float coreOpacityT = clamp(coreOpacityFalloff / 100.0, 0.0, 1.0);
  float coreOpacityOverdrive = clamp((coreOpacityFalloff - 100.0) / 20.0, 0.0, 1.0);
  float headCoreAlpha = mix(headCore, headCoreShaped, coreOpacityT);
  headCoreAlpha *= mix(1.0, 0.82, coreOpacityOverdrive);
  float whiteCoreRadius = clamp(vHeadWhiteCoreRadius, 0.0, coreRadius);
  float whiteCoreBlur = clamp(whiteCoreBlurPercent / 100.0, 0.0, 1.0);
  float whiteCoreEdge = max(fwidth(roundDistance) * 1.25, 0.0015);
  float whiteCoreSizeT = whiteCoreRadius / max(coreRadius, 0.001);
  float whiteCoreStrength = smoothstep(0.0, 0.08, whiteCoreSizeT);
  float whiteCoreBlurWidth = max(whiteCoreRadius * 1.85, coreRadius * 0.01) * pow(whiteCoreBlur, 1.05);
  float whiteCoreFeatherStart = max(whiteCoreRadius - whiteCoreBlurWidth * 0.5, 0.0);
  float whiteCoreFeatherEnd = min(coreRadius, whiteCoreRadius + max(whiteCoreBlurWidth, whiteCoreEdge));
  float whiteCoreSharpMask = 1.0 - step(whiteCoreRadius, roundDistance);
  float whiteCoreBlurMask = 1.0 - smoothstep(whiteCoreFeatherStart, whiteCoreFeatherEnd, roundDistance);
  float whiteCoreDissolve = mix(1.0, 0.16, pow(whiteCoreBlur, 1.15));
  float whiteCore = step(0.0005, whiteCoreRadius) * whiteCoreStrength * mix(
    whiteCoreSharpMask,
    whiteCoreBlurMask * whiteCoreDissolve,
    whiteCoreBlur
  );
  float whiteCoreColourBlur = step(0.0005, whiteCoreRadius) * whiteCoreStrength * whiteCoreBlur * (1.0 - whiteCore) * (1.0 - smoothstep(
    0.0,
    whiteCoreFeatherEnd,
    roundDistance
  ));
  // Size sets the nominal white mask. Blur now actually dissipates that mask,
  // turning it into coloured energy instead of leaving a fixed crisp dot.
  float haloSpan = max(0.5 - coreRadius, 0.001);
  float outsideCore = smoothstep(coreRadius - coreEdge, coreRadius + coreEdge, roundDistance);
  // Star glow radius controls the close bloom attached to the orb; star glow
  // softness slides the falloff from a tight ring to a diffuse bloom.
  float glowRadiusT = clamp(glowSize / 100.0, 0.0, 1.0);
  float glowRadiusOverdrive = clamp((glowSize - 100.0) / 80.0, 0.0, 1.0);
  float glowSoftnessT = clamp(glowSoftness / 100.0, 0.0, 1.0);
  float glowSoftnessOverdrive = clamp((glowSoftness - 100.0) / 100.0, 0.0, 1.0);
  float closeGlowRadius = coreRadius + haloSpan * mix(0.18, mix(0.96, 1.18, glowRadiusOverdrive), glowRadiusT);
  float closeGlowFalloff = mix(28.0, mix(0.08, 0.018, glowSoftnessOverdrive), pow(glowSoftnessT, 1.24));
  float closeGlowDistance = roundDistance / max(closeGlowRadius, 0.001);
  float headGlow = exp(-closeGlowDistance * closeGlowDistance * closeGlowFalloff);
  float closeGlowClipStart = min(closeGlowRadius, 0.5);
  float closeGlowClipEnd = min(0.5, closeGlowClipStart + coreEdge * mix(4.0, 7.0, glowRadiusOverdrive));
  headGlow *= 1.0 - smoothstep(closeGlowClipStart, max(closeGlowClipStart + 0.0001, closeGlowClipEnd), roundDistance);
  headGlow *= mix(0.22, 1.0, outsideCore);
  headGlow *= smoothstep(0.0, 0.05, glowRadiusT);
  float spriteDistance = roundDistance / 0.5;
  float glowOpacityT = clamp(glowOpacityFalloff / 100.0, 0.0, 1.0);
  float glowOpacityOverdrive = clamp((glowOpacityFalloff - 100.0) / 100.0, 0.0, 1.0);
  float glowEdgeStart = mix(0.98, mix(0.48, 0.28, glowOpacityOverdrive), glowOpacityT);
  float glowEdgeFade = 1.0 - smoothstep(glowEdgeStart, 1.0, spriteDistance);
  headGlow *= glowEdgeFade;
  headGlow *= glowT;
  // Halos overlap heavily mid-zoom and stack into a smear under additive
  // blending, so the halo (never the body) fades back with distance.
  headGlow *= mix(0.55, 1.0, vZoomAtten);
  // Background glow: a broad coloured wash behind the whole star. It uses the
  // sprite room created by the background-glow size control, so it can produce
  // a large diffused orb without enlarging the white core.
  float backgroundGlowSize = clamp(glowPadding / 300.0, 0.0, 1.0);
  float backgroundRoom = smoothstep(0.0, 0.28, 0.5 - coreRadius) * smoothstep(0.0, 0.03, backgroundGlowSize);
  float backgroundDistance = spriteDistance;
  float backgroundBlurT = clamp(backgroundGlowSoftness / 100.0, 0.0, 1.0);
  float backgroundFalloff = mix(30.0, 0.035, pow(backgroundBlurT, 1.32));
  backgroundFalloff *= mix(1.0, 0.72, backgroundGlowSize);
  float backgroundGlow = exp(-backgroundDistance * backgroundDistance * backgroundFalloff);
  float backgroundOpacityT = clamp(backgroundGlowOpacityFalloff / 100.0, 0.0, 1.0);
  float backgroundOpacityOverdrive = clamp((backgroundGlowOpacityFalloff - 100.0) / 50.0, 0.0, 1.0);
  float backgroundEdgeStart = mix(0.99, mix(0.34, 0.18, backgroundOpacityOverdrive), backgroundOpacityT);
  float backgroundEdgeFade = 1.0 - smoothstep(backgroundEdgeStart, 1.0, backgroundDistance);
  backgroundGlow *= backgroundRoom * backgroundEdgeFade * clamp(glowBlur / 100.0, 0.0, 1.0);
  backgroundGlow *= mix(0.55, 1.0, vZoomAtten);

  vec3 whiteHot = vec3(1.0, 0.94, 0.78);
  vec3 sparkColor = mix(vColor, whiteHot, hotInner * 0.46 * (1.0 - isAngular) * (1.0 - isHead));
  vec3 headSparkColor = mix(vColor, vec3(1.0), whiteCore);
  sparkColor = mix(sparkColor, headSparkColor, isHead);
  float sparkIntensity = mix(
    roundCore * 1.0 + softHalo * 0.26 + rimSpark * 0.07,
    squareBody * 1.15,
    isSquare
  );
  sparkIntensity = mix(sparkIntensity, triangleBody * 1.08, isTriangle);
  float headHaloIntensity = headGlow * (0.46 + headGlowStrength * 0.16) + backgroundGlow * 1.25 + whiteCoreColourBlur * 1.15;
  sparkIntensity = mix(
    sparkIntensity,
    (headCoreShaped * coreGain + headHaloIntensity) * vHeadSizeAtten,
    isHead
  );
  float sparkAlpha = mix(roundCore * 0.82 + softHalo * 0.22, squareBody * 0.9, isSquare);
  sparkAlpha = mix(sparkAlpha, triangleBody * 0.86, isTriangle);
  float headAlpha = (headCoreAlpha + headGlow * (0.22 + headGlowStrength * 0.07) + backgroundGlow * 0.72 + whiteCoreColourBlur * 0.65) * vHeadSizeAtten;
  sparkAlpha = mix(sparkAlpha, clamp(headAlpha, 0.0, 1.0), isHead);
  // Distance attenuation: full strength on dense squares, gentle on rounds,
  // none on heads so zoomed-out bursts keep their clearly visible orbs.
  float zoomAtten = mix(mix(sqrt(vZoomAtten), vZoomAtten, isAngular), 1.0, isHead);
  float alpha = clamp(sparkAlpha * vDepthFade * zoomAtten, 0.0, 1.0);
  float intensity = sparkIntensity;

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(sparkColor * intensity, alpha);
}
`;

export const HEAD_BILLBOARD_VERTEX_SHADER = /* glsl */ `
uniform float glowPadding;
uniform float whiteCoreSizePercent;
uniform vec2 viewport;
attribute vec2 quadCorner;
attribute vec3 instancePosition;
attribute vec3 instanceColor;
attribute float instanceSize;
attribute float instanceShape;
varying vec2 vSpriteCoord;
varying vec3 vColor;
varying float vDepthFade;
varying float vZoomAtten;
varying float vHeadCoreRadius;
varying float vHeadWhiteCoreRadius;
varying float vHeadGlowStrength;
varying float vHeadSizeAtten;

void main() {
  vSpriteCoord = quadCorner * 0.5 + vec2(0.5);
  vColor = instanceColor;
  vec4 mvPosition = modelViewMatrix * vec4(instancePosition, 1.0);
  float depth = max(-mvPosition.z, 1.0);
  float linearScale = 500.0 / depth;
  float distanceScale = pow(linearScale, 0.55);
  float backgroundGlowScale = clamp(glowPadding / 100.0, 0.0, 3.0);
  float maxCoreSize = 1280.0 / max(1.0 + backgroundGlowScale * 2.0, 1.0);
  float coreSize = clamp(instanceSize * distanceScale, 4.0, maxCoreSize);
  float haloPad = coreSize * backgroundGlowScale;
  float pointSize = clamp(coreSize + haloPad * 2.0, 4.0, 1280.0);
  float headCoreRadius = coreSize / max(pointSize * 2.0, 0.0001);
  vHeadCoreRadius = headCoreRadius;
  float whiteCoreVisualRadius = headCoreRadius * clamp(whiteCoreSizePercent / 100.0, 0.0, 1.0);
  vHeadWhiteCoreRadius = min(
    whiteCoreVisualRadius,
    headCoreRadius
  );
  vHeadGlowStrength = clamp(max(instanceShape - 2.0, 0.0) * 4.0, 0.0, 3.0);
  vHeadSizeAtten = clamp(pow(16.0 / max(instanceSize, 1.0), 0.38), 0.58, 1.22);
  vDepthFade = smoothstep(6200.0, 800.0, -mvPosition.z);
  vZoomAtten = pow(clamp(linearScale, 0.0, 1.0), 0.5);

  vec4 clipPosition = projectionMatrix * mvPosition;
  vec2 pixelOffset = quadCorner * pointSize * 0.5;
  vec2 clipOffset = pixelOffset * 2.0 / max(viewport, vec2(1.0)) * clipPosition.w;
  clipPosition.xy += clipOffset;
  gl_Position = clipPosition;
}
`;

export const HEAD_BILLBOARD_FRAGMENT_SHADER = /* glsl */ `
uniform float glowPadding;
uniform float whiteCoreBlurPercent;
uniform float coreSoftness;
uniform float coreBrightness;
uniform float coreOpacityFalloff;
uniform float glowSize;
uniform float glowSoftness;
uniform float glowOpacityFalloff;
uniform float glowBlur;
uniform float backgroundGlowOpacityFalloff;
uniform float backgroundGlowSoftness;
varying vec2 vSpriteCoord;
varying vec3 vColor;
varying float vDepthFade;
varying float vZoomAtten;
varying float vHeadCoreRadius;
varying float vHeadWhiteCoreRadius;
varying float vHeadGlowStrength;
varying float vHeadSizeAtten;

void main() {
  vec2 centered = vSpriteCoord - vec2(0.5);
  float roundDistance = length(centered);
  if (roundDistance > 0.5) discard;

  float headGlowStrength = clamp(vHeadGlowStrength, 0.0, 3.0);
  float glowT = headGlowStrength / 3.0;
  float coreRadius = clamp(vHeadCoreRadius, 0.001, 0.5);
  float coreEdge = max(fwidth(roundDistance) * 1.5, 0.0015);
  float headCore = 1.0 - smoothstep(coreRadius - coreEdge, coreRadius + coreEdge, roundDistance);
  // Exemplar-style soft core (mirrors the point-sprite path): softness slides
  // the falloff inward so the disc reads as a smoothly glowing orb.
  float coreSoft = clamp(coreSoftness / 100.0, 0.0, 1.0);
  float coreSoftOverdrive = clamp((coreSoftness - 100.0) / 10.0, 0.0, 1.0);
  float coreGain = clamp(coreBrightness / 100.0, 0.0, 3.0);
  float coreBlurT = pow(coreSoft, 1.08);
  float softCoreRadius = max(coreRadius * mix(0.92, mix(0.56, 0.48, coreSoftOverdrive), coreBlurT), 0.001);
  float softCoreFalloff = mix(0.45, mix(2.35, 2.8, coreSoftOverdrive), coreBlurT);
  float softCore = exp(-pow(roundDistance / softCoreRadius, 2.0) * softCoreFalloff);
  softCore = pow(softCore, mix(0.9, 1.1, coreBlurT));
  float headCoreShaped = mix(headCore, softCore, coreSoft);
  float coreOpacityT = clamp(coreOpacityFalloff / 100.0, 0.0, 1.0);
  float coreOpacityOverdrive = clamp((coreOpacityFalloff - 100.0) / 20.0, 0.0, 1.0);
  float headCoreAlpha = mix(headCore, headCoreShaped, coreOpacityT);
  headCoreAlpha *= mix(1.0, 0.82, coreOpacityOverdrive);
  float whiteCoreRadius = clamp(vHeadWhiteCoreRadius, 0.0, coreRadius);
  float whiteCoreBlur = clamp(whiteCoreBlurPercent / 100.0, 0.0, 1.0);
  float whiteCoreEdge = max(fwidth(roundDistance) * 1.25, 0.0015);
  float whiteCoreSizeT = whiteCoreRadius / max(coreRadius, 0.001);
  float whiteCoreStrength = smoothstep(0.0, 0.08, whiteCoreSizeT);
  float whiteCoreBlurWidth = max(whiteCoreRadius * 1.85, coreRadius * 0.01) * pow(whiteCoreBlur, 1.05);
  float whiteCoreFeatherStart = max(whiteCoreRadius - whiteCoreBlurWidth * 0.5, 0.0);
  float whiteCoreFeatherEnd = min(coreRadius, whiteCoreRadius + max(whiteCoreBlurWidth, whiteCoreEdge));
  float whiteCoreSharpMask = 1.0 - step(whiteCoreRadius, roundDistance);
  float whiteCoreBlurMask = 1.0 - smoothstep(whiteCoreFeatherStart, whiteCoreFeatherEnd, roundDistance);
  float whiteCoreDissolve = mix(1.0, 0.16, pow(whiteCoreBlur, 1.15));
  float whiteCore = step(0.0005, whiteCoreRadius) * whiteCoreStrength * mix(
    whiteCoreSharpMask,
    whiteCoreBlurMask * whiteCoreDissolve,
    whiteCoreBlur
  );
  float whiteCoreColourBlur = step(0.0005, whiteCoreRadius) * whiteCoreStrength * whiteCoreBlur * (1.0 - whiteCore) * (1.0 - smoothstep(
    0.0,
    whiteCoreFeatherEnd,
    roundDistance
  ));
  float haloSpan = max(0.5 - coreRadius, 0.001);
  float outsideCore = smoothstep(coreRadius - coreEdge, coreRadius + coreEdge, roundDistance);
  float glowRadiusT = clamp(glowSize / 100.0, 0.0, 1.0);
  float glowRadiusOverdrive = clamp((glowSize - 100.0) / 80.0, 0.0, 1.0);
  float glowSoftnessT = clamp(glowSoftness / 100.0, 0.0, 1.0);
  float glowSoftnessOverdrive = clamp((glowSoftness - 100.0) / 100.0, 0.0, 1.0);
  float closeGlowRadius = coreRadius + haloSpan * mix(0.18, mix(0.96, 1.18, glowRadiusOverdrive), glowRadiusT);
  float closeGlowFalloff = mix(28.0, mix(0.08, 0.018, glowSoftnessOverdrive), pow(glowSoftnessT, 1.24));
  float closeGlowDistance = roundDistance / max(closeGlowRadius, 0.001);
  float headGlow = exp(-closeGlowDistance * closeGlowDistance * closeGlowFalloff);
  float closeGlowClipStart = min(closeGlowRadius, 0.5);
  float closeGlowClipEnd = min(0.5, closeGlowClipStart + coreEdge * mix(4.0, 7.0, glowRadiusOverdrive));
  headGlow *= 1.0 - smoothstep(closeGlowClipStart, max(closeGlowClipStart + 0.0001, closeGlowClipEnd), roundDistance);
  headGlow *= mix(0.22, 1.0, outsideCore);
  headGlow *= smoothstep(0.0, 0.05, glowRadiusT);
  float spriteDistance = roundDistance / 0.5;
  float glowOpacityT = clamp(glowOpacityFalloff / 100.0, 0.0, 1.0);
  float glowOpacityOverdrive = clamp((glowOpacityFalloff - 100.0) / 100.0, 0.0, 1.0);
  float glowEdgeStart = mix(0.98, mix(0.48, 0.28, glowOpacityOverdrive), glowOpacityT);
  float glowEdgeFade = 1.0 - smoothstep(glowEdgeStart, 1.0, spriteDistance);
  headGlow *= glowEdgeFade;
  headGlow *= glowT;
  headGlow *= mix(0.55, 1.0, vZoomAtten);
  // Background glow (mirrors the point-sprite path): broad coloured wash behind
  // the whole star, sized by the sprite room from the background-glow control.
  float backgroundGlowSize = clamp(glowPadding / 300.0, 0.0, 1.0);
  float backgroundRoom = smoothstep(0.0, 0.28, 0.5 - coreRadius) * smoothstep(0.0, 0.03, backgroundGlowSize);
  float backgroundDistance = spriteDistance;
  float backgroundBlurT = clamp(backgroundGlowSoftness / 100.0, 0.0, 1.0);
  float backgroundFalloff = mix(30.0, 0.035, pow(backgroundBlurT, 1.32));
  backgroundFalloff *= mix(1.0, 0.72, backgroundGlowSize);
  float backgroundGlow = exp(-backgroundDistance * backgroundDistance * backgroundFalloff);
  float backgroundOpacityT = clamp(backgroundGlowOpacityFalloff / 100.0, 0.0, 1.0);
  float backgroundOpacityOverdrive = clamp((backgroundGlowOpacityFalloff - 100.0) / 50.0, 0.0, 1.0);
  float backgroundEdgeStart = mix(0.99, mix(0.34, 0.18, backgroundOpacityOverdrive), backgroundOpacityT);
  float backgroundEdgeFade = 1.0 - smoothstep(backgroundEdgeStart, 1.0, backgroundDistance);
  backgroundGlow *= backgroundRoom * backgroundEdgeFade * clamp(glowBlur / 100.0, 0.0, 1.0);
  backgroundGlow *= mix(0.55, 1.0, vZoomAtten);

  float intensity = (headCoreShaped * coreGain + headGlow * (0.46 + headGlowStrength * 0.16) + backgroundGlow * 1.25 + whiteCoreColourBlur * 1.15) * vHeadSizeAtten;
  float alpha = clamp((headCoreAlpha + headGlow * (0.22 + headGlowStrength * 0.07) + backgroundGlow * 0.72 + whiteCoreColourBlur * 0.65) * vHeadSizeAtten * vDepthFade, 0.0, 1.0);
  if (alpha < 0.01) discard;
  vec3 headSparkColor = mix(vColor, vec3(1.0), whiteCore);
  gl_FragColor = vec4(headSparkColor * intensity, alpha);
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
