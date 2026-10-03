/** One GPU points layer computes sampled spray births with the shared analytic kernel. */
import * as THREE from 'three';
import { sprayKernel } from './spray-kernel';
import { pointVertex, pointFragment } from './shaders';
import { sprayDirections } from './spray-births';
import { SpraySources } from './spray-sources';
import { SOURCE_TEXTURE_WIDTH } from './source-layout';
import { sourceBirthKernel } from './source-birth-kernel';

// Prototype lookup has 4096 directions arranged as a square RGBA texture.
const DIRECTION_TEXTURE_SIDE = 64;
const TEXEL_COMPONENTS = 4;
const EMPTY_TEXTURE_HEIGHT = 1;
/** Vertex shader uses the same point projection and shading as CPU-produced sparks. */
export const sprayVertex = `${sprayKernel}
attribute vec2 candidate;
${pointVertex.replace(
  'void main() {',
  `void main() {
  Spark spark = evaluateSpark(int(candidate.x), int(candidate.y));
  vec3 position = spark.position;
  vec3 color = spark.colour;
  float size = spark.size;
  // Match the CPU writer's visibility cutoff before perspective projection.
  float alpha = spark.alpha > BIRTH_ALPHA_CUTOFF ? spark.alpha : 0.0;`,
)}
`;
/** Live vertex shader selects and samples births from source controls and reduced source clocks. */
export const sourceSprayVertex = `${sourceBirthKernel}
${pointVertex.replace(
  'void main() {',
  `void main() {
  Spark spark = evaluateSourceSpark(gl_VertexID);
  vec3 position = spark.position;
  vec3 color = spark.colour;
  float size = spark.size;
  float alpha = spark.alpha > BIRTH_ALPHA_CUTOFF ? spark.alpha : 0.0;`,
)}
`;
/** Owns reusable analytic source textures and a candidate draw range in one points layer. */
export class GpuSprays {
  readonly sources = new SpraySources();
  private readonly directions = new THREE.DataTexture(
    sprayDirections(),
    DIRECTION_TEXTURE_SIDE,
    DIRECTION_TEXTURE_SIDE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  private texture = new THREE.DataTexture(
    new Float32Array(SOURCE_TEXTURE_WIDTH * TEXEL_COMPONENTS),
    SOURCE_TEXTURE_WIDTH,
    EMPTY_TEXTURE_HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  private clockTexture = new THREE.DataTexture(
    this.sources.clocks,
    SOURCE_TEXTURE_WIDTH,
    EMPTY_TEXTURE_HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  private readonly geometry = new THREE.BufferGeometry();
  private readonly uniforms;
  readonly points;

  /** Shares point projection uniforms with the CPU particle layers; owns other GPU resources. */
  constructor(projection: { uScale: { value: number }; uDpr: { value: number } }) {
    this.uniforms = {
      ...projection,
      uSources: { value: this.texture },
      uSourceClocks: { value: this.clockTexture },
      uSourceTime: { value: 0 },
      uSourceCount: { value: 0 },
      uDirections: { value: this.directions },
    };
    this.points = new THREE.Points(
      this.geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: sourceSprayVertex,
        fragmentShader: pointFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      }),
    );
    // Positions exist only in the shader. Explicit draw ranges supply the vertex count;
    // a zero-radius local sphere supplies three.js's transparent-object sorting centre.
    // Culling stays disabled because CPU geometry cannot bound the analytic motion.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    this.geometry.setDrawRange(0, 0);
    this.points.frustumCulled = false;
    this.directions.needsUpdate = true;
  }
  /** Uploads changed per-source parameters and updates sequence seconds; no per-spark CPU work. */
  upload(): void {
    if (this.sources.count === 0) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    const height = this.sources.data.length / (SOURCE_TEXTURE_WIDTH * TEXEL_COMPONENTS);
    if (this.texture.image.data !== this.sources.data) {
      this.texture.dispose();
      this.texture = new THREE.DataTexture(
        this.sources.data,
        SOURCE_TEXTURE_WIDTH,
        height,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      this.uniforms.uSources.value = this.texture;
    }
    this.texture.needsUpdate = this.sources.dirty;
    // The placeholder is allocated only when capacity grows. gl_VertexID supplies candidate identity;
    // no candidate attribute is populated or uploaded per frame.
    const positions = this.geometry.getAttribute('position');
    if (!this.geometry.hasAttribute('position') || positions.count < this.sources.count) {
      this.geometry.dispose();
      this.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(this.sources.count * 2), 1),
      );
    }
    this.uploadClocks();
    this.uniforms.uSourceTime.value = this.sources.time;
    this.uniforms.uSourceCount.value = this.sources.sources;
    this.geometry.setDrawRange(0, this.sources.count);
  }
  private uploadClocks(): void {
    if (this.clockTexture.image.data !== this.sources.clocks) {
      this.clockTexture.dispose();
      this.clockTexture = new THREE.DataTexture(
        this.sources.clocks,
        SOURCE_TEXTURE_WIDTH,
        this.sources.clocks.length / (SOURCE_TEXTURE_WIDTH * TEXEL_COMPONENTS),
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      this.uniforms.uSourceClocks.value = this.clockTexture;
    }
    this.clockTexture.needsUpdate = true;
  }
  /** Retires textures, geometry and shader material when the owning viewer is disposed. */
  dispose(): void {
    this.texture.dispose();
    this.directions.dispose();
    this.clockTexture.dispose();
    this.geometry.dispose();
    this.points.material.dispose();
  }
}
