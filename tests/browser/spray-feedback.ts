/** Browser-only transform feedback reads the live vertex shader's analytic spark outputs. */
export interface FeedbackInput {
  vertex: string;
  directions: string;
  frames: {
    births: string;
    indices: string;
    count: number;
    time?: number;
    sourceCount?: number;
    clocks?: string;
  }[];
  birthMode?: boolean;
  sourceMode?: boolean;
  width: number;
}
/** Executes in page.evaluate: reads metre positions, linear colour, size and alpha from software GL.
 * Owns an isolated context and releases every test GPU resource, including on compilation failure. */
export function readSprayFeedback(input: FeedbackInput): number[][] {
  // Production lookup width (texels), RGBA scalar lanes and candidate/output row layouts.
  // Keep these inside the serialised callback so page.evaluate needs no module closure.
  const DIRECTION_TEXTURE_SIDE_TEXELS = 64;
  const TEXEL_COMPONENTS = 4;
  const CANDIDATE_COMPONENTS = 2;
  const OUTPUT_STRIDE = input.birthMode ? 9 : 8;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2');
  if (!context) throw new Error('GPU parity requires WebGL2 transform feedback');
  const gl = context;
  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  const buffers: WebGLBuffer[] = [];
  const program = gl.createProgram();
  const feedback = gl.createTransformFeedback();
  const vao = gl.createVertexArray();
  if (!program || !feedback || !vao) throw new Error('Could not allocate feedback objects');
  function compile(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not allocate shader');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed');
    }
    return shader;
  }
  function unpack(encoded: string): Float32Array {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return new Float32Array(bytes.buffer);
  }
  function texture(name: string, unit: number, encoded: string, width: number): void {
    const data = unpack(encoded);
    const value = gl.createTexture();
    if (!value) throw new Error('Could not allocate texture');
    textures.push(value);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, value);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      width,
      data.length / (width * TEXEL_COMPONENTS),
      0,
      gl.RGBA,
      gl.FLOAT,
      data,
    );
    gl.uniform1i(gl.getUniformLocation(program, name), unit);
  }
  function buffer(): WebGLBuffer {
    const value = gl.createBuffer();
    if (!value) throw new Error('Could not allocate buffer');
    buffers.push(value);
    return value;
  }
  try {
    // Match three.js's WebGL2 compatibility prefix while retaining the production vertex body.
    const vertex = `#version 300 es
precision highp float; precision highp int;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
in vec3 position;
out vec3 tfPosition; out vec3 tfColour; out float tfSize; out float tfAlpha;
${input.vertex
  .replace(/\battribute\b/g, 'in')
  .replace(/\bvarying\b/g, 'out')
  .replace(
    'vec3 position = spark.position;',
    `tfPosition = spark.position; tfColour = spark.colour;
  tfSize = spark.size; tfAlpha = spark.alpha;
  vec3 position = spark.position;`,
  )}`;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(
      program,
      compile(
        gl.FRAGMENT_SHADER,
        `#version 300 es
precision highp float; out vec4 colour; void main() { colour = vec4(0); }`,
      ),
    );
    gl.transformFeedbackVaryings(
      program,
      input.birthMode
        ? ['tfPosition', 'tfColour', 'tfSize', 'tfAlpha', 'tfId']
        : ['tfPosition', 'tfColour', 'tfSize', 'tfAlpha'],
      gl.INTERLEAVED_ATTRIBS,
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? 'Shader link failed');
    gl.useProgram(program);
    texture('uDirections', 1, input.directions, DIRECTION_TEXTURE_SIDE_TEXELS);
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelViewMatrix'), false, identity);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projectionMatrix'), false, identity);
    gl.uniform1f(gl.getUniformLocation(program, 'uScale'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'uDpr'), 1);
    function drawFrame(frame: FeedbackInput['frames'][number]): number[] {
      texture(input.sourceMode ? 'uSources' : 'uBirths', 0, frame.births, input.width);
      if (input.sourceMode) {
        if (!frame.clocks) throw new Error('Source parity requires binary64 clocks');
        texture('uSourceClocks', 2, frame.clocks, input.width);
        gl.uniform1f(gl.getUniformLocation(program, 'uSourceTime'), frame.time ?? 0);
        gl.uniform1i(gl.getUniformLocation(program, 'uSourceCount'), frame.sourceCount ?? 0);
      }
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer());
      gl.bufferData(gl.ARRAY_BUFFER, unpack(frame.indices), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'candidate');
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, CANDIDATE_COMPONENTS, gl.FLOAT, false, 0, 0);
      const output = buffer();
      const values = new Float32Array(frame.count * OUTPUT_STRIDE);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
      gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, values.byteLength, gl.STREAM_READ);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, frame.count);
      gl.endTransformFeedback();
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindBuffer(gl.COPY_READ_BUFFER, output);
      gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, values);
      const error = gl.getError();
      if (error !== gl.NO_ERROR) throw new Error(`Transform feedback WebGL error ${error}`);
      return Array.from(values);
    }
    // Replay each packed instant on the same context to catch GPU state dependencies.
    return input.frames.flatMap((frame) => [drawFrame(frame), drawFrame(frame)]);
  } finally {
    for (const value of buffers) gl.deleteBuffer(value);
    for (const value of textures) gl.deleteTexture(value);
    for (const value of shaders) gl.deleteShader(value);
    gl.deleteTransformFeedback(feedback);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
