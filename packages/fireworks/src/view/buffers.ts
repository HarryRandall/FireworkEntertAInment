/** Reusable GPU attributes bridge deterministic CPU frames to points and billboards. */
import * as THREE from 'three';
import { ParticleKind, type Particles } from '../sim/index';
import {
  pointVertex,
  pointFragment,
  quadVertex,
  quadFragment,
  smokeVertex,
  smokeFragment,
} from './shaders';

// Initial particle slots and geometric growth factor, chosen to avoid per-frame GPU allocation.
const INITIAL_CAPACITY = 256;
const VECTOR_COMPONENTS = 3;
const SEED_COMPONENTS = 2;
const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
};

/** Owns one points draw, one instanced glow draw and one normal-blended smoke draw. */
export class ParticleLayers {
  readonly group = new THREE.Group();
  readonly uniforms = { uScale: { value: 1 }, uDpr: { value: 1 } };
  private readonly plane = new THREE.PlaneGeometry(1, 1);
  private readonly points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.ShaderMaterial({
      ...additive,
      uniforms: this.uniforms,
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
    }),
  );
  private readonly quads = new THREE.Mesh(
    new THREE.InstancedBufferGeometry(),
    new THREE.ShaderMaterial({
      ...additive,
      uniforms: this.uniforms,
      vertexShader: quadVertex,
      fragmentShader: quadFragment,
    }),
  );
  private readonly smoke = new THREE.Mesh(
    new THREE.InstancedBufferGeometry(),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: smokeVertex,
      fragmentShader: smokeFragment,
    }),
  );

  /** Allocates reusable draw layers; call dispose when their scene is retired. */
  constructor() {
    for (const mesh of [this.quads, this.smoke]) {
      // Each layer owns its base attributes so capacity changes cannot retire another layer's GPU buffers.
      mesh.geometry.index = this.plane.index?.clone() ?? null;
      mesh.geometry.setAttribute('position', this.plane.getAttribute('position').clone());
      mesh.geometry.instanceCount = 0;
    }
    for (const mesh of [this.points, this.quads, this.smoke]) mesh.frustumCulled = false;
    this.smoke.renderOrder = -1;
    this.group.add(this.smoke, this.quads, this.points);
  }

  private attribute(
    geometry: THREE.BufferGeometry,
    name: string,
    data: Float32Array,
    components: number,
    instanced: boolean,
  ): void {
    let attr = geometry.getAttribute(name);
    if (!(attr instanceof THREE.BufferAttribute) || attr.array.length < data.length) {
      const capacity = Math.max(
        INITIAL_CAPACITY,
        2 ** Math.ceil(Math.log2(Math.max(1, data.length / components))),
      );
      // Retiring the old geometry binding frees GPU attributes before a capacity replacement.
      if (attr) geometry.dispose();
      const array = new Float32Array(capacity * components);
      attr = instanced
        ? new THREE.InstancedBufferAttribute(array, components)
        : new THREE.BufferAttribute(array, components);
      attr.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, attr);
    }
    // Upload just the populated prefix; old tail slots are excluded by the draw count.
    attr.array.set(data);
    attr.clearUpdateRanges();
    if (data.length) attr.addUpdateRange(0, data.length);
    attr.needsUpdate = true;
  }

  /** Uploads CPU simulation frames, preserving spark/head/halo/flash and puff identities. */
  upload(frames: readonly Particles[]): void {
    const points: number[] = [],
      quads: number[] = [];
    const source: { frame: Particles; index: number }[] = [];
    for (const frame of frames)
      for (let index = 0; index < frame.kinds.length; index++) {
        const i = source.push({ frame, index }) - 1;
        (frame.kinds[index] === ParticleKind.Spark ? points : quads).push(i);
      }
    for (const [indices, geometry, instanced] of [
      [points, this.points.geometry, false],
      [quads, this.quads.geometry, true],
    ] as const) {
      const position = new Float32Array(indices.length * VECTOR_COMPONENTS),
        colour = new Float32Array(position.length);
      const size = new Float32Array(indices.length),
        alpha = new Float32Array(indices.length),
        shape = new Float32Array(indices.length);
      indices.forEach((i, dest) => {
        const item = source[i];
        if (!item) return;
        const { frame, index } = item;
        position.set(
          frame.positions.subarray(index * VECTOR_COMPONENTS, (index + 1) * VECTOR_COMPONENTS),
          dest * VECTOR_COMPONENTS,
        );
        colour.set(
          frame.colours.subarray(index * VECTOR_COMPONENTS, (index + 1) * VECTOR_COMPONENTS),
          dest * VECTOR_COMPONENTS,
        );
        size[dest] = frame.sizes[index] ?? 0;
        alpha[dest] = frame.alphas[index] ?? 0;
        shape[dest] = frame.kinds[index] === ParticleKind.Flash ? 0 : (frame.kinds[index] ?? 0);
      });
      this.attribute(
        geometry,
        instanced ? 'iPos' : 'position',
        position,
        VECTOR_COMPONENTS,
        instanced,
      );
      this.attribute(
        geometry,
        instanced ? 'iColor' : 'color',
        colour,
        VECTOR_COMPONENTS,
        instanced,
      );
      this.attribute(geometry, instanced ? 'iSize' : 'size', size, 1, instanced);
      this.attribute(geometry, instanced ? 'iAlpha' : 'alpha', alpha, 1, instanced);
      if (instanced) {
        this.attribute(geometry, 'iShape', shape, 1, true);
        this.quads.geometry.instanceCount = indices.length;
      } else geometry.setDrawRange(0, indices.length);
    }
    const count = frames.reduce((sum, frame) => sum + frame.smoke.sizes.length, 0);
    const positions = new Float32Array(count * VECTOR_COMPONENTS),
      colours = new Float32Array(positions.length);
    const sizes = new Float32Array(count),
      alphas = new Float32Array(count),
      seeds = new Float32Array(count * SEED_COMPONENTS);
    let offset = 0;
    for (const { smoke } of frames) {
      positions.set(smoke.positions, offset * VECTOR_COMPONENTS);
      colours.set(smoke.colours, offset * VECTOR_COMPONENTS);
      sizes.set(smoke.sizes, offset);
      alphas.set(smoke.alphas, offset);
      smoke.seeds.forEach((seed, i) => {
        seeds[(offset + i) * SEED_COMPONENTS] = seed;
        seeds[(offset + i) * SEED_COMPONENTS + 1] = smoke.ages[i] ?? 0;
      });
      offset += smoke.sizes.length;
    }
    for (const [name, data, components] of [
      ['iPos', positions, VECTOR_COMPONENTS],
      ['iColor', colours, VECTOR_COMPONENTS],
      ['iSize', sizes, 1],
      ['iAlpha', alphas, 1],
      ['iSeed', seeds, SEED_COMPONENTS],
    ] as const)
      this.attribute(this.smoke.geometry, name, data, components, true);
    this.smoke.geometry.instanceCount = count;
  }

  /** Releases every owned geometry and shader material. */
  dispose(): void {
    for (const mesh of [this.points, this.quads, this.smoke]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.plane.dispose();
  }
}
