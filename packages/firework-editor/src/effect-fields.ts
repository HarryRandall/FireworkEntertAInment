import type { FireworkDesign } from '@showcrafter/fireworks/design';

export type NumericFieldDefinition = {
  label: string;
  explanation: string;
  min: number;
  max: number;
  step: number;
  input: 'number' | 'slider' | 'knob';
  unit: 'count' | 'seconds' | 'hertz' | 'percent' | 'simulation';
  /** Display fractions as percentages while retaining the model's fractional value. */
  displayScale?: number;
  displayTransform?: 'chancePerSecond';
};
type NumericFields<T> = {
  [K in keyof T as T[K] extends number ? K : never]: NumericFieldDefinition;
};
export type NumericEffectSection = 'strobe' | 'crackle' | 'split';

export const EFFECT_FIELDS = {
  strobe: {
    frequencyHz: {
      label: 'Flashes per second',
      explanation: 'How often each affected star flashes.',
      min: 2,
      max: 28,
      step: 0.5,
      input: 'slider',
      unit: 'hertz',
    },
    dutyCycle: {
      label: 'Time lit',
      explanation: 'Share of each blink spent lit. The rest is the dim phase.',
      min: 0.1,
      max: 0.9,
      step: 0.01,
      input: 'slider',
      unit: 'percent',
      displayScale: 100,
    },
    amountPercent: {
      label: 'Stars affected',
      explanation: 'Percentage of stars that blink. The others burn steadily.',
      min: 0,
      max: 100,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
    dimPercent: {
      label: 'Size between flashes',
      explanation:
        'Percentage of full star size during the dim phase. Zero hides the head between flashes.',
      min: 0,
      max: 60,
      step: 0.5,
      input: 'slider',
      unit: 'percent',
    },
    desync: {
      label: 'Phase offset per star',
      explanation:
        'Offset in blink cycles between successive stars. Zero makes every star blink together.',
      min: 0,
      max: 1,
      step: 0.001,
      input: 'slider',
      unit: 'percent',
      displayScale: 100,
    },
  } satisfies NumericFields<FireworkDesign['strobe']>,
  crackle: {
    probability: {
      displayTransform: 'chancePerSecond',
      label: 'Ignition chance per second',
      explanation:
        'Chance that an eligible star crackles within one second. Shorter trigger windows give fewer opportunities.',
      min: 0,
      max: 1,
      step: 0.01,
      input: 'slider',
      unit: 'percent',
      displayScale: 100,
    },
    triggerWindowSeconds: {
      label: 'Start before star burns out',
      explanation: 'Crackle becomes possible this many seconds before the star would stop burning.',
      min: 0.1,
      max: 4,
      step: 0.05,
      input: 'number',
      unit: 'seconds',
    },
    fragmentCount: {
      label: 'Fragments per pop',
      explanation:
        'Number of sparks created by one crackle event, before variation and the shared fragment budget.',
      min: 1,
      max: 200,
      step: 1,
      input: 'number',
      unit: 'count',
    },
    fragmentCountVariationPercent: {
      label: 'Count variation',
      explanation: 'Variation above and below the chosen count.',
      min: 0,
      max: 100,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
    fragmentSize: {
      label: 'Spark size',
      explanation: 'Luminous size in renderer units; this is not a physical measurement.',
      min: 1,
      max: 120,
      step: 1,
      input: 'slider',
      unit: 'simulation',
    },
    fragmentSizeVariationPercent: {
      label: 'Size variation',
      explanation: 'Variation above and below the chosen spark size.',
      min: 0,
      max: 100,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
    fragmentSpeed: {
      label: 'Outward speed',
      explanation: 'How quickly sparks move away from the parent star, in simulation units.',
      min: 0,
      max: 6,
      step: 0.05,
      input: 'slider',
      unit: 'simulation',
    },
    fragmentSpeedVariationPercent: {
      label: 'Speed variation',
      explanation: 'Variation above and below the chosen outward speed.',
      min: 0,
      max: 100,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
    fragmentLifeSeconds: {
      label: 'Spark burn time',
      explanation: 'How long a crackle spark burns before variation is applied.',
      min: 0.05,
      max: 4,
      step: 0.05,
      input: 'number',
      unit: 'seconds',
    },
    fragmentLifeVariationPercent: {
      label: 'Burn time variation',
      explanation: 'Variation above and below the chosen burn time.',
      min: 0,
      max: 100,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
    fragmentGravity: {
      label: 'Falling acceleration',
      explanation:
        'Negative values pull sparks down. Zero removes gravity; positive values accelerate upwards.',
      min: -2,
      max: 1,
      step: 0.01,
      input: 'slider',
      unit: 'simulation',
    },
    soundChance: {
      label: 'Chance of a sound',
      explanation: 'Chance that a crackle pop plays a sound when replay audio is enabled.',
      min: 0,
      max: 1,
      step: 0.01,
      input: 'slider',
      unit: 'percent',
      displayScale: 100,
    },
    soundVolume: {
      label: 'Crackle volume',
      explanation: 'Volume of the selected crackle sample.',
      min: 0,
      max: 1,
      step: 0.01,
      input: 'knob',
      unit: 'percent',
      displayScale: 100,
    },
  } satisfies NumericFields<FireworkDesign['crackle']>,
  split: {
    fragments: {
      label: 'Fragments per star',
      explanation: 'How many smaller stars each outer star becomes.',
      min: 2,
      max: 8,
      step: 1,
      input: 'number',
      unit: 'count',
    },
    speed: {
      label: 'Separation speed',
      explanation: 'How quickly fragments move away from the split point, in simulation units.',
      min: 0.4,
      max: 4,
      step: 0.05,
      input: 'slider',
      unit: 'simulation',
    },
    delayRatio: {
      label: 'Split through star life',
      explanation:
        "Percentage of the parent star's burn time before splitting. Lower values split earlier.",
      min: 0.15,
      max: 0.85,
      step: 0.01,
      input: 'slider',
      unit: 'percent',
      displayScale: 100,
    },
    lifeBaseSeconds: {
      label: 'Minimum fragment burn time',
      explanation:
        'Each fragment burns for at least this long, unless it crackles or reaches the ground.',
      min: 0.1,
      max: 6,
      step: 0.05,
      input: 'number',
      unit: 'seconds',
    },
    lifeVariationSeconds: {
      label: 'Extra burn time variation',
      explanation: 'Random extra time between zero and this value is added to each fragment.',
      min: 0,
      max: 6,
      step: 0.05,
      input: 'number',
      unit: 'seconds',
    },
    headSizePercent: {
      label: 'Size relative to parent',
      explanation: 'Fragment head size as a percentage of the outer star head size.',
      min: 5,
      max: 200,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
    trailLifePercent: {
      label: 'Trail life relative to parent',
      explanation: 'Scales the outer star trail lifetime for split fragments.',
      min: 5,
      max: 300,
      step: 1,
      input: 'slider',
      unit: 'percent',
    },
  } satisfies NumericFields<FireworkDesign['split']>,
};

export function formatFieldValue(value: number, field: NumericFieldDefinition): string {
  const number = String(Number(value.toFixed(3)));
  switch (field.unit) {
    case 'percent':
      return `${number}%`;
    case 'seconds':
      return `${number} s`;
    case 'hertz':
      return `${number} Hz`;
    case 'simulation':
      return `${number} units`;
    default:
      return number;
  }
}

export function displayedFieldValue(value: number, field: NumericFieldDefinition): number {
  const display =
    field.displayTransform === 'chancePerSecond' ? 1 - Math.pow(1 - value, 60) : value;
  return display * (field.displayScale ?? 1);
}
export function storedFieldValue(value: number, field: NumericFieldDefinition): number {
  const stored = value / (field.displayScale ?? 1);
  return field.displayTransform === 'chancePerSecond' ? 1 - Math.pow(1 - stored, 1 / 60) : stored;
}
