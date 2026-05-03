import * as THREE from "three";

export type ParticleWrite = {
  origin: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
  spawnTime: number;
  lifetime: number;
  sizeStart: number;
  sizeEnd: number;
  colorStart: [number, number, number];
  colorMid: [number, number, number];
  colorEnd: [number, number, number];
  alphaStart: number;
  alphaMid: number;
  alphaEnd: number;
  drag: number;
  colorTransition: number;
  twinkleFrequency: number;
  twinkleAmount: number;
  strobeFrequency: number;
  strobeDutyCycle: number;
  spinRadius: number;
  spinSpeed: number;
  emissiveIntensity: number;
  alphaCurve: number;
  seed: number;
};

export class ParticlePool {
  readonly geometry: THREE.BufferGeometry;
  readonly capacity: number;
  count = 0;
  private cursor = 0;

  private readonly origin: Float32Array;
  private readonly velocity: Float32Array;
  private readonly acceleration: Float32Array;
  private readonly spawnLifetime: Float32Array;
  private readonly size: Float32Array;
  private readonly colorStart: Float32Array;
  private readonly colorMid: Float32Array;
  private readonly colorEnd: Float32Array;
  private readonly alpha: Float32Array;
  private readonly physics: Float32Array;
  private readonly flicker: Float32Array;
  private readonly motion: Float32Array;
  private readonly transition: Float32Array;
  private readonly seed: Float32Array;

  private readonly attributes: THREE.BufferAttribute[];

  constructor(capacity: number) {
    this.capacity = capacity;
    this.origin = new Float32Array(capacity * 3);
    this.velocity = new Float32Array(capacity * 3);
    this.acceleration = new Float32Array(capacity * 3);
    this.spawnLifetime = new Float32Array(capacity * 2);
    this.size = new Float32Array(capacity * 2);
    this.colorStart = new Float32Array(capacity * 3);
    this.colorMid = new Float32Array(capacity * 3);
    this.colorEnd = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity * 4);
    this.physics = new Float32Array(capacity * 2);
    this.flicker = new Float32Array(capacity * 4);
    this.motion = new Float32Array(capacity * 2);
    this.transition = new Float32Array(capacity);
    this.seed = new Float32Array(capacity);

    this.geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(this.origin, 3);
    const velocity = new THREE.BufferAttribute(this.velocity, 3);
    const acceleration = new THREE.BufferAttribute(this.acceleration, 3);
    const spawnLifetime = new THREE.BufferAttribute(this.spawnLifetime, 2);
    const size = new THREE.BufferAttribute(this.size, 2);
    const colorStart = new THREE.BufferAttribute(this.colorStart, 3);
    const colorMid = new THREE.BufferAttribute(this.colorMid, 3);
    const colorEnd = new THREE.BufferAttribute(this.colorEnd, 3);
    const alpha = new THREE.BufferAttribute(this.alpha, 4);
    const physics = new THREE.BufferAttribute(this.physics, 2);
    const flicker = new THREE.BufferAttribute(this.flicker, 4);
    const motion = new THREE.BufferAttribute(this.motion, 2);
    const transition = new THREE.BufferAttribute(this.transition, 1);
    const seed = new THREE.BufferAttribute(this.seed, 1);

    this.geometry.setAttribute("position", position);
    this.geometry.setAttribute("aVelocity", velocity);
    this.geometry.setAttribute("aAcceleration", acceleration);
    this.geometry.setAttribute("aSpawnLifetime", spawnLifetime);
    this.geometry.setAttribute("aSize", size);
    this.geometry.setAttribute("aColorStart", colorStart);
    this.geometry.setAttribute("aColorMid", colorMid);
    this.geometry.setAttribute("aColorEnd", colorEnd);
    this.geometry.setAttribute("aAlpha", alpha);
    this.geometry.setAttribute("aPhysics", physics);
    this.geometry.setAttribute("aFlicker", flicker);
    this.geometry.setAttribute("aMotion", motion);
    this.geometry.setAttribute("aTransition", transition);
    this.geometry.setAttribute("aSeed", seed);
    this.geometry.setDrawRange(0, 0);

    this.attributes = [
      position,
      velocity,
      acceleration,
      spawnLifetime,
      size,
      colorStart,
      colorMid,
      colorEnd,
      alpha,
      physics,
      flicker,
      motion,
      transition,
      seed,
    ];
  }

  clear(): void {
    this.count = 0;
    this.cursor = 0;
    this.geometry.setDrawRange(0, 0);
  }

  write(particle: ParticleWrite): void {
    if (this.capacity <= 0) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.count = Math.min(this.capacity, this.count + 1);

    this.origin.set(particle.origin, i * 3);
    this.velocity.set(particle.velocity, i * 3);
    this.acceleration.set(particle.acceleration, i * 3);
    this.spawnLifetime[i * 2 + 0] = particle.spawnTime;
    this.spawnLifetime[i * 2 + 1] = particle.lifetime;
    this.size[i * 2 + 0] = particle.sizeStart;
    this.size[i * 2 + 1] = particle.sizeEnd;
    this.colorStart.set(particle.colorStart, i * 3);
    this.colorMid.set(particle.colorMid, i * 3);
    this.colorEnd.set(particle.colorEnd, i * 3);
    this.alpha[i * 4 + 0] = particle.alphaStart;
    this.alpha[i * 4 + 1] = particle.alphaMid;
    this.alpha[i * 4 + 2] = particle.alphaEnd;
    this.alpha[i * 4 + 3] = particle.alphaCurve;
    this.physics[i * 2 + 0] = particle.drag;
    this.physics[i * 2 + 1] = particle.emissiveIntensity;
    this.flicker[i * 4 + 0] = particle.twinkleFrequency;
    this.flicker[i * 4 + 1] = particle.twinkleAmount;
    this.flicker[i * 4 + 2] = particle.strobeFrequency;
    this.flicker[i * 4 + 3] = particle.strobeDutyCycle;
    this.motion[i * 2 + 0] = particle.spinRadius;
    this.motion[i * 2 + 1] = particle.spinSpeed;
    this.transition[i] = particle.colorTransition;
    this.seed[i] = particle.seed;
  }

  commit(): void {
    this.geometry.setDrawRange(0, this.count);
    for (const attribute of this.attributes) {
      attribute.needsUpdate = true;
    }
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
