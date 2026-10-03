/** Audits the live GLSL polynomial expressions with binary32 arithmetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceTrigonometryKernel } from '../src/view/source-trigonometry-kernel.ts';

const round = Math.fround;
const literal = (name) =>
  round(Number(sourceTrigonometryKernel.match(new RegExp(`const float ${name} = ([^;]+);`))[1]));
// Interpret the live Horner expressions, rounding every multiply/add as highp Float32.
function expression(name) {
  const source = sourceTrigonometryKernel.match(new RegExp(`float ${name} = ([^;]+);`))[1];
  const tokens = source.match(/(?:\d+(?:\.\d*)?(?:e[+-]?\d+)?)|[a-z]+|[()+*-]/g);
  let cursor = 0;
  function primary() {
    const token = tokens[cursor++];
    if (token === '-') {
      const value = primary();
      return (variables) => -value(variables);
    }
    if (token === '(') {
      const value = addition();
      assert.equal(tokens[cursor++], ')');
      return value;
    }
    if (/^[a-z]/.test(token)) return (variables) => variables[token];
    return () => round(Number(token));
  }
  function multiplication() {
    let left = primary();
    while (tokens[cursor] === '*') {
      cursor++;
      const previous = left;
      const right = primary();
      left = (variables) => round(previous(variables) * right(variables));
    }
    return left;
  }
  function addition() {
    let left = multiplication();
    while (tokens[cursor] === '+') {
      cursor++;
      const previous = left;
      const right = multiplication();
      left = (variables) => round(previous(variables) + right(variables));
    }
    return left;
  }
  const evaluate = addition();
  assert.equal(cursor, tokens.length);
  return evaluate;
}
const sine = expression('sine');
const cosine = expression('cosine');
function pair(angle) {
  const quadrant = Math.floor(round(round(angle * literal('INVERSE_HALF_PI_PER_RAD')) + 0.5));
  const reduced = round(
    round(angle - round(quadrant * literal('HALF_PI_HIGH_RAD'))) -
      round(quadrant * literal('HALF_PI_LOW_RAD')),
  );
  const variables = { reduced, squared: round(reduced * reduced) };
  const sin = sine(variables);
  const cos = cosine(variables);
  return [
    [sin, cos],
    [cos, -sin],
    [-sin, -cos],
    [-cos, sin],
  ][quadrant & 3];
}

test('source trig preserves signed angles and quadrant boundaries with Float32 operations', (context) => {
  // Radian sweep spans many turns beyond uploaded phase anchors and local advances.
  // Absolute 2e-7 bound is under two binary32 ulps at unit amplitude.
  let worst = 0;
  for (let index = -100000; index <= 100000; index++) {
    const angle = round(index / 1000);
    const actual = pair(angle);
    worst = Math.max(
      worst,
      Math.abs(actual[0] - Math.sin(angle)),
      Math.abs(actual[1] - Math.cos(angle)),
    );
  }
  for (let quadrant = -64; quadrant <= 64; quadrant++) {
    for (const offset of [-1e-6, 0, 1e-6]) {
      const angle = round((quadrant * Math.PI) / 2 + offset);
      const actual = pair(angle);
      worst = Math.max(
        worst,
        Math.abs(actual[0] - Math.sin(angle)),
        Math.abs(actual[1] - Math.cos(angle)),
      );
    }
  }
  context.diagnostic(`Worst Float32 sine/cosine absolute error: ${worst}`);
  assert.ok(worst < 2e-7);
});
