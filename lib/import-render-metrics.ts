import {
  FIREWORKS_ENGINE_FIXED_STEP_SECONDS,
  FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
} from '@/lib/fireworks/import-renderer-contract';

export const IMPORT_RENDER_METRICS_SCHEMA_VERSION = 'showcrafter.engine-render-metrics.v2' as const;

export type ImportRenderPaletteColour = {
  hex: string;
  weight: number;
};

export type ImportRenderFrameFeatures = {
  timeSeconds: number;
  meanBrightness: number;
  flashIntensity: number;
  brightCoverage: number;
  centroid: { x: number; y: number } | null;
  spread: number;
  palette: ImportRenderPaletteColour[];
};

export type ImportRenderPerceptualFrame = {
  timeSeconds: number;
  foregroundSsim: number;
  lumaMae: number;
  chromaMae: number;
  foregroundCoverage: number;
};

export type ImportRenderMetrics = {
  schemaVersion: typeof IMPORT_RENDER_METRICS_SCHEMA_VERSION;
  engine: {
    renderer: 'FireworksEngine';
    rendererVersion: typeof FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION;
    camera: 'FireworkReplayCanvas.default';
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    fixedStepSeconds: number;
  };
  timing: {
    sourceOnsetSeconds: number;
    renderedOnsetSeconds: number;
    onsetDeltaSeconds: number;
    sourcePeakSeconds: number;
    renderedPeakSeconds: number;
    peakDeltaSeconds: number;
    sourceFadeEndSeconds: number;
    renderedFadeEndSeconds: number;
    fadeEndDeltaSeconds: number;
    score: number;
  };
  trajectory: {
    centroidRmseNormalised: number;
    spreadMae: number;
    comparedFrameCount: number;
    score: number;
  };
  palette: {
    perceptualDistance: number;
    source: ImportRenderPaletteColour[];
    rendered: ImportRenderPaletteColour[];
    score: number;
  };
  fade: {
    normalisedCurveMae: number;
    fadeEndDeltaSeconds: number;
    comparedFrameCount: number;
    score: number;
  };
  perceptual: {
    meanForegroundSsim: number;
    meanLumaMae: number;
    meanChromaMae: number;
    activeFrameCount: number;
    foregroundWeightTotal: number;
    comparedFrameCount: number;
    score: number;
  };
  overallScore: number;
  priorityIssues: Array<{
    field: 'timing' | 'trajectory' | 'palette' | 'fade' | 'perceptual';
    score: number;
    instruction: string;
  }>;
  frames: Array<{
    timeSeconds: number;
    source: ImportRenderFrameFeatures;
    rendered: ImportRenderFrameFeatures;
    perceptual: ImportRenderPerceptualFrame | null;
  }>;
};

type BuildImportRenderMetricsInput = {
  sourceFrames: ImportRenderFrameFeatures[];
  renderedFrames: ImportRenderFrameFeatures[];
  perceptualFrames?: ImportRenderPerceptualFrame[];
  frameWidth: number;
  frameHeight: number;
};

type PixelSample = {
  values: Uint8Array;
  saturation: Float32Array;
  mask: Uint8Array;
  adaptiveThreshold: number;
};

const MAX_PALETTE_COLOURS = 8;
const FRAME_TIME_PRECISION = 3;
const SCORE_ISSUE_THRESHOLD = 0.78;
const REGISTRATION_SAMPLE_STRIDE = 4;
const REGISTRATION_MAX_SHIFT_PIXELS = 4;
const FOREGROUND_NOISE_FLOOR = 7;
const FOREGROUND_MIN_SIGNAL = 12;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function mean(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function frameTimeKey(timeSeconds: number): string {
  return timeSeconds.toFixed(FRAME_TIME_PRECISION);
}

function assertFrameSequence(frames: ImportRenderFrameFeatures[], label: string): void {
  if (frames.length === 0) throw new Error(`${label} frames are required.`);
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (!Number.isFinite(frame.timeSeconds) || frame.timeSeconds < 0) {
      throw new Error(`${label} frame ${index} has an invalid timestamp.`);
    }
    if (index > 0 && frame.timeSeconds <= frames[index - 1].timeSeconds) {
      throw new Error(`${label} frame timestamps must be strictly increasing.`);
    }
  }
}

