/** One HDR scene target and one full-screen output draw compress and encode light. */
import * as THREE from 'three';
import type { FrameProfiler } from './frame-profile';

const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const fragmentShader = `
uniform sampler2D tDiffuse; varying vec2 vUv;
// Prototype peak compression knee, shoulder rate and shoulder range (linear RGB).
const float KNEE = 0.75, SHOULDER_RATE = 2.2, SHOULDER_RANGE = 0.5;
// IEC sRGB transfer curve constants, from the standard piecewise encoding.
const float SRGB_GAIN = 1.055, SRGB_GAMMA = 2.4, SRGB_OFFSET = 0.055, SRGB_SLOPE = 12.92, SRGB_THRESHOLD = 0.0031308;
// Prototype interleaved-gradient noise coefficients; dither spans one 8-bit code value.
const float NOISE_GAIN = 52.9829189, NOISE_X = 0.06711056, NOISE_Y = 0.00583715, BYTE_MAX = 255.0;
void main(){vec3 x=max(texture2D(tDiffuse,vUv).rgb,0.0);float m=max(max(x.r,x.g),x.b);
// Scale all channels equally to preserve hue in overlapping additive light.
if(m>KNEE){float t=KNEE+(1.0-exp(-(m-KNEE)*SHOULDER_RATE))*SHOULDER_RANGE;x*=t/m;}
vec3 s=mix(SRGB_GAIN*pow(x,vec3(1.0/SRGB_GAMMA))-SRGB_OFFSET,x*SRGB_SLOPE,vec3(lessThanEqual(x,vec3(SRGB_THRESHOLD))));
float n=fract(NOISE_GAIN*fract(dot(gl_FragCoord.xy,vec2(NOISE_X,NOISE_Y))));gl_FragColor=vec4(s+(n-0.5)/BYTE_MAX,1.0);}`;

/** Owns the output resources, falling back to 8-bit colour when HDR is unavailable. */
export class OutputPass {
  readonly target: THREE.WebGLRenderTarget;
  readonly hdr: boolean;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly material: THREE.ShaderMaterial;

  /** Selects a colour target supported by the supplied renderer; forceLdr tests fallback. */
  constructor(renderer: THREE.WebGLRenderer, forceLdr = false) {
    this.hdr =
      !forceLdr &&
      (renderer.extensions.has('EXT_color_buffer_float') ||
        renderer.extensions.has('EXT_color_buffer_half_float'));
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture } },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }
  /** Sets the target size in physical drawing-buffer pixels. */
  resize(width: number, height: number): void {
    this.target.setSize(width, height);
  }
  /** Draws the scene into linear colour, then encodes it once into the canvas. */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    profiler?: FrameProfiler,
  ): void {
    renderer.setRenderTarget(this.target);
    const draw = () => {
      renderer.render(scene, camera);
    };
    if (profiler) profiler.pass('draw', draw);
    else draw();
    renderer.setRenderTarget(null);
    const output = () => {
      renderer.render(this.scene, this.camera);
    };
    if (profiler) profiler.pass('output', output);
    else output();
  }
  /** Frees the colour target and full-screen geometry and material. */
  dispose(): void {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
