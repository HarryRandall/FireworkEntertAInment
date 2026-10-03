/** Opt-in one-frame CPU boundaries and asynchronous disjoint-safe GPU pass timings. */
import { UploadTimer } from './upload-timer';
// WebGL reports elapsed nanoseconds; UI and CPU timings use milliseconds.
const NS_PER_MS = 1_000_000;
interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}
/** Timings describe one show instant; GPU results are null until available or unsupported. */
export interface FrameProfile {
  time_s: number;
  simulationMs: number;
  sprayMs: number;
  packingMs: number;
  uploadSubmitMs: number;
  storageAllocations: number;
  drawSubmitMs: number;
  outputSubmitMs: number;
  drawGpuMs: number | null;
  outputGpuMs: number | null;
  gpuStatus: 'pending' | 'ready' | 'unsupported' | 'disjoint';
}
/** Owns at most two outstanding timer queries for an explicitly requested frame. */
export class FrameProfiler {
  result: FrameProfile | null = null;
  requested = false;
  private readonly extension: TimerExtension | null;
  private pending: { query: WebGLQuery; phase: 'drawGpuMs' | 'outputGpuMs' }[] = [];
  private sprayStart = 0;
  private sprayMs = 0;
  /** Uses the renderer's WebGL2 context; never blocks or reads back rendered pixels. */
  private readonly uploads: UploadTimer;
  private readonly gl: WebGL2RenderingContext;
  constructor(context: WebGL2RenderingContext | WebGLRenderingContext) {
    if (!('createQuery' in context)) throw new Error('Frame profiling requires WebGL2');
    this.gl = context;
    this.uploads = new UploadTimer(context);
    const gl = context;
    const extension: unknown = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.extension = isTimerExtension(extension) ? extension : null;
  }
  /** Requests a fresh sample, retiring incomplete queries from the previous sample. */
  request(): void {
    this.reset();
    this.requested = true;
  }
  /** Clears a previous scene's sample and releases its pending queries. */
  reset(): void {
    this.dispose();
    this.result = null;
    this.requested = false;
  }
  /** Starts CPU phase accounting for one show time in seconds from sequence start. */
  begin(time_s: number): void {
    this.requested = false;
    this.sprayMs = 0;
    this.result = {
      time_s,
      simulationMs: 0,
      sprayMs: 0,
      packingMs: 0,
      uploadSubmitMs: 0,
      storageAllocations: 0,
      drawSubmitMs: 0,
      outputSubmitMs: 0,
      drawGpuMs: null,
      outputGpuMs: null,
      gpuStatus: this.extension ? 'pending' : 'unsupported',
    };
  }
  /** Observes synchronous spray boundaries; includes scheduling, birth sampling and CPU kernels. */
  readonly sprayPhase = (active: boolean): void => {
    if (active) this.sprayStart = performance.now();
    else this.sprayMs += performance.now() - this.sprayStart;
  };
  /** Records total simulation milliseconds, subtracting the nested spray sampling phase. */
  simulation(elapsedMs: number): void {
    if (!this.result) return;
    this.result.simulationMs = Math.max(0, elapsedMs - this.sprayMs);
    this.result.sprayMs = this.sprayMs;
  }
  /** Times CPU submission and optional GPU completion for a single non-overlapping pass. */
  pass(phase: 'draw' | 'output', draw: () => void): void {
    const query = this.extension ? this.gl.createQuery() : null;
    if (query && this.extension) this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
    const start = performance.now();
    try {
      if (phase === 'draw') this.uploads.measure(draw);
      else draw();
    } finally {
      const elapsed = performance.now() - start;
      if (this.result) {
        if (phase === 'draw') {
          this.result.uploadSubmitMs = this.uploads.elapsedMs;
          this.result.storageAllocations = this.uploads.allocations;
          this.result.drawSubmitMs = Math.max(0, elapsed - this.uploads.elapsedMs);
        } else this.result.outputSubmitMs = elapsed;
      }
      if (query && this.extension) {
        this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
        this.pending.push({ query, phase: phase === 'draw' ? 'drawGpuMs' : 'outputGpuMs' });
      }
    }
  }
  /** Polls only available results; a disjoint invalidates all timings in the sample. */
  poll(): boolean {
    if (!this.extension || !this.result || this.pending.length === 0) return false;
    const disjoint: unknown = this.gl.getParameter(this.extension.GPU_DISJOINT_EXT);
    if (disjoint === true || this.gl.isContextLost()) {
      this.result.gpuStatus = 'disjoint';
      this.result.drawGpuMs = null;
      this.result.outputGpuMs = null;
      this.dispose();
      return true;
    }
    this.pending = this.pending.filter(({ query, phase }) => {
      const available: unknown = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);
      if (available !== true) return true;
      const value: unknown = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT);
      if (typeof value === 'number' && this.result) this.result[phase] = value / NS_PER_MS;
      this.gl.deleteQuery(query);
      return false;
    });
    if (this.pending.length === 0) this.result.gpuStatus = 'ready';
    return true;
  }
  /** Whether subsequent visible frames need to poll outstanding asynchronous queries. */
  get waiting(): boolean {
    return this.pending.length > 0;
  }
  /** Deletes owned queries when a sample or viewer is retired. */
  dispose(): void {
    for (const { query } of this.pending) this.gl.deleteQuery(query);
    this.pending = [];
  }
}
function isTimerExtension(value: unknown): value is TimerExtension {
  return (
    typeof value === 'object' &&
    value !== null &&
    'TIME_ELAPSED_EXT' in value &&
    typeof value.TIME_ELAPSED_EXT === 'number' &&
    'GPU_DISJOINT_EXT' in value &&
    typeof value.GPU_DISJOINT_EXT === 'number'
  );
}