function frameActivity(frame: ImportRenderFrameFeatures): number {
  return (
    clamp(frame.brightCoverage * 10) * 0.56 +
    clamp(frame.flashIntensity * 8) * 0.22 +
    clamp(frame.spread * 5) * 0.17 +
    clamp(frame.meanBrightness * 2) * 0.05
  );
}

function activityEnvelope(frames: ImportRenderFrameFeatures[]) {
  const raw = frames.map(frameActivity);
  const baseline = Math.min(...raw);
  const peak = Math.max(...raw);
  const range = Math.max(1e-6, peak - baseline);
  const normalised = raw.map((value) => clamp((value - baseline) / range));
  const peakIndex = raw.indexOf(peak);
  const onsetIndex = normalised.findIndex((value, index) => index <= peakIndex && value >= 0.12);
  let fadeEndIndex = normalised.length - 1;
  for (let index = normalised.length - 1; index >= peakIndex; index -= 1) {
    if (normalised[index] >= 0.1) {
      fadeEndIndex = index;
      break;
    }
  }
  return {
    normalised,
    peakIndex,
    onsetIndex: onsetIndex >= 0 ? onsetIndex : 0,
    fadeEndIndex,
  };
}

function timingMetrics(
  sourceFrames: ImportRenderFrameFeatures[],
  renderedFrames: ImportRenderFrameFeatures[],
) {
  const source = activityEnvelope(sourceFrames);
  const rendered = activityEnvelope(renderedFrames);
  const sourceOnsetSeconds = sourceFrames[source.onsetIndex].timeSeconds;
  const renderedOnsetSeconds = renderedFrames[rendered.onsetIndex].timeSeconds;
  const sourcePeakSeconds = sourceFrames[source.peakIndex].timeSeconds;
  const renderedPeakSeconds = renderedFrames[rendered.peakIndex].timeSeconds;
  const sourceFadeEndSeconds = sourceFrames[source.fadeEndIndex].timeSeconds;
  const renderedFadeEndSeconds = renderedFrames[rendered.fadeEndIndex].timeSeconds;
  const onsetDeltaSeconds = Math.abs(sourceOnsetSeconds - renderedOnsetSeconds);
  const peakDeltaSeconds = Math.abs(sourcePeakSeconds - renderedPeakSeconds);
  const fadeEndDeltaSeconds = Math.abs(sourceFadeEndSeconds - renderedFadeEndSeconds);
  const sampleStep = Math.max(
    0.08,
    mean(
      sourceFrames
        .slice(1)
        .map((frame, index) => frame.timeSeconds - sourceFrames[index].timeSeconds),
    ),
  );
  const tolerance = Math.max(0.35, sampleStep * 2.5);
  return {
    sourceOnsetSeconds: round(sourceOnsetSeconds, 3),
    renderedOnsetSeconds: round(renderedOnsetSeconds, 3),
    onsetDeltaSeconds: round(onsetDeltaSeconds, 3),
    sourcePeakSeconds: round(sourcePeakSeconds, 3),
    renderedPeakSeconds: round(renderedPeakSeconds, 3),
    peakDeltaSeconds: round(peakDeltaSeconds, 3),
    sourceFadeEndSeconds: round(sourceFadeEndSeconds, 3),
    renderedFadeEndSeconds: round(renderedFadeEndSeconds, 3),
    fadeEndDeltaSeconds: round(fadeEndDeltaSeconds, 3),
    score: round(
      mean([
        1 - clamp(onsetDeltaSeconds / tolerance),
        1 - clamp(peakDeltaSeconds / tolerance),
        1 - clamp(fadeEndDeltaSeconds / (tolerance * 1.5)),
      ]),
    ),
    sourceEnvelope: source,
    renderedEnvelope: rendered,
  };
}

