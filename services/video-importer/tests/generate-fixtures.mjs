/** Render small MP4 evidence from the canonical CPU simulation with independently authored truth. */
import { writeFileSync, openSync, writeSync, closeSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reviewFixtureDesign } from '../../../packages/fireworks/src/fixtures/index.ts';
import { simulate } from '../../../packages/fireworks/src/sim/index.ts';

// Orthographic evidence camera: raster pixels, metres of horizontal/vertical coverage and 20 Hz clock.
const WIDTH = 256;
const HEIGHT = 192;
const WORLD_WIDTH_M = 100;
const WORLD_HEIGHT_M = 75;
const FPS = 20;
// Same display approximation as the renderer; byte channels and packed RGB triples.
const GAMMA = 2.2;
const BYTE_MAX = 255;
const CHANNELS = 3;
// Point raster tuning: minimum one-pixel radius, low-alpha cutoff to omit imperceptible points.
const MIN_ALPHA = 0.03;
const POINT_RADIUS_PX = 2;
// WAV definition: mono signed 16-bit PCM, 8 kHz, 40 ms deterministic launch pulses.
const AUDIO_RATE = 8000;
const PCM_BYTES = 2;
const WAV_HEADER_BYTES = 44;
// RIFF/WAVE PCM field offsets and sizes in bytes, from the canonical 44-byte header layout.
const WAV_OFFSETS = {
  riffSize: 4,
  waveAndFormat: 8,
  formatSize: 16,
  format: 20,
  channels: 22,
  sampleRate: 24,
  byteRate: 28,
  blockAlign: 32,
  bits: 34,
  data: 36,
  dataSize: 40,
};
const RIFF_PREFIX_BYTES = 8;
const PCM_FORMAT_BYTES = 16;
const PCM_BITS = 16;
const PCM_FORMAT = 1;
const MONO_CHANNELS = 1;
const AUDIO_PULSE_S = 0.04;
const AUDIO_PULSE_HZ = 500;
const AUDIO_AMPLITUDE = 16000;
const MS_PER_SECOND = 1000;
const root = dirname(fileURLToPath(import.meta.url));
const definitions = [
  {
    name: 'shell-cake',
    duration_s: 10,
    audio: true,
    kind: 'peony',
    shots: [
      { t_ms: 500, x: 0.3, colour: '#ff3048', angle_deg: 0 },
      { t_ms: 5500, x: 0.7, colour: '#2fe06a', angle_deg: 12 },
    ],
  },
  {
    name: 'silent-comet',
    duration_s: 4,
    audio: false,
    kind: 'comet',
    shots: [{ t_ms: 500, x: 0.5, colour: '#3050ff', angle_deg: 0 }],
  },
  {
    name: 'delayed-audio',
    duration_s: 5,
    audio: true,
    audio_delay_s: 0.15,
    kind: 'peony',
    shots: [{ t_ms: 500, x: 0.5, colour: '#ff3048', angle_deg: -12 }],
  },
];

function designFor(definition, shot) {
  const design = reviewFixtureDesign(definition.kind);
  const colour = {
    mode: 'solid',
    stops: [
      [0, shot.colour],
      [1, shot.colour],
    ],
  };
  if (design.launch) {
    design.launch.tilt_deg = shot.angle_deg;
    design.breaks[0].layers[0].colour = colour;
    design.breaks[0].core.flash_on = false;
    design.breaks[0].core.ring = false;
    design.breaks[0].fade.white_hot = 0;
    design.breaks[0].fade.prime_s = 0;
    design.breaks[0].fade.ember_at = 1;
  } else {
    design.ground.comets.colour = colour;
    design.ground.comets.trail = 'star';
  }
  return design;
}

function paint(frame, particles, opacity) {
  for (let index = 0; index < particles.alphas.length; index++) {
    if (particles.alphas[index] < MIN_ALPHA) continue;
    const x = Math.round((particles.positions[index * CHANNELS] / WORLD_WIDTH_M + 0.5) * WIDTH);
    const y = Math.round((1 - particles.positions[index * CHANNELS + 1] / WORLD_HEIGHT_M) * HEIGHT);
    for (let dy = -POINT_RADIUS_PX; dy <= POINT_RADIUS_PX; dy++) {
      for (let dx = -POINT_RADIUS_PX; dx <= POINT_RADIUS_PX; dx++) {
        if (x + dx < 0 || x + dx >= WIDTH || y + dy < 0 || y + dy >= HEIGHT) continue;
        const pixel = ((y + dy) * WIDTH + x + dx) * CHANNELS;
        if (particles.alphas[index] <= opacity[pixel / CHANNELS]) continue;
        opacity[pixel / CHANNELS] = particles.alphas[index];
        for (let channel = 0; channel < CHANNELS; channel++) {
          const display = Math.pow(particles.colours[index * CHANNELS + channel], 1 / GAMMA);
          frame[pixel + channel] = Math.round(display * BYTE_MAX);
        }
      }
    }
  }
}

