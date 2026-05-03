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
  // Project: ~size pixels at 1m with pixelRatio=1. Cap to avoid giant blobs when the
  // camera is close — large soft sprites read as a single white disc otherwise.
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