function trajectoryMetrics(
  sourceFrames: ImportRenderFrameFeatures[],
  renderedFrames: ImportRenderFrameFeatures[],
) {
  const distances: number[] = [];
  const spreadDifferences: number[] = [];
  sourceFrames.forEach((source, index) => {
    const rendered = renderedFrames[index];
    if (!source.centroid || !rendered.centroid) return;
    const dx = source.centroid.x - rendered.centroid.x;
    const dy = source.centroid.y - rendered.centroid.y;
    distances.push((dx * dx + dy * dy) / 2);
    spreadDifferences.push(Math.abs(source.spread - rendered.spread));
  });
  const centroidRmseNormalised = Math.sqrt(mean(distances));
  const spreadMae = mean(spreadDifferences);
  const centroidScore = 1 - clamp(centroidRmseNormalised / 0.22);
  const spreadScore = 1 - clamp(spreadMae / 0.14);
  return {
    centroidRmseNormalised: round(centroidRmseNormalised),
    spreadMae: round(spreadMae),
    comparedFrameCount: distances.length,
    score: round(distances.length > 0 ? centroidScore * 0.72 + spreadScore * 0.28 : 0),
  };
}

function parseHexColour(hex: string): [number, number, number] | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function linearRgb(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function colourToLab(hex: string): [number, number, number] | null {
  const rgb = parseHexColour(hex);
  if (!rgb) return null;
  const [red, green, blue] = rgb.map(linearRgb) as [number, number, number];
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047;
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883;
  const transform = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = transform(x);
  const fy = transform(y);
  const fz = transform(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function colourDistance(left: string, right: string): number {
  const a = colourToLab(left);
  const b = colourToLab(right);
  if (!a || !b) return 1;
  const delta = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  return clamp(delta / 100);
}

function aggregatePalette(frames: ImportRenderFrameFeatures[]): ImportRenderPaletteColour[] {
  const weights = new Map<string, number>();
  frames.forEach((frame) => {
    const activity = Math.max(0.02, frameActivity(frame));
    frame.palette.forEach((colour) => {
      const hex = colour.hex.toLowerCase();
      if (!parseHexColour(hex)) return;
      weights.set(hex, (weights.get(hex) ?? 0) + clamp(colour.weight) * activity);
    });
  });
  const total = Math.max(
    1e-6,
    [...weights.values()].reduce((sum, value) => sum + value, 0),
  );
  return [...weights.entries()]
    .map(([hex, weight]) => ({ hex, weight: round(weight / total, 4) }))
    .sort((left, right) => right.weight - left.weight || left.hex.localeCompare(right.hex))
    .slice(0, MAX_PALETTE_COLOURS);
}

function directedPaletteDistance(
  source: ImportRenderPaletteColour[],
  target: ImportRenderPaletteColour[],
): number {
  if (source.length === 0 || target.length === 0) return 1;
  const sourceWeight = Math.max(
    1e-6,
    source.reduce((sum, colour) => sum + colour.weight, 0),
  );
  return (
    source.reduce((sum, colour) => {
      const nearest = Math.min(
        ...target.map((candidate) => colourDistance(colour.hex, candidate.hex)),
      );
      return sum + nearest * colour.weight;
    }, 0) / sourceWeight
  );
}

function paletteMetrics(
  sourceFrames: ImportRenderFrameFeatures[],
  renderedFrames: ImportRenderFrameFeatures[],
) {
  const source = aggregatePalette(sourceFrames);
  const rendered = aggregatePalette(renderedFrames);
  const perceptualDistance =
    (directedPaletteDistance(source, rendered) + directedPaletteDistance(rendered, source)) / 2;
  return {
    perceptualDistance: round(perceptualDistance),
    source,
    rendered,
    score: round(1 - perceptualDistance),
  };
}

function fadeMetrics(
  sourceFrames: ImportRenderFrameFeatures[],
  renderedFrames: ImportRenderFrameFeatures[],
  timing: ReturnType<typeof timingMetrics>,
) {
  const startIndex = timing.sourceEnvelope.peakIndex;
  const sourceCurve = timing.sourceEnvelope.normalised.slice(startIndex);
  const renderedCurve = timing.renderedEnvelope.normalised.slice(
    startIndex,
    startIndex + sourceCurve.length,
  );
  const count = Math.min(sourceCurve.length, renderedCurve.length);
  const normalisedCurveMae = mean(
    sourceCurve.slice(0, count).map((value, index) => Math.abs(value - renderedCurve[index])),
  );
  const duration = Math.max(
    0.35,
    sourceFrames.at(-1)!.timeSeconds - sourceFrames[startIndex].timeSeconds,
  );
  const endScore = 1 - clamp(timing.fadeEndDeltaSeconds / Math.max(0.5, duration * 0.3));
  return {
    normalisedCurveMae: round(normalisedCurveMae),
    fadeEndDeltaSeconds: timing.fadeEndDeltaSeconds,
    comparedFrameCount: count,
    score: round((1 - clamp(normalisedCurveMae / 0.45)) * 0.72 + endScore * 0.28),
  };
}

function perceptualMetrics(frames: ImportRenderPerceptualFrame[]) {
  const weightedFrames = frames.flatMap((frame) => {
    const coverage = clamp(frame.foregroundCoverage);
    return coverage > 0 ? [{ frame, weight: Math.sqrt(coverage) }] : [];
  });
  const foregroundWeightTotal = weightedFrames.reduce((sum, entry) => sum + entry.weight, 0);
  const weightedMean = (read: (frame: ImportRenderPerceptualFrame) => number) =>
    foregroundWeightTotal > 0
      ? weightedFrames.reduce((sum, entry) => sum + read(entry.frame) * entry.weight, 0) /
        foregroundWeightTotal
      : 0;
  const meanForegroundSsim = weightedMean((frame) => frame.foregroundSsim);
  const meanLumaMae = weightedMean((frame) => frame.lumaMae);
  const meanChromaMae = weightedMean((frame) => frame.chromaMae);
  return {
    meanForegroundSsim: round(meanForegroundSsim),
    meanLumaMae: round(meanLumaMae),
    meanChromaMae: round(meanChromaMae),
    activeFrameCount: weightedFrames.length,
    foregroundWeightTotal: round(foregroundWeightTotal),
    comparedFrameCount: frames.length,
    score: round(
      foregroundWeightTotal > 0
        ? clamp(meanForegroundSsim) * 0.56 +
            (1 - clamp(meanLumaMae / 0.5)) * 0.26 +
            (1 - clamp(meanChromaMae / 0.45)) * 0.18
        : 0,
    ),
  };
}

function issueFor(field: ImportRenderMetrics['priorityIssues'][number]['field'], score: number) {
  const instructions = {
    timing: 'Adjust shot offsets and lift duration to align launch, burst and fade timestamps.',
    trajectory:
      'Adjust launch height, pan, tilt and shot position to align the measured screen path.',
    palette: 'Adjust layer, head, trail and launch colours to match the weighted source palette.',
    fade: 'Adjust star life, decay, drag, gravity and trail persistence to match the source fade curve.',
    perceptual:
      'Adjust geometry, spread, density, scale and trail profile to improve the engine-frame match.',
  } satisfies Record<typeof field, string>;
  return { field, score, instruction: instructions[field] };
}

export function buildImportRenderMetrics({
  sourceFrames,
  renderedFrames,
  perceptualFrames = [],
  frameWidth,
  frameHeight,
}: BuildImportRenderMetricsInput): ImportRenderMetrics {
  assertFrameSequence(sourceFrames, 'Source');
  assertFrameSequence(renderedFrames, 'Rendered');
  if (sourceFrames.length !== renderedFrames.length) {
    throw new Error('Source and rendered frame counts must match.');
  }
  sourceFrames.forEach((source, index) => {
    if (frameTimeKey(source.timeSeconds) !== frameTimeKey(renderedFrames[index].timeSeconds)) {
      throw new Error(`Source and rendered frame ${index} timestamps do not match.`);
    }
  });
  if (
    !Number.isInteger(frameWidth) ||
    !Number.isInteger(frameHeight) ||
    frameWidth < 1 ||
    frameHeight < 1
  ) {
    throw new Error('Rendered frame dimensions must be positive integers.');
  }

  const perceptualByTime = new Map(
    perceptualFrames.map((frame) => [frameTimeKey(frame.timeSeconds), frame]),
  );
  const timingWithEnvelope = timingMetrics(sourceFrames, renderedFrames);
  const timing = {
    sourceOnsetSeconds: timingWithEnvelope.sourceOnsetSeconds,
    renderedOnsetSeconds: timingWithEnvelope.renderedOnsetSeconds,
    onsetDeltaSeconds: timingWithEnvelope.onsetDeltaSeconds,
    sourcePeakSeconds: timingWithEnvelope.sourcePeakSeconds,
    renderedPeakSeconds: timingWithEnvelope.renderedPeakSeconds,
    peakDeltaSeconds: timingWithEnvelope.peakDeltaSeconds,
    sourceFadeEndSeconds: timingWithEnvelope.sourceFadeEndSeconds,
    renderedFadeEndSeconds: timingWithEnvelope.renderedFadeEndSeconds,
    fadeEndDeltaSeconds: timingWithEnvelope.fadeEndDeltaSeconds,
    score: timingWithEnvelope.score,
  };
  const trajectory = trajectoryMetrics(sourceFrames, renderedFrames);
  const palette = paletteMetrics(sourceFrames, renderedFrames);
  const fade = fadeMetrics(sourceFrames, renderedFrames, timingWithEnvelope);
  const perceptual = perceptualMetrics(perceptualFrames);
  const scores = {
    timing: timing.score,
    trajectory: trajectory.score,
    palette: palette.score,
    fade: fade.score,
    perceptual: perceptual.score,
  };
  const overallScore = round(
    scores.timing * 0.23 +
      scores.trajectory * 0.22 +
      scores.palette * 0.2 +
      scores.fade * 0.17 +
      scores.perceptual * 0.18,
  );
  const priorityIssues = (Object.entries(scores) as Array<[keyof typeof scores, number]>)
    .filter(([, score]) => score < SCORE_ISSUE_THRESHOLD)
    .sort((left, right) => left[1] - right[1])
    .map(([field, score]) => issueFor(field, score));

  return {
    schemaVersion: IMPORT_RENDER_METRICS_SCHEMA_VERSION,
    engine: {
      renderer: 'FireworksEngine',
      rendererVersion: FIREWORKS_ENGINE_IMPORT_RENDERER_VERSION,
      camera: 'FireworkReplayCanvas.default',
      frameWidth,
      frameHeight,
      frameCount: sourceFrames.length,
      fixedStepSeconds: FIREWORKS_ENGINE_FIXED_STEP_SECONDS,
    },
    timing,
    trajectory,
    palette,
    fade,
    perceptual,
    overallScore,
    priorityIssues,
    frames: sourceFrames.map((source, index) => ({
      timeSeconds: source.timeSeconds,
      source,
      rendered: renderedFrames[index],
      perceptual: perceptualByTime.get(frameTimeKey(source.timeSeconds)) ?? null,
    })),
  };
}

function pixelSample(pixels: Uint8ClampedArray): PixelSample {
  if (pixels.length === 0 || pixels.length % 4 !== 0) {
    throw new Error('RGBA pixel data is required.');
  }
  const pixelCount = pixels.length / 4;
  const values = new Uint8Array(pixelCount);
  const saturation = new Float32Array(pixelCount);
  const sortedValues = new Uint8Array(pixelCount);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    values[pixelIndex] = maximum;
    sortedValues[pixelIndex] = maximum;
    saturation[pixelIndex] = maximum > 0 ? (maximum - minimum) / maximum : 0;
  }
  sortedValues.sort();
  const percentileIndex = Math.min(pixelCount - 1, Math.floor(pixelCount * 0.985));
  const adaptiveThreshold = Math.max(72, sortedValues[percentileIndex] * 0.56);
  const mask = new Uint8Array(pixelCount);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    mask[pixelIndex] =
      values[pixelIndex] >= adaptiveThreshold &&
      (saturation[pixelIndex] >= 24 / 255 || values[pixelIndex] >= 184)
        ? 1
        : 0;
  }
  return { values, saturation, mask, adaptiveThreshold };
}

function pixelLuma(pixels: Uint8ClampedArray, offset: number): number {
  return pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722;
}

function meanSampledLuma(pixels: Uint8ClampedArray, width: number): number {
  const pixelCount = pixels.length / 4;
  const stride = Math.max(1, Math.round(width / 64));
  let total = 0;
  let count = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += stride) {
    total += pixelLuma(pixels, pixel * 4);
    count += 1;
  }
  return count > 0 ? total / count : 0;
}

