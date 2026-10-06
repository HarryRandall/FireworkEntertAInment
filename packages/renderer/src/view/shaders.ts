/** Point, billboard and smoke shaders calibrated to the renderer prototype. */

export const pointVertex = `
// Prototype visual tuning: safe depth m (metres).
const float SAFE_DEPTH_M = 0.1;
// Prototype visual tuning: spark cap px (CSS pixels).
const float SPARK_CAP_PX = 8.0;
// Prototype visual tuning: subpixel alpha floor (normalised shader units).
const float SUBPIXEL_ALPHA_FLOOR = 0.02;

attribute float size; attribute float alpha; attribute vec3 color;
uniform float uScale; uniform float uDpr;
varying vec3 vColor; varying float vAlpha; varying float vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = size * uScale / max(SAFE_DEPTH_M, -mv.z);
  // Sparks stay readable up close (up to 8 px). Below one pixel they keep a pixel and dim by
  // area, so distant trails are as bright as they should be rather than inflated.
  float minPx = uDpr;
  gl_PointSize = clamp(px, minPx, SPARK_CAP_PX * uDpr);
  vPx = gl_PointSize / uDpr;
  vAlpha = alpha * clamp((px * px) / (minPx * minPx), SUBPIXEL_ALPHA_FLOOR, 1.0);
  vColor = color;
}`;

export const pointFragment = `
// Prototype visual tuning: colour gain (normalised shader units).
const float COLOUR_GAIN = 1.2;
// Prototype visual tuning: square transition px (CSS pixels).
const float SQUARE_TRANSITION_PX = 2.5;
// Prototype visual tuning: round body radius (normalised shader units).
const float ROUND_BODY_RADIUS = 0.1;
// Prototype visual tuning: square body radius (normalised shader units).
const float SQUARE_BODY_RADIUS = 0.7;
// Prototype visual tuning: core radius (normalised shader units).
const float CORE_RADIUS = 0.45;
// Prototype visual tuning: spark white mix (normalised shader units).
const float SPARK_WHITE_MIX = 0.15;
// Prototype visual tuning: spark alpha cutoff (normalised shader units).
const float SPARK_ALPHA_CUTOFF = 0.002;

// Prototype square transition starts at 1.2 CSS pixels.
const float SQUARE_START_PX = 1.2;
varying vec3 vColor; varying float vAlpha; varying float vPx;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float a; vec3 col = vColor;
  {
    // Hard-edged squares from just over a pixel, as we draw them; only the tiniest sparks stay
    // round and soft.
    float s = smoothstep(SQUARE_START_PX, SQUARE_TRANSITION_PX, vPx);
    float sq = max(abs(c.x), abs(c.y));
    float q = mix(r, sq, s);
    float body = 1.0 - smoothstep(mix(ROUND_BODY_RADIUS, SQUARE_BODY_RADIUS, s), 1.0, q);
    col = mix(vColor * COLOUR_GAIN, vec3(1.0), (1.0 - smoothstep(0.0, CORE_RADIUS, q)) * SPARK_WHITE_MIX);
    a = body * vAlpha;
  }
  if (a < SPARK_ALPHA_CUTOFF) discard;
  gl_FragColor = vec4(col * a, a);
}`;

