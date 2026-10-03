/** Accurate source angles without relying on driver-specific built-in trigonometry. */
// Radian quadrant reduction: split pi/2 into an exactly representable binary32 high
// part (201/128, so integer multiples stay exact) and its residual. Subtract
// separately to retain bits after cancellation.
const HALF_PI_HIGH_RAD = 1.5703125;
const HALF_PI_LOW_RAD = Math.PI / 2 - HALF_PI_HIGH_RAD;
const INVERSE_HALF_PI_PER_RAD = 2 / Math.PI;
// Taylor coefficients through x^11 for sine and x^10 for cosine on [-pi/4, pi/4].
// The next omitted terms are below 7e-12 and 1.2e-10 respectively on this interval.
const TAYLOR_TERMS = 5;
const SINE_FIRST_POWER = 3;
const COSINE_FIRST_POWER = 2;
const SINE_COEFFICIENTS = taylorCoefficients(SINE_FIRST_POWER);
const COSINE_COEFFICIENTS = taylorCoefficients(COSINE_FIRST_POWER);
function taylorCoefficients(firstPower: number): number[] {
  const coefficients: number[] = [];
  let sign = -1;
  for (let term = 0; term < TAYLOR_TERMS; term++) {
    const power = firstPower + term * 2;
    let factorial = 1;
    for (let factor = 2; factor <= power; factor++) factorial *= factor;
    coefficients.push(sign / factorial);
    sign = -sign;
  }
  return coefficients;
}
function polynomial(coefficients: number[]): string {
  let expression = String(coefficients[coefficients.length - 1]);
  for (let index = coefficients.length - 2; index >= 0; index--) {
    expression = `(${String(coefficients[index])} + squared * ${expression})`;
  }
  return expression;
}
/** GLSL sine/cosine pair for finite source angles in radians; returns (sin, cos).
 * Source anchors reduce large CPU phases before upload. Local angular advances remain
 * Float32; quadrant reduction handles negative angles without signed remainder rules.
 * SwiftShader's native fifth-degree trig error is amplified by metre radii and the
 * CPU reference's 16 ms velocity difference, so both samples use these polynomials. */
export const sourceTrigonometryKernel = `
const float HALF_PI_HIGH_RAD = ${String(HALF_PI_HIGH_RAD)};
const float HALF_PI_LOW_RAD = ${String(HALF_PI_LOW_RAD)};
const float INVERSE_HALF_PI_PER_RAD = ${String(INVERSE_HALF_PI_PER_RAD)};
vec2 sourceSinCos(float angle) {
  float quadrant = floor(angle * INVERSE_HALF_PI_PER_RAD + 0.5);
  float reduced = (angle - quadrant * HALF_PI_HIGH_RAD) - quadrant * HALF_PI_LOW_RAD;
  float squared = reduced * reduced;
  float sine = reduced + reduced * squared * ${polynomial(SINE_COEFFICIENTS)};
  float cosine = 1.0 + squared * ${polynomial(COSINE_COEFFICIENTS)};
  int sector = int(quadrant) & 3;
  if (sector == 0) return vec2(sine, cosine);
  if (sector == 1) return vec2(cosine, -sine);
  if (sector == 2) return vec2(-sine, -cosine);
  return vec2(-cosine, sine);
}
float sourceSin(float angle) { return sourceSinCos(angle).x; }
float sourceCos(float angle) { return sourceSinCos(angle).y; }
`;