function sampledLumaDeviation(pixels: Uint8ClampedArray, width: number, height: number): number {
  const values: number[] = [];
  for (let y = 0; y < height; y += REGISTRATION_SAMPLE_STRIDE) {
    for (let x = 0; x < width; x += REGISTRATION_SAMPLE_STRIDE) {
      const offset = (y * width + x) * 4;
      const luma = pixelLuma(pixels, offset);
      if (luma < 210) values.push(luma);
    }
  }
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function estimateTranslation(
  reference: Uint8ClampedArray,
  frame: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number } {
  // A nearly black, textureless sky cannot establish camera motion. Keeping a
  // zero translation avoids accidentally registering the firework itself.
  if (sampledLumaDeviation(reference, width, height) < 6) return { x: 0, y: 0 };

  let best = { x: 0, y: 0, error: Number.POSITIVE_INFINITY };
  for (let dy = -REGISTRATION_MAX_SHIFT_PIXELS; dy <= REGISTRATION_MAX_SHIFT_PIXELS; dy += 1) {
    for (let dx = -REGISTRATION_MAX_SHIFT_PIXELS; dx <= REGISTRATION_MAX_SHIFT_PIXELS; dx += 1) {
      let error = 0;
      let count = 0;
      for (
        let y = REGISTRATION_MAX_SHIFT_PIXELS;
        y < height - REGISTRATION_MAX_SHIFT_PIXELS;
        y += REGISTRATION_SAMPLE_STRIDE
      ) {
        for (
          let x = REGISTRATION_MAX_SHIFT_PIXELS;
          x < width - REGISTRATION_MAX_SHIFT_PIXELS;
          x += REGISTRATION_SAMPLE_STRIDE
        ) {
          const referenceOffset = (y * width + x) * 4;
          const frameOffset = ((y + dy) * width + x + dx) * 4;
          const referenceLuma = pixelLuma(reference, referenceOffset);
          const frameLuma = pixelLuma(frame, frameOffset);
          if (referenceLuma >= 224 || frameLuma >= 224) continue;
          error += Math.abs(referenceLuma - frameLuma);
          count += 1;
        }
      }
      const averageError = count > 0 ? error / count : Number.POSITIVE_INFINITY;
      const regularisedError = averageError + (Math.abs(dx) + Math.abs(dy)) * 0.35;
      if (regularisedError < best.error) best = { x: dx, y: dy, error: regularisedError };
    }
  }
  return { x: best.x, y: best.y };
}

function translatedPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  translation: { x: number; y: number },
): Uint8ClampedArray {
  if (translation.x === 0 && translation.y === 0) return pixels.slice();
  const translated = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(height - 1, Math.max(0, y + translation.y));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(width - 1, Math.max(0, x + translation.x));
      const sourceOffset = (sourceY * width + sourceX) * 4;
      const targetOffset = (y * width + x) * 4;
      translated[targetOffset] = pixels[sourceOffset];
      translated[targetOffset + 1] = pixels[sourceOffset + 1];
      translated[targetOffset + 2] = pixels[sourceOffset + 2];
      translated[targetOffset + 3] = 255;
    }
  }
  return translated;
}

