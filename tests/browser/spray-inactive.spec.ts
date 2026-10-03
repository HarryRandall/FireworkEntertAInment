/** Inactive GPU lanes are clipped before they can contend for the origin pixel. */
import { test, expect } from '@playwright/test';
import { sourceSprayVertex } from '../../packages/fireworks/src/view/gpu-sprays';
import { SpraySources } from '../../packages/fireworks/src/view/spray-sources';
import { SOURCE_TEXTURE_WIDTH } from '../../packages/fireworks/src/view/source-layout';

// A fixed source before ignition has only inactive candidates, independently of random birth jitter.
const SOURCE_START_S = 1;
const SOURCE_END_S = 2;
const NOW_S = 0;
const NOMINAL_SPARKS = 100;

test('inactive source lanes produce no fragments even with their origin in view', async ({
  page,
}) => {
  const sources = new SpraySources();
  sources.reset(NOW_S);
  sources.receive({ kind: 'fixed', origin: [0, 0, 0] }, SOURCE_START_S, SOURCE_END_S, NOW_S, {
    seed: 11,
    count: NOMINAL_SPARKS,
    life: 1,
    colour: [1, 1, 1],
    size: 1,
    spread: 1,
    flicker: 0,
  });
  await page.goto('/dev');
  const results = await page.evaluate(
    async (input) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2');
      if (!context) throw new Error('Inactive-lane regression requires WebGL2');
      const gl = context;
      const texture = gl.createTexture();
      if (!texture) throw new Error('Could not allocate source texture');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        input.width,
        input.data.length / (input.width * 4),
        0,
        gl.RGBA,
        gl.FLOAT,
        new Float32Array(input.data),
      );
      const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      const prefix = `#version 300 es
precision highp float; precision highp int;
uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; in vec3 position;
`;
      const vertex =
        prefix + input.vertex.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out');
      async function samplesPassed(source: string): Promise<boolean> {
        const program = gl.createProgram();
        const query = gl.createQuery();
        if (!program || !query) throw new Error('Could not allocate query/program');
        const shaders: WebGLShader[] = [];
        try {
          for (const [type, text] of [
            [gl.VERTEX_SHADER, source],
            // Deliberately count fragments that the ordinary alpha-discard path hides.
            [
              gl.FRAGMENT_SHADER,
              '#version 300 es\nprecision highp float; out vec4 colour; void main(){colour=vec4(1);}',
            ],
          ] as const) {
            const shader = gl.createShader(type);
            if (!shader) throw new Error('Could not allocate shader');
            shaders.push(shader);
            gl.shaderSource(shader, text);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
              throw new Error(gl.getShaderInfoLog(shader) ?? 'Compile failed');
            gl.attachShader(program, shader);
          }
          gl.linkProgram(program);
          if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(program) ?? 'Link failed');
          gl.useProgram(program);
          gl.uniformMatrix4fv(gl.getUniformLocation(program, 'modelViewMatrix'), false, identity);
          gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projectionMatrix'), false, identity);
          gl.uniform1i(gl.getUniformLocation(program, 'uSources'), 0);
          gl.uniform1i(gl.getUniformLocation(program, 'uSourceCount'), 1);
          gl.uniform1f(gl.getUniformLocation(program, 'uScale'), 1);
          gl.uniform1f(gl.getUniformLocation(program, 'uDpr'), 1);
          gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);
          gl.drawArrays(gl.POINTS, 0, input.count);
          gl.endQuery(gl.ANY_SAMPLES_PASSED);
          // Poll asynchronously, never force GPU completion with a synchronous readback.
          while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          return Boolean(gl.getQueryParameter(query, gl.QUERY_RESULT));
        } finally {
          gl.deleteQuery(query);
          gl.deleteProgram(program);
          for (const shader of shaders) gl.deleteShader(shader);
        }
      }
      try {
        // Positive control: the previous projection puts every inactive lane at the origin.
        const unclipped = vertex.replace(
          'if (alpha == 0.0) gl_Position = vec4(0.0, 0.0, 0.0, -1.0);',
          '',
        );
        return { unclipped: await samplesPassed(unclipped), clipped: await samplesPassed(vertex) };
      } finally {
        gl.deleteTexture(texture);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    },
    {
      vertex: sourceSprayVertex,
      width: SOURCE_TEXTURE_WIDTH,
      data: [...sources.data],
      count: sources.count,
    },
  );
  expect(results).toEqual({ unclipped: true, clipped: false });
});
