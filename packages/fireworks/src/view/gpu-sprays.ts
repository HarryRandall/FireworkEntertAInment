/** One GPU points layer computes sampled spray births with the shared analytic kernel. */
import * as THREE from 'three';
import { sprayKernel } from './spray-kernel';
import { pointVertex, pointFragment } from './shaders';
import { BIRTH_TEXTURE_WIDTH, SprayBirths, sprayDirections } from './spray-births';

// Prototype lookup has 4096 directions arranged as a square RGBA texture.
const DIRECTION_TEXTURE_SIDE = 64;
const TEXEL_COMPONENTS = 4;
const CANDIDATE_COMPONENTS = 2;
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
/** Owns a reusable birth texture, candidate attributes and point material in one draw. */
export class GpuSprays {
  readonly births = new SprayBirths();
  private readonly directions = new THREE.DataTexture(
    sprayDirections(),
    DIRECTION_TEXTURE_SIDE,
    DIRECTION_TEXTURE_SIDE,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  private texture = new THREE.DataTexture(
    new Float32Array(BIRTH_TEXTURE_WIDTH * TEXEL_COMPONENTS),
    BIRTH_TEXTURE_WIDTH,
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
      uBirths: { value: this.texture },
      uDirections: { value: this.directions },
    };
    this.points = new THREE.Points(
      this.geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: sprayVertex,
        fragmentShader: pointFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      }),
    );
    const candidates = new THREE.BufferAttribute(this.births.indices, CANDIDATE_COMPONENTS);
    candidates.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('candidate', candidates);
    // Positions exist only in the shader. Explicit draw ranges supply the vertex count;
    // a zero-radius local sphere supplies three.js's transparent-object sorting centre.
    // Culling stays disabled because CPU geometry cannot bound the analytic motion.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0);
    this.geometry.setDrawRange(0, 0);
    this.points.frustumCulled = false;
    this.directions.needsUpdate = true;
  }
  /** Uploads populated births and candidate indices after source sampling; keeps capacity reusable. */
  upload(): void {
    if (this.births.count === 0) {
      this.geometry.setDrawRange(0, 0);
      return;
    }
    const height = this.births.data.length / (BIRTH_TEXTURE_WIDTH * TEXEL_COMPONENTS);
    if (this.texture.image.data !== this.births.data) {
      this.texture.dispose();
      this.texture = new THREE.DataTexture(
        this.births.data,
        BIRTH_TEXTURE_WIDTH,
        height,
        THREE.RGBAFormat,
        THREE.FloatType,
      );
      this.uniforms.uBirths.value = this.texture;
    }
    this.texture.needsUpdate = true;
    const candidates = this.geometry.getAttribute('candidate');
    if (!(candidates instanceof THREE.BufferAttribute)) throw new Error('Missing spray candidates');
    candidates.clearUpdateRanges();
    if (this.births.count > 0)
      candidates.addUpdateRange(0, this.births.count * CANDIDATE_COMPONENTS);
    candidates.needsUpdate = true;
    this.geometry.setDrawRange(0, this.births.count);
  }
  /** Retires textures, geometry and shader material when the owning viewer is disposed. */
  dispose(): void {
    this.texture.dispose();
    this.directions.dispose();
    this.geometry.dispose();
    this.points.material.dispose();
  }
}