/**
 * Remove static scene content before firework feature extraction. Optional
 * translation registration stabilises small source-camera movements, while
 * the renderer sequence remains in its canonical camera coordinates.
 */
export function buildImportTemporalForegroundFrames(
  frames: readonly Uint8ClampedArray[],
  width: number,
  height: number,
  options: { registerTranslation?: boolean } = {},
): Uint8ClampedArray[] {
  if (frames.length < 2)
    throw new Error('At least two frames are required for background removal.');
  const expectedLength = width * height * 4;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    frames.some((frame) => frame.length !== expectedLength)
  ) {
    throw new Error('Every background-removal frame must have matching RGBA dimensions.');
  }

  const referenceIndex = frames
    .map((frame, index) => ({ index, luma: meanSampledLuma(frame, width) }))
    .sort((left, right) => left.luma - right.luma || left.index - right.index)[0].index;
  const reference = frames[referenceIndex];
  const registered = frames.map((frame) =>
    translatedPixels(
      frame,
      width,
      height,
      options.registerTranslation === true
        ? estimateTranslation(reference, frame, width, height)
        : { x: 0, y: 0 },
    ),
  );

  const background = registered[0].slice();
  for (let offset = 0; offset < background.length; offset += 4) {
    let darkestLuma = pixelLuma(background, offset);
    for (let frameIndex = 1; frameIndex < registered.length; frameIndex += 1) {
      const candidate = registered[frameIndex];
      const candidateLuma = pixelLuma(candidate, offset);
      if (candidateLuma < darkestLuma) {
        darkestLuma = candidateLuma;
        background[offset] = candidate[offset];
        background[offset + 1] = candidate[offset + 1];
        background[offset + 2] = candidate[offset + 2];
      }
    }
    background[offset + 3] = 255;
  }

  return registered.map((frame) => {
    const foreground = new Uint8ClampedArray(frame.length);
    for (let offset = 0; offset < frame.length; offset += 4) {
      const red = Math.max(0, frame[offset] - background[offset] - FOREGROUND_NOISE_FLOOR);
      const green = Math.max(
        0,
        frame[offset + 1] - background[offset + 1] - FOREGROUND_NOISE_FLOOR,
      );
      const blue = Math.max(0, frame[offset + 2] - background[offset + 2] - FOREGROUND_NOISE_FLOOR);
      if (Math.max(red, green, blue) >= FOREGROUND_MIN_SIGNAL) {
        foreground[offset] = red;
        foreground[offset + 1] = green;
        foreground[offset + 2] = blue;
      }
      foreground[offset + 3] = 255;
    }
    return foreground;
  });
}

