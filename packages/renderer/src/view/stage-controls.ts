/** Orbit controls blend audience framing into a close-up of the computed burst bounds. */
import * as THREE from 'three';
import { EYE_HEIGHT_M, type Framing } from '../sim/framing';
// Prototype interaction tuning: radians per pixel, wheel factors, seconds and metre tolerances.
const YAW_PER_PX = 0.006;
const PITCH_PER_PX = 0.005;
const PAN_PER_PX = 0.0014;
const WHEEL_PIXEL = 0.0012;
const WHEEL_LINE = 0.05;
const UP_FAR_RAD = 0.38;
const UP_NEAR_RAD = 1;
const TOP_RAD = 0.55;
const FLOOR_PADDING = 1.02;
const NEAR_SCALE = 0.3;
const NEAR_LIMIT = 0.8;
/** Visual tuning, dimensionless multiples of the larger framed/fit distance: generous scene context. */
export const NORMAL_FAR_SCALE = 4;
const FREE_NEAR = 0.15;
/** Visual tuning, dimensionless framed/fit-distance multiple for wider free-camera exploration. */
export const FREE_FAR_SCALE = 8;
/** Visual tuning, dimensionless margin on the frustum's enclosing-sphere fit. */
const CLOSE_FIT_MARGIN = 1.05;
/** Degrees per half turn, for the camera's vertical field of view. */
const HALF_TURN_DEG = 180;
const PAN_FLOOR_M = 2;
const MAX_STEP_S = 0.1;
const MS_PER_S = 1000;
const EASING_PER_S = 10;
const PAN_TOLERANCE_M2 = 1e-6;
const ANGLE_TOLERANCE_RAD = 1e-5;
const DISTANCE_TOLERANCE_M = 1e-3;
const INITIAL_DISTANCE_M = 100;
interface Orbit {
  yaw: number;
  pitch: number;
  dist: number;
}
interface Pointer {
  x: number;
  y: number;
  pan: boolean;
}
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
/** Owns pointer/wheel listeners and camera easing; dispose removes every listener. */
export class StageControls {
  enabled = true;
  touched = false;
  free = false;
  private readonly target = new THREE.Vector3();
  private readonly pan = new THREE.Vector3();
  private readonly panGoal = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly abort = new AbortController();
  private readonly pointers = new Map<number, Pointer>();
  private pinch = 0;
  private base = INITIAL_DISTANCE_M;
  private readonly focus = new THREE.Vector3();
  private readonly orbitCentre = new THREE.Vector3();
  private focusRadiusM = 0;
  private framedPitchRad = 0;
  private sphericalFocus = true;
  private goal: Orbit = { yaw: 0, pitch: 0, dist: this.base };
  private current = { ...this.goal };
  private last = performance.now();
  /** Camera uses world metres; invalidation wakes demand rendering during paused gestures. */
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    private readonly invalidate: () => void,
  ) {
    const signal = this.abort.signal;
    element.addEventListener(
      'contextmenu',
      (event) => {
        event.preventDefault();
      },
      { signal },
    );
    element.addEventListener(
      'pointerdown',
      (event) => {
        if (!this.enabled) return;
        element.setPointerCapture(event.pointerId);
        this.pointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          pan: event.button === 2 || event.shiftKey,
        });
        if (this.pointers.size === 2) this.pinch = this.spread();
      },
      { signal },
    );
    element.addEventListener('pointermove', this.move, { signal });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      element.addEventListener(
        name,
        (event) => {
          this.pointers.delete(event.pointerId);
          this.pinch = 0;
        },
        { signal },
      );
    element.addEventListener(
      'wheel',
      (event) => {
        if (!this.enabled) return;
        event.preventDefault();
        this.zoom(Math.exp(event.deltaY * (event.deltaMode === 0 ? WHEEL_PIXEL : WHEEL_LINE)));
      },
      { passive: false, signal },
    );
  }
  private spread(): number {
    const [first, second] = [...this.pointers.values()];
    return first && second ? Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)) : 1;
  }
  private move = (event: PointerEvent): void => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer || !this.enabled) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (this.pointers.size === 2) {
      const distance = this.spread();
      if (this.pinch > 0) this.zoom(this.pinch / distance);
      this.pinch = distance;
      return;
    }
    this.touched = true;
    if (pointer.pan && this.free) this.panBy(dx, dy);
    else {
      this.goal.yaw -= dx * YAW_PER_PX;
      this.goal.pitch += dy * PITCH_PER_PX;
      this.clampGoal();
    }
    this.invalidate();
  };
  private panBy(dx: number, dy: number): void {
    const scale = this.current.dist * PAN_PER_PX;
    this.right.setFromMatrixColumn(this.camera.matrix, 0);
    this.up.setFromMatrixColumn(this.camera.matrix, 1);
    this.panGoal.addScaledVector(this.right, -dx * scale).addScaledVector(this.up, dy * scale);
    this.panGoal.y = Math.max(-this.target.y + PAN_FLOOR_M, this.panGoal.y);
  }
  private range(): [number, number] {
    const halfFov = (this.camera.fov * Math.PI) / HALF_TURN_DEG / 2;
    const limitingAngle = Math.min(halfFov, Math.atan(Math.tan(halfFov) * this.camera.aspect));
    const fit =
      (this.focusRadiusM * CLOSE_FIT_MARGIN) /
      (this.sphericalFocus ? Math.sin(limitingAngle) : Math.tan(limitingAngle));
    const reference = Math.max(this.base, fit);
    if (this.free) return [Math.max(this.base * FREE_NEAR, fit), reference * FREE_FAR_SCALE];
    const floor = ((this.target.y - EYE_HEIGHT_M) / Math.sin(UP_NEAR_RAD)) * FLOOR_PADDING;
    return [
      Math.max(this.base * NEAR_SCALE, Math.min(floor, this.base * NEAR_LIMIT), fit),
      reference * NORMAL_FAR_SCALE,
    ];
  }
  private maxUp(distance: number): number {
    const [low, high] = this.range();
    return UP_FAR_RAD + (UP_NEAR_RAD - UP_FAR_RAD) * clamp((high - distance) / (high - low), 0, 1);
  }
  private lowElevation(distance: number): number {
    const centre = this.centreAt(distance);
    const floor = Math.asin(clamp((EYE_HEIGHT_M - centre.y - this.pan.y) / distance, -1, 1));
    return Math.max(floor, -this.maxUp(distance));
  }
  private clampGoal(): void {
    const [low, high] = this.range();
    this.goal.dist = clamp(this.goal.dist, low, high);
    this.goal.pitch = clamp(this.goal.pitch, -this.maxUp(this.goal.dist), TOP_RAD);
  }
  /** Scales distance for wheel, pinch and buttons using the same burst-centred close-up fit. */
  zoom(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    this.touched = true;
    this.goal.dist *= factor;
    this.clampGoal();
    this.invalidate();
  }
  /** Dimensionless interpolation from the unchanged audience pose to the minimum-distance fit. */
  private closeBlend(distance: number): number {
    const [near] = this.range();
    // Some wide ground posters start closer than a full-extent fit. A zoom gesture
    // then reaches the safe centre without changing the initial framed pose.
    if (near > this.base) return clamp((distance - this.base) / (near - this.base), 0, 1);
    if (near === this.base) return 0;
    return clamp((this.base - distance) / (this.base - near), 0, 1);
  }
  /** Computes the orbit centre in world metres from live and close-up framing. */
  private centreAt(distance: number): THREE.Vector3 {
    return this.orbitCentre.copy(this.target).lerp(this.focus, this.closeBlend(distance));
  }
  /** Fits metre framing, clearing user pan; snap applies it without easing. */
  frame(framing: Framing, snap = false): void {
    this.target.fromArray(framing.target);
    this.focus.fromArray(framing.focus?.target ?? framing.target);
    this.focusRadiusM = framing.focus?.radius_m ?? 0;
    this.sphericalFocus = framing.focus?.spherical ?? true;
    const offset = new THREE.Vector3(...framing.position).sub(this.target);
    this.base = Math.max(1, offset.length());
    this.goal = {
      yaw: Math.atan2(offset.x, offset.z),
      pitch: Math.atan2(offset.y, Math.hypot(offset.x, offset.z)),
      dist: this.base,
    };
    this.framedPitchRad = this.goal.pitch;
    this.panGoal.set(0, 0, 0);
    this.touched = false;
    if (snap) {
      this.current = { ...this.goal };
      this.pan.set(0, 0, 0);
    }
    this.update();
    this.invalidate();
  }
  /** Enables wider zoom and right/Shift-drag panning; disabling clears pan. */
  setFree(enabled: boolean): void {
    this.free = enabled;
    if (!enabled) this.panGoal.set(0, 0, 0);
    this.clampGoal();
    this.invalidate();
  }
  /** Applies an absolute unshaken camera pose and returns whether easing needs another frame. */
  update(now = performance.now()): boolean {
    const dt = clamp((now - this.last) / MS_PER_S, 0, MAX_STEP_S);
    this.last = now;
    const weight = 1 - Math.exp(-dt * EASING_PER_S);
    let moving = this.pan.distanceToSquared(this.panGoal) > PAN_TOLERANCE_M2;
    for (const key of ['yaw', 'pitch', 'dist'] as const) {
      const gap = this.goal[key] - this.current[key];
      const tolerance = key === 'dist' ? DISTANCE_TOLERANCE_M : ANGLE_TOLERANCE_RAD;
      if (Math.abs(gap) > tolerance) {
        moving = true;
        this.current[key] += gap * weight;
      } else this.current[key] = this.goal[key];
    }
    if (this.pan.distanceToSquared(this.panGoal) > PAN_TOLERANCE_M2)
      this.pan.lerp(this.panGoal, weight);
    else this.pan.copy(this.panGoal);
    this.applyPose();
    return moving;
  }
  /** Stops easing at the current metre/radian pose, removing playback shake on the next draw. */
  stop(): void {
    this.goal = { ...this.current };
    this.panGoal.copy(this.pan);
  }
  private applyPose(): void {
    const { yaw, dist } = this.current;
    const pitch = this.current.pitch - this.framedPitchRad * this.closeBlend(dist);
    const low = this.lowElevation(dist);
    const elevation = Math.max(pitch, low);
    const lift = Math.max(0, low - pitch);
    const centre = this.look.copy(this.centreAt(dist)).add(this.pan);
    const horizontal = dist * Math.cos(elevation);
    this.camera.position.set(
      centre.x + Math.sin(yaw) * horizontal,
      Math.max(EYE_HEIGHT_M, centre.y + dist * Math.sin(elevation)),
      centre.z + Math.cos(yaw) * horizontal,
    );
    // Dragging beyond the floor raises the look target instead of sending the eye underground.
    const view = Math.min(
      this.maxUp(dist),
      Math.atan2(centre.y - this.camera.position.y, horizontal) + lift,
    );
    centre.y = this.camera.position.y + Math.tan(view) * horizontal;
    this.camera.lookAt(centre);
    this.camera.updateMatrixWorld();
  }
  /** Releases gesture capture listeners when a viewer is retired. */
  dispose(): void {
    this.abort.abort();
    this.pointers.clear();
  }
}
