'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

type RainbowMatrixVariant = 'dark' | 'light';

type RainbowMatrixShaderProps = {
  className?: string;
  variant?: RainbowMatrixVariant;
};

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_mode;
uniform float u_seed;
varying vec2 v_uv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.28, 0.58) + t));
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 centred = (uv - 0.5) * vec2(aspect, 1.0);
  float seedPhase = u_seed * 6.28318;
  vec2 seedOffset = vec2(sin(seedPhase), cos(seedPhase * 1.37)) * 7.0;

  float time = u_time * 0.18;
  vec2 drift = vec2(
    sin(time * 0.73) * 0.08 + cos(time * 0.31) * 0.04,
    cos(time * 0.61) * 0.05 + sin(time * 0.27) * 0.03
  ) + vec2(sin(seedPhase * 0.71), cos(seedPhase * 0.83)) * 0.045;
  vec2 focus = vec2(-0.1, 0.02) + drift;
  float radius = length(centred - focus);

  float fold = sin((centred.x - focus.x) * 7.0 - time * 2.8);
  float pulse = sin(radius * 18.0 - time * 4.1 + fold * 0.7);
  float swell = noise(centred * 4.5 + vec2(time * 0.9, -time * 0.35) + seedOffset * 0.32);

  vec2 warped = uv;
  warped += vec2(
    sin(uv.y * 9.0 + time * 2.0 + pulse) * 0.026,
    cos(uv.x * 8.0 - time * 1.6 + swell * 2.0) * 0.022
  );

  float columns = mix(24.0, 42.0, smoothstep(0.25, 1.2, aspect));
  vec2 gridDrift = vec2(
    sin(time * 0.22) * 0.0024,
    cos(time * 0.18) * 0.002
  );
  vec2 grid = (uv + gridDrift) * vec2(columns * aspect, columns);
  vec2 f = fract(grid);

  float edgeDistance = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float gridLine = (1.0 - smoothstep(0.006, 0.032, edgeDistance)) * 0.42;
  float gridGlow = (1.0 - smoothstep(0.018, 0.13, edgeDistance)) * 0.32;
  float flowNoise = noise(warped * 4.8 + vec2(time * 0.58, -time * 0.28) + seedOffset);
  float fineNoise = noise(warped * 10.0 + vec2(-time * 0.22, time * 0.36) + seedOffset * 1.63);
  float prism = sin(centred.x * 3.6 + centred.y * 2.0 + flowNoise * 2.4 - time * 1.9);
  float ribbon = sin(radius * 8.0 - time * 2.1 + fineNoise * 1.7);
  float caustic = pow(max(0.0, prism * 0.5 + 0.5), 2.3) * 0.5;
  caustic += pow(max(0.0, ribbon * 0.5 + 0.5), 2.9) * 0.28;

  float ring = 1.0 - smoothstep(0.12, 1.1, radius);
  float outerGlow = 1.0 - smoothstep(0.18, 1.25, radius);
  float sheen = clamp(caustic * 0.78 + flowNoise * 0.24 + gridGlow * 0.22 + ring * 0.42, 0.0, 1.0);

  float colourIndex = radius * 0.72 + pulse * 0.045 + flowNoise * 0.18 + fineNoise * 0.06 + u_seed * 1.41 - time * 0.08;
  vec3 rainbow = palette(colourIndex);
  rainbow = mix(rainbow, palette(colourIndex + 0.16), gridGlow * 0.14 + caustic * 0.2);
  rainbow = pow(rainbow, vec3(0.78));

  float vignette = 1.0 - smoothstep(0.18, 1.35, length(centred));
  float darkEnergy = clamp(0.12 + sheen * 1.4 + outerGlow * 0.36, 0.0, 1.35);
  vec3 darkColour = rainbow * darkEnergy;
  darkColour *= mix(0.2, 1.05, vignette);
  darkColour += mix(vec3(0.82, 0.96, 1.0), rainbow, 0.32) * gridLine;
  darkColour = mix(vec3(0.0, 0.004, 0.012), darkColour, clamp(0.2 + outerGlow + sheen, 0.0, 1.0));

  vec3 lightBase = vec3(0.94, 0.985, 1.0);
  vec3 lightWash = mix(vec3(0.88, 0.97, 1.0), vec3(1.0, 0.93, 0.99), uv.x * 0.7 + uv.y * 0.2);
  vec3 lightColour = mix(lightBase, lightWash, 0.55);
  lightColour = mix(lightColour, rainbow, clamp(0.34 + sheen * 0.72 + ring * 0.14, 0.0, 0.9));
  lightColour += rainbow * caustic * 0.28;
  lightColour = mix(lightColour, vec3(0.16, 0.22, 0.32), gridLine * 0.38);
  lightColour = mix(lightColour, vec3(1.0), 0.18 * (1.0 - vignette));

  vec3 colour = mix(darkColour, lightColour, smoothstep(0.0, 1.0, u_mode));
  colour = clamp(colour, 0.0, 1.0);

  gl_FragColor = vec4(colour, 1.0);
}
`;

export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) {
      gl.deleteShader(vertexShader);
    }

    if (fragmentShader) {
      gl.deleteShader(fragmentShader);
    }

    return null;
  }

  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export const Component = ({ className, variant = 'dark' }: RainbowMatrixShaderProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetModeRef = useRef(variant === 'light' ? 1 : 0);

  useEffect(() => {
    targetModeRef.current = variant === 'light' ? 1 : 0;
  }, [variant]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      powerPreference: 'high-performance',
      stencil: false,
    });

    if (!gl) {
      return;
    }

    const program = createProgram(gl);

    if (!program) {
      return;
    }

    const positionBuffer = gl.createBuffer();

    if (!positionBuffer) {
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const modeLocation = gl.getUniformLocation(program, 'u_mode');
    const seedLocation = gl.getUniformLocation(program, 'u_seed');

    let animationFrame = 0;
    let renderedMode = targetModeRef.current;
    const seed = Math.random();
    const startedAt = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(bounds.width * pixelRatio));
      const height = Math.max(1, Math.floor(bounds.height * pixelRatio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener('resize', resize);
    resize();

    const render = (now: number) => {
      resize();
      renderedMode += (targetModeRef.current - renderedMode) * 0.08;

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }

      if (timeLocation) {
        gl.uniform1f(timeLocation, (now - startedAt) / 1000);
      }

      if (modeLocation) {
        gl.uniform1f(modeLocation, renderedMode);
      }

      if (seedLocation) {
        gl.uniform1f(seedLocation, seed);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div
      className={cn(
        'relative h-screen w-screen overflow-hidden',
        variant === 'light' ? 'bg-[#f7f9fc]' : 'bg-black',
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none block h-full w-full"
        aria-hidden="true"
      />
    </div>
  );
};