export function analyseImportRenderPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  timeSeconds: number,
): ImportRenderFrameFeatures {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Pixel dimensions must be positive integers.');
  }
  if (pixels.length !== width * height * 4)
    throw new Error('Pixel dimensions do not match RGBA data.');
  const sample = pixelSample(pixels);
  let brightnessSum = 0;
  let flashCount = 0;
  let visibleCount = 0;
  let xSum = 0;
  let ySum = 0;
  let xSquareSum = 0;
  let ySquareSum = 0;
  const paletteCounts = new Map<number, number>();

  for (let pixelIndex = 0; pixelIndex < sample.values.length; pixelIndex += 1) {
    const value = sample.values[pixelIndex];
    brightnessSum += value;
    if (value >= 224) flashCount += 1;
    if (!sample.mask[pixelIndex]) continue;
    visibleCount += 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    xSum += x;
    ySum += y;
    xSquareSum += x * x;
    ySquareSum += y * y;
    const offset = pixelIndex * 4;
    const red = Math.min(252, Math.floor(pixels[offset] / 24) * 24 + 12);
    const green = Math.min(252, Math.floor(pixels[offset + 1] / 24) * 24 + 12);
    const blue = Math.min(252, Math.floor(pixels[offset + 2] / 24) * 24 + 12);
    const key = (red << 16) | (green << 8) | blue;
    paletteCounts.set(key, (paletteCounts.get(key) ?? 0) + 1);
  }

  const pixelCount = sample.values.length;
  const centroid =
    visibleCount > 0
      ? {
          x: round(xSum / visibleCount / Math.max(1, width - 1)),
          y: round(ySum / visibleCount / Math.max(1, height - 1)),
        }
      : null;
  const xVariance = visibleCount > 0 ? xSquareSum / visibleCount - (xSum / visibleCount) ** 2 : 0;
  const yVariance = visibleCount > 0 ? ySquareSum / visibleCount - (ySum / visibleCount) ** 2 : 0;
  const spread =
    Math.sqrt(Math.max(0, xVariance) + Math.max(0, yVariance)) / Math.hypot(width, height);
  const palette = [...paletteCounts.entries()]
    .map(([key, count]) => ({
      hex: `#${key.toString(16).padStart(6, '0')}`,
      weight: round(count / Math.max(1, visibleCount), 4),
    }))
    .sort((left, right) => right.weight - left.weight || left.hex.localeCompare(right.hex))
    .slice(0, 6);

  return {
    timeSeconds: round(timeSeconds, 3),
    meanBrightness: round(brightnessSum / Math.max(1, pixelCount) / 255),
    flashIntensity: round(flashCount / Math.max(1, pixelCount)),
    brightCoverage: round(visibleCount / Math.max(1, pixelCount)),
    centroid,
    spread: round(spread),
    palette,
  };
}