export const quadVertex = `
// Prototype visual tuning: safe depth m (metres).
const float SAFE_DEPTH_M = 0.1;
// Prototype visual tuning: glow floor px (CSS pixels).
const float GLOW_FLOOR_PX = 3.0;
// Prototype visual tuning: safe pixel divisor (normalised shader units).
const float SAFE_PIXEL_DIVISOR = 0.001;
// Prototype visual tuning: halo shape threshold (normalised shader units).
const float HALO_SHAPE_THRESHOLD = 1.5;
// Prototype visual tuning: halo cap px (CSS pixels).
const float HALO_CAP_PX = 96.0;
// Prototype visual tuning: head shape threshold (normalised shader units).
const float HEAD_SHAPE_THRESHOLD = 0.5;
// Prototype visual tuning: head cap px (CSS pixels).
const float HEAD_CAP_PX = 40.0;
// Prototype visual tuning: uncapped glow px (CSS pixels).
const float UNCAPPED_GLOW_PX = 1.0e6;

attribute vec3 iPos; attribute vec3 iColor; attribute float iSize; attribute float iAlpha; attribute float iShape;
uniform float uScale; uniform float uDpr;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  // Keep glows at least a few pixels wide; below that, fade by area instead of shrinking to nothing.
  float px = 2.0 * iSize * uScale / max(SAFE_DEPTH_M, -mv.z);
  float minPx = GLOW_FLOOR_PX * uDpr;
  float grow = max(1.0, minPx / max(px, SAFE_PIXEL_DIVISOR));
  // Star heads and their halos keep a pixel limit, so heads stay small and bright up close
  // instead of swelling into soft blobs. Flashes and smoke (shape 0) have none.
  // Heads stop at 40 px and halos at 96 px: large enough that zooming in still enlarges them
  // well past their trail sparks (8 px), small enough that they never swell into soft discs.
  float maxPx = (iShape > HALO_SHAPE_THRESHOLD ? HALO_CAP_PX : iShape > HEAD_SHAPE_THRESHOLD ? HEAD_CAP_PX : UNCAPPED_GLOW_PX) * uDpr;
  float shrink = min(1.0, maxPx / max(px, SAFE_PIXEL_DIVISOR));
  mv.xy += position.xy * iSize * 2.0 * grow * shrink;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0; vColor = iColor; vShape = iShape;
  vPx = px * grow * shrink / uDpr;
  vAlpha = iAlpha / (grow * grow);
}`;

