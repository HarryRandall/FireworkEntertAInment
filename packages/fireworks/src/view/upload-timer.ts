/** One-frame CPU driver-upload timing without changing uploaded data or WebGL ordering. */
/** Wraps synchronous buffer/texture upload calls only while a profiled scene draw runs. */
export class UploadTimer {
  elapsedMs = 0;
  /** Receives the owned WebGL2 context; ordinary playback never installs these wrappers. */
  constructor(private readonly gl: WebGL2RenderingContext) {}
  /** Measures CPU time inside upload APIs, restoring original methods even when drawing fails. */
  measure(draw: () => void): void {
    const gl = this.gl;
    const keys = [
      'bufferData',
      'bufferSubData',
      'texImage2D',
      'texSubImage2D',
      'texStorage2D',
    ] as const;
    const descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(gl, key));
    this.elapsedMs = 0;
    gl.bufferData = this.wrap(gl.bufferData.bind(gl));
    gl.bufferSubData = this.wrap(gl.bufferSubData.bind(gl));
    gl.texImage2D = this.wrap(gl.texImage2D.bind(gl));
    gl.texSubImage2D = this.wrap(gl.texSubImage2D.bind(gl));
    gl.texStorage2D = this.wrap(gl.texStorage2D.bind(gl));
    try {
      draw();
    } finally {
      keys.forEach((key, index) => {
        const descriptor = descriptors[index];
        if (descriptor) Object.defineProperty(gl, key, descriptor);
        else Reflect.deleteProperty(gl, key);
      });
    }
  }
  private wrap<T extends (...args: never[]) => void>(method: T): T {
    return new Proxy(method, {
      apply: (target, receiver, args): undefined => {
        const start = performance.now();
        try {
          Reflect.apply(target, receiver, args);
        } finally {
          this.elapsedMs += performance.now() - start;
        }
        return undefined;
      },
    });
  }
}