export function compareImportRenderPixels(
  sourcePixels: Uint8ClampedArray,
  renderedPixels: Uint8ClampedArray,
  timeSeconds: number,
): ImportRenderPerceptualFrame {
  if (sourcePixels.length !== renderedPixels.length || sourcePixels.length % 4 !== 0) {
    throw new Error('Source and rendered RGBA data must have matching dimensions.');
  }
  const sourceSample = pixelSample(sourcePixels);
  const renderedSample = pixelSample(renderedPixels);
  let compared = 0;
  let sourceMean = 0;
  let renderedMean = 0;
  let lumaMae = 0;
  let chromaMae = 0;
  const selected: number[] = [];
  for (let pixelIndex = 0; pixelIndex < sourceSample.values.length; pixelIndex += 1) {
    if (sourceSample.mask[pixelIndex] || renderedSample.mask[pixelIndex]) selected.push(pixelIndex);
  }
  const comparisonIndexes = selected.length > 0 ? selected : [...sourceSample.values.keys()];
  for (const pixelIndex of comparisonIndexes) {
    const offset = pixelIndex * 4;
    const sourceRed = sourcePixels[offset] / 255;
    const sourceGreen = sourcePixels[offset + 1] / 255;
    const sourceBlue = sourcePixels[offset + 2] / 255;
    const renderedRed = renderedPixels[offset] / 255;
    const renderedGreen = renderedPixels[offset + 1] / 255;
    const renderedBlue = renderedPixels[offset + 2] / 255;
    const sourceLuma = sourceRed * 0.2126 + sourceGreen * 0.7152 + sourceBlue * 0.0722;
    const renderedLuma = renderedRed * 0.2126 + renderedGreen * 0.7152 + renderedBlue * 0.0722;
    sourceMean += sourceLuma;
    renderedMean += renderedLuma;
    lumaMae += Math.abs(sourceLuma - renderedLuma);
    chromaMae +=
      (Math.abs(sourceRed - sourceLuma - (renderedRed - renderedLuma)) +
        Math.abs(sourceGreen - sourceLuma - (renderedGreen - renderedLuma)) +
        Math.abs(sourceBlue - sourceLuma - (renderedBlue - renderedLuma))) /
      3;
    compared += 1;
  }
  sourceMean /= Math.max(1, compared);
  renderedMean /= Math.max(1, compared);
  let sourceVariance = 0;
  let renderedVariance = 0;
  let covariance = 0;
  for (const pixelIndex of comparisonIndexes) {
    const offset = pixelIndex * 4;
    const sourceLuma =
      (sourcePixels[offset] * 0.2126 +
        sourcePixels[offset + 1] * 0.7152 +
        sourcePixels[offset + 2] * 0.0722) /
      255;
    const renderedLuma =
      (renderedPixels[offset] * 0.2126 +
        renderedPixels[offset + 1] * 0.7152 +
        renderedPixels[offset + 2] * 0.0722) /
      255;
    sourceVariance += (sourceLuma - sourceMean) ** 2;
    renderedVariance += (renderedLuma - renderedMean) ** 2;
    covariance += (sourceLuma - sourceMean) * (renderedLuma - renderedMean);
  }
  const denominator = Math.max(1, compared - 1);
  sourceVariance /= denominator;
  renderedVariance /= denominator;
  covariance /= denominator;
  const c1 = 0.01 ** 2;
  const c2 = 0.03 ** 2;
  const foregroundSsim =
    ((2 * sourceMean * renderedMean + c1) * (2 * covariance + c2)) /
    ((sourceMean ** 2 + renderedMean ** 2 + c1) * (sourceVariance + renderedVariance + c2));

  return {
    timeSeconds: round(timeSeconds, 3),
    foregroundSsim: round(clamp(foregroundSsim)),
    lumaMae: round(lumaMae / Math.max(1, compared)),
    chromaMae: round(chromaMae / Math.max(1, compared)),
    foregroundCoverage: round(selected.length / Math.max(1, sourceSample.values.length)),
  };
}