export const quadFragment = `
// Prototype visual tuning: halo shape threshold (normalised shader units).
const float HALO_SHAPE_THRESHOLD = 1.5;
// Prototype visual tuning: halo falloff (normalised shader units).
const float HALO_FALLOFF = 5.0;
// Prototype visual tuning: dark hue luma (normalised shader units).
const float DARK_HUE_LUMA = 0.08;
// Prototype visual tuning: bright hue luma (normalised shader units).
const float BRIGHT_HUE_LUMA = 0.6;
// Rec. 709 linear luminance coefficient: luma red (normalised shader units).
const float LUMA_RED = 0.2126;
// Rec. 709 linear luminance coefficient: luma green (normalised shader units).
const float LUMA_GREEN = 0.7152;
// Rec. 709 linear luminance coefficient: luma blue (normalised shader units).
const float LUMA_BLUE = 0.0722;
// Prototype visual tuning: safe luma divisor (normalised shader units).
const float SAFE_LUMA_DIVISOR = 1e-3;
// Prototype visual tuning: warm halo green (normalised shader units).
const float WARM_HALO_GREEN = 0.86;
// Prototype visual tuning: warm halo blue (normalised shader units).
const float WARM_HALO_BLUE = 0.62;
// Prototype visual tuning: warm halo mix (normalised shader units).
const float WARM_HALO_MIX = 0.3;
// Prototype visual tuning: colour gain (normalised shader units).
const float COLOUR_GAIN = 1.2;
// Prototype visual tuning: head shape threshold (normalised shader units).
const float HEAD_SHAPE_THRESHOLD = 0.5;
// Prototype visual tuning: core start px (CSS pixels).
const float CORE_START_PX = 4.0;
// Prototype visual tuning: core full px (CSS pixels).
const float CORE_FULL_PX = 10.0;
// Prototype visual tuning: core min gain (normalised shader units).
const float CORE_MIN_GAIN = 0.85;
// Prototype visual tuning: large core start px (CSS pixels).
const float LARGE_CORE_START_PX = 16.0;
// Prototype visual tuning: large core full px (CSS pixels).
const float LARGE_CORE_FULL_PX = 32.0;
// Prototype visual tuning: core radius (normalised shader units).
const float CORE_RADIUS = 0.45;
// Prototype visual tuning: core radius start px (CSS pixels).
const float CORE_RADIUS_START_PX = 8.0;
// Prototype visual tuning: head glow power (normalised shader units).
const float HEAD_GLOW_POWER = 2.6;
// Prototype visual tuning: head body gain (normalised shader units).
const float HEAD_BODY_GAIN = 1.25;
// Prototype visual tuning: dark hue gain (normalised shader units).
const float DARK_HUE_GAIN = 1.4;
// Prototype visual tuning: head white mix (normalised shader units).
const float HEAD_WHITE_MIX = 0.75;
// Prototype visual tuning: core alpha gain (normalised shader units).
const float CORE_ALPHA_GAIN = 0.9;
// Prototype visual tuning: glow alpha gain (normalised shader units).
const float GLOW_ALPHA_GAIN = 0.55;
// Prototype visual tuning: quad alpha cutoff (normalised shader units).
const float QUAD_ALPHA_CUTOFF = 0.00002;

// Prototype head core radius and dark-hue whitening fraction (normalised).
const float SMALL_CORE_RADIUS = 0.3, DARK_CORE_MIX = 0.45;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vPx;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec3 col = vColor; float a;
  if (vShape > HALO_SHAPE_THRESHOLD) {
    // Head halo: a smooth gaussian falloff.
    a = exp(-r * r * HALO_FALLOFF) * (1.0 - r) * vAlpha;
    float lum = smoothstep(DARK_HUE_LUMA, BRIGHT_HUE_LUMA, dot(vColor, vec3(LUMA_RED, LUMA_GREEN, LUMA_BLUE)) / max(max(vColor.r, vColor.g), max(vColor.b, SAFE_LUMA_DIVISOR)));
    col = mix(vColor, vec3(1.0, WARM_HALO_GREEN, WARM_HALO_BLUE), WARM_HALO_MIX * lum) * COLOUR_GAIN;
  } else if (vShape > HEAD_SHAPE_THRESHOLD) {
    // Star head: a white-hot core inside a saturated halo. The core fades out and widens as the
    // head gets small on screen, so distant stars keep their colour.
    float k = smoothstep(CORE_START_PX, CORE_FULL_PX, vPx) * mix(CORE_MIN_GAIN, 1.0, smoothstep(LARGE_CORE_START_PX, LARGE_CORE_FULL_PX, vPx));
    float core = smoothstep(mix(CORE_RADIUS, SMALL_CORE_RADIUS, smoothstep(CORE_RADIUS_START_PX, LARGE_CORE_FULL_PX, vPx)), 0.0, r);
    float glow = pow(1.0 - r, HEAD_GLOW_POWER);
    // Dark hues (blue, purple, deep red) get a brighter body and less white core, so they
    // stay saturated instead of washing out to lavender.
    float lum = smoothstep(DARK_HUE_LUMA, BRIGHT_HUE_LUMA, dot(vColor, vec3(LUMA_RED, LUMA_GREEN, LUMA_BLUE)) / max(max(vColor.r, vColor.g), max(vColor.b, SAFE_LUMA_DIVISOR)));
    col = mix(vColor * HEAD_BODY_GAIN * mix(DARK_HUE_GAIN, 1.0, lum), vec3(1.0), core * HEAD_WHITE_MIX * k * mix(DARK_CORE_MIX, 1.0, lum));
    a = (core * CORE_ALPHA_GAIN + glow * GLOW_ALPHA_GAIN) * vAlpha;
  } else {
    // Flashes and glows. sRGB output is steep near black, so a linear-space gaussian shows as a
    // disc with a rim; (1 - r^2)^5 is roughly (1 - r^2)^2 after encoding, a soft edge on screen.
    float f = 1.0 - r * r;
    a = f * f * f * f * f * vAlpha;
  }
  // Discard only near zero: sRGB encoding would turn a larger cut-off into a visible rim.
  if (a < QUAD_ALPHA_CUTOFF) discard;
  gl_FragColor = vec4(col * a, a);
}`;

export const smokeVertex = `
// Prototype visual tuning: full turn rad (radians).
const float FULL_TURN_RAD = 6.2832;
// Prototype visual tuning: rotation age rate (radians per second).
const float ROTATION_AGE_RATE = 0.08;

attribute vec3 iPos; attribute vec3 iColor; attribute float iSize; attribute float iAlpha; attribute vec2 iSeed;
varying vec2 vUv; varying vec3 vC; varying float vA; varying vec2 vS;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float r = iSeed.x * FULL_TURN_RAD + iSeed.y * ROTATION_AGE_RATE;
  vec2 p = mat2(cos(r), sin(r), -sin(r), cos(r)) * position.xy;
  mv.xy += p * iSize * 2.0;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.0; vC = iColor; vA = iAlpha; vS = iSeed;
}`;