function audioFor(definition) {
  const samples = definition.duration_s * AUDIO_RATE;
  const wav = Buffer.alloc(WAV_HEADER_BYTES + samples * PCM_BYTES);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - RIFF_PREFIX_BYTES, WAV_OFFSETS.riffSize);
  wav.write('WAVEfmt ', WAV_OFFSETS.waveAndFormat);
  wav.writeUInt32LE(PCM_FORMAT_BYTES, WAV_OFFSETS.formatSize);
  wav.writeUInt16LE(PCM_FORMAT, WAV_OFFSETS.format);
  wav.writeUInt16LE(MONO_CHANNELS, WAV_OFFSETS.channels);
  wav.writeUInt32LE(AUDIO_RATE, WAV_OFFSETS.sampleRate);
  wav.writeUInt32LE(AUDIO_RATE * PCM_BYTES, WAV_OFFSETS.byteRate);
  wav.writeUInt16LE(PCM_BYTES, WAV_OFFSETS.blockAlign);
  wav.writeUInt16LE(PCM_BITS, WAV_OFFSETS.bits);
  wav.write('data', WAV_OFFSETS.data);
  wav.writeUInt32LE(samples * PCM_BYTES, WAV_OFFSETS.dataSize);
  for (const shot of definition.shots) {
    const start = Math.round(
      (shot.t_ms / MS_PER_SECOND + (definition.audio_delay_s ?? 0)) * AUDIO_RATE,
    );
    for (let index = 0; index < AUDIO_PULSE_S * AUDIO_RATE; index++) {
      wav.writeInt16LE(
        Math.round(AUDIO_AMPLITUDE * Math.sin((index / AUDIO_RATE) * AUDIO_PULSE_HZ * 2 * Math.PI)),
        WAV_HEADER_BYTES + (start + index) * PCM_BYTES,
      );
    }
  }
  return wav;
}

for (const definition of definitions) {
  const temporary = mkdtempSync(join(tmpdir(), 'video-fixture-'));
  try {
    const rawPath = join(temporary, 'frames.rgb');
    const descriptor = openSync(rawPath, 'w');
    const designs = definition.shots.map((shot) => designFor(definition, shot));
    for (let frameIndex = 0; frameIndex < definition.duration_s * FPS; frameIndex++) {
      const frame = Buffer.alloc(WIDTH * HEIGHT * CHANNELS);
      const opacity = new Float32Array(WIDTH * HEIGHT);
      definition.shots.forEach((shot, index) => {
        paint(
          frame,
          simulate(designs[index], frameIndex / FPS - shot.t_ms / MS_PER_SECOND, {
            position: [(shot.x - 0.5) * WORLD_WIDTH_M, 0],
            smoke: false,
          }),
          opacity,
        );
      });
      writeSync(descriptor, frame);
    }
    closeSync(descriptor);
    writeFileSync(join(temporary, 'audio.wav'), audioFor(definition));
    const arguments_ = [
      '-v',
      'error',
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      `${WIDTH}x${HEIGHT}`,
      '-r',
      String(FPS),
      '-i',
      rawPath,
    ];
    if (definition.audio) arguments_.push('-i', join(temporary, 'audio.wav'), '-c:a', 'aac');
    arguments_.push(
      '-c:v',
      'libx264',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      join(root, 'fixtures', definition.name + '.mp4'),
    );
    const encoded = spawnSync('ffmpeg', arguments_, { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error(encoded.stderr);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
writeFileSync(
  join(root, 'fixtures', 'truth.json'),
  JSON.stringify(
    {
      renderer: 'CPU simulate',
      projection: {
        width: WIDTH,
        height: HEIGHT,
        world_width_m: WORLD_WIDTH_M,
        world_height_m: WORLD_HEIGHT_M,
        fps: FPS,
      },
      clips: definitions,
    },
    null,
    2,
  ) + '\n',
);