export const smokeFragment = `
// Prototype visual tuning: noise hash x (dimensionless noise coordinates).
const float NOISE_HASH_X = 127.1;
// Prototype visual tuning: noise hash y (dimensionless noise coordinates).
const float NOISE_HASH_Y = 311.7;
// Prototype visual tuning: noise hash gain (dimensionless noise coordinates).
const float NOISE_HASH_GAIN = 43758.5453;
// Prototype visual tuning: hermite cubic (normalised shader units).
const float HERMITE_CUBIC = 3.0;
// Prototype visual tuning: octave decay (normalised shader units).
const float OCTAVE_DECAY = 0.5;
// Prototype visual tuning: noise octave scale (dimensionless noise coordinates).
const float NOISE_OCTAVE_SCALE = 2.02;
// Prototype visual tuning: noise octave offset (dimensionless noise coordinates).
const float NOISE_OCTAVE_OFFSET = 11.3;
// Prototype visual tuning: seed offset x (dimensionless noise coordinates).
const float SEED_OFFSET_X = 7.31;
// Prototype visual tuning: seed offset range (dimensionless noise coordinates).
const float SEED_OFFSET_RANGE = 40.0;
// Prototype visual tuning: seed offset y (dimensionless noise coordinates).
const float SEED_OFFSET_Y = 3.17;
// Prototype visual tuning: puff noise scale (normalised shader units).
const float PUFF_NOISE_SCALE = 1.6;
// Prototype visual tuning: warp spatial scale (normalised shader units).
const float WARP_SPATIAL_SCALE = 0.7;
// Prototype visual tuning: puff warp speed (noise coordinates per second).
const float PUFF_WARP_SPEED = 0.12;
// Prototype visual tuning: warp displacement (normalised shader units).
const float WARP_DISPLACEMENT = 1.4;
// Prototype visual tuning: puff drift speed (noise coordinates per second).
const float PUFF_DRIFT_SPEED = 0.18;
// Prototype visual tuning: puff edge start (normalised shader units).
const float PUFF_EDGE_START = 0.2;
// Prototype visual tuning: puff density start (normalised shader units).
const float PUFF_DENSITY_START = 0.3;
// Prototype visual tuning: puff density end (normalised shader units).
const float PUFF_DENSITY_END = 0.8;
// Prototype visual tuning: noise density gain (normalised shader units).
const float NOISE_DENSITY_GAIN = 0.9;
// Prototype visual tuning: edge density gain (normalised shader units).
const float EDGE_DENSITY_GAIN = 0.55;
// Prototype visual tuning: smoke alpha cutoff (normalised shader units).
const float SMOKE_ALPHA_CUTOFF = 0.002;
// Prototype visual tuning: base shade (normalised shader units).
const float BASE_SHADE = 0.75;
// Prototype smoke noise quality: four spatial octaves.
const int NOISE_OCTAVES = 4;

varying vec2 vUv; varying vec3 vC; varying float vA; varying vec2 vS;
float h21(vec2 p) { return fract(sin(dot(p, vec2(NOISE_HASH_X, NOISE_HASH_Y))) * NOISE_HASH_GAIN); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (HERMITE_CUBIC - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = OCTAVE_DECAY; for (int i = 0; i < NOISE_OCTAVES; i++) { s += a * vnoise(p); p = p * NOISE_OCTAVE_SCALE + NOISE_OCTAVE_OFFSET; a *= OCTAVE_DECAY; } return s; }
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  vec2 o = vec2(fract(vS.x * SEED_OFFSET_X) * SEED_OFFSET_RANGE, fract(vS.x * SEED_OFFSET_Y) * SEED_OFFSET_RANGE);
  vec2 p = vUv * PUFF_NOISE_SCALE + o;
  float w = fbm(p * WARP_SPATIAL_SCALE + vec2(0.0, vS.y * PUFF_WARP_SPEED));
  float n = fbm(p + w * WARP_DISPLACEMENT - vec2(0.0, vS.y * PUFF_DRIFT_SPEED));
  float edge = 1.0 - smoothstep(PUFF_EDGE_START, 1.0, r);
  float d = smoothstep(PUFF_DENSITY_START, PUFF_DENSITY_END, n * NOISE_DENSITY_GAIN + edge * EDGE_DENSITY_GAIN) * edge;
  float a = d * vA;
  if (a < SMOKE_ALPHA_CUTOFF) discard;
  gl_FragColor = vec4(vC * (BASE_SHADE + OCTAVE_DECAY * n), a);
}`;
