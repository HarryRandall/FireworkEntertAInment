import {
  DEFAULT_DESIGN,
  hydrateBurstTrailDefaults,
  makeBurstTrailPreset,
  type FireworkDesign,
  type FireworkStarLayer,
} from './design';

export const FIREWORK_STYLE_DEFAULT_KINDS = [
  'star',
  'trail',
  'launch',
  'smoke',
  'strobe',
  'crackle',
  'split',
  'sound',
] as const;
export type FireworkStyleDefaultKind = (typeof FIREWORK_STYLE_DEFAULT_KINDS)[number];

export type JsonRecord = Record<string, unknown>;

export type StyleDefaultIdMap = Partial<Record<FireworkStyleDefaultKind, string | null>>;
export type StyleDefaultValueMap<T> = Partial<Record<FireworkStyleDefaultKind, T | null>>;

export const NO_STYLE_DEFAULT_VALUE = '__none';

const BLUE_SPHERE_HEAD = {
  glowStrength: 1.5,
  glowPadding: 150,
  whiteCoreSizePercent: 20,
  whiteCoreBlurPercent: 15,
  coreSoftness: 55,
  coreBrightness: 50,
  coreOpacityFalloff: 60,
  glowSize: 90,
  glowSoftness: 100,
  glowOpacityFalloff: 100,
  glowBlur: 45,
  backgroundGlowOpacityFalloff: 75,
  backgroundGlowSoftness: 50,
};

function makeNeutralLaunchDefaults(): JsonRecord {
  return {
    shell: {
      shape: 'circle',
      sizeScale: 0.25,
      brightness: 0,
      trail: { tubeDiameter: 0, frontAngle: 0, tailAngle: 0, curve: 1 },
    },
    liftParticles: { enabled: false, amount: 0 },
    smoke: { enabled: false, particles: 0 },
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const INITIAL_STYLE_DEFAULT_JSON: Record<FireworkStyleDefaultKind, JsonRecord> = {
  star: {
    stars: {
      outer: {
        head: BLUE_SPHERE_HEAD,
      },
    },
  },
  trail: {
    burstTrail: makeBurstTrailPreset('custom'),
  },
  launch: {
    liftVelocity: 15,
    launch: {
      shell: cloneJson(DEFAULT_DESIGN.launch.shell),
      liftParticles: cloneJson(DEFAULT_DESIGN.launch.liftParticles),
    },
  },
  smoke: {
    launch: {
      smoke: cloneJson(DEFAULT_DESIGN.launch.smoke),
    },
    mortar: {
      smokeParticles: DEFAULT_DESIGN.launch.smoke.particles,
    },
  },
  strobe: {
    strobe: cloneJson(DEFAULT_DESIGN.strobe),
  },
  crackle: {
    crackle: cloneJson(DEFAULT_DESIGN.crackle),
  },
  split: {
    split: cloneJson(DEFAULT_DESIGN.split),
  },
  sound: {
    sound: cloneJson(DEFAULT_DESIGN.sound),
    mortar: {
      sound: DEFAULT_DESIGN.sound.launch,
    },
  },
};

function makeNeutralStarPreviewLayers(): JsonRecord {
  const disabledBurstTrail = makeBurstTrailPreset('none');

  return {
    outer: {
      enabled: true,
      burstTrail: disabledBurstTrail,
    },
    core: {
      enabled: false,
      burstTrail: disabledBurstTrail,
    },
  };
}

function makeTrailPreviewStarLayers(): JsonRecord {
  const disabledBurstTrail = makeBurstTrailPreset('none');

  return {
    outer: {
      enabled: true,
      count: 64,
      burst: {
        speed: [2.2, 3.4],
        gravity: [-0.18, -0.04],
        life: [2.4, 4.2],
        flairColorMode: 'bombColor',
      },
      head: {
        size: 96,
        glowStrength: 0.45,
        glowPadding: 62,
        whiteCoreSizePercent: 12,
        whiteCoreBlurPercent: 10,
        coreSoftness: 42,
        coreBrightness: 38,
        coreOpacityFalloff: 62,
        glowSize: 58,
        glowSoftness: 86,
        glowOpacityFalloff: 92,
        glowBlur: 20,
        backgroundGlowOpacityFalloff: 86,
        backgroundGlowSoftness: 58,
      },
      burstTrail: disabledBurstTrail,
    },
    core: {
      enabled: false,
      count: 24,
      burst: {
        speed: [0.9, 1.7],
        gravity: [-0.16, -0.04],
        life: [1.8, 3.2],
        flairColorMode: 'bombColor',
      },
      head: {
        size: 62,
        glowStrength: 0.35,
        glowPadding: 48,
        whiteCoreSizePercent: 12,
        whiteCoreBlurPercent: 10,
        coreSoftness: 42,
        coreBrightness: 38,
        coreOpacityFalloff: 62,
        glowSize: 48,
        glowSoftness: 86,
        glowOpacityFalloff: 92,
        glowBlur: 16,
        backgroundGlowOpacityFalloff: 86,
        backgroundGlowSoftness: 58,
      },
      burstTrail: disabledBurstTrail,
    },
  };
}

function makeHiddenTrailCarrierStarLayers(): JsonRecord {
  const stars = makeTrailPreviewStarLayers();
  const outer = stars.outer as JsonRecord;
  const outerHead = outer.head as JsonRecord;
  outer.head = {
    ...outerHead,
    visible: false,
  };
  return stars;
}

export function makeTrailPreviewStarDefaults(): JsonRecord {
  return {
    stars: makeTrailPreviewStarLayers(),
  };
}

export function makeStyleDefaultPreviewBaseModel(
  kind: FireworkStyleDefaultKind,
): JsonRecord | undefined {
  const disabledBurstTrail = makeBurstTrailPreset('none');
  const starLayers =
    kind === 'trail' ? makeHiddenTrailCarrierStarLayers() : makeNeutralStarPreviewLayers();
  const launchDefaults = makeNeutralLaunchDefaults();
  if (kind === 'launch') {
    launchDefaults.shell = cloneJson(DEFAULT_DESIGN.launch.shell);
    launchDefaults.liftParticles = cloneJson(DEFAULT_DESIGN.launch.liftParticles);
  }
  if (kind === 'smoke') {
    launchDefaults.smoke = cloneJson(DEFAULT_DESIGN.launch.smoke);
  }

  return {
    renderDefaults: {
      colour: { enabled: kind === 'trail' },
      color: { r: 1, g: 1, b: 1 },
      liftVelocity: 15,
      trailProfile: 'none',
      burstTrail: disabledBurstTrail,
      flair: { enabled: false },
      crackle: { enabled: false, probability: 0, sound: 'crackle' },
      strobe: { enabled: false, frequencyHz: 12, dutyCycle: 0.45 },
      split: { enabled: false },
      sound: { launch: false, boom: 'none' },
      mortar: { smokeParticles: 0, sound: false },
      launch: launchDefaults,
      stars: starLayers,
    },
  };
}

export function normaliseStyleDefaultJson(
  kind: FireworkStyleDefaultKind,
  defaultsJson: unknown,
): JsonRecord {
  const source = isRecord(defaultsJson) ? cloneJson(defaultsJson) : {};
  if (kind !== 'trail') return source;

  const hydrated = hydrateBurstTrailDefaults(source);
  return isRecord(hydrated) ? hydrated : source;
}

function stripColourFields(layer: FireworkStarLayer): JsonRecord {
  return {
    enabled: layer.enabled,
    count: layer.count,
    burst: cloneJson(layer.burst),
    head: cloneJson(layer.head),
  };
}

export function extractStyleDefaultsFromDesign(
  design: FireworkDesign,
  kind: FireworkStyleDefaultKind,
): JsonRecord {
  switch (kind) {
    case 'trail':
      return {
        burstTrail: cloneJson(design.burstTrail),
      };
    case 'launch':
      return {
        liftVelocity: design.liftVelocity,
        launch: {
          shell: cloneJson(design.launch.shell),
          liftParticles: cloneJson(design.launch.liftParticles),
        },
      };
    case 'smoke':
      return {
        launch: {
          smoke: cloneJson(design.launch.smoke),
        },
        mortar: {
          smokeParticles: design.launch.smoke.particles,
        },
      };
    case 'strobe':
      return {
        strobe: cloneJson(design.strobe),
      };
    case 'crackle':
      return {
        crackle: cloneJson(design.crackle),
      };
    case 'split':
      return {
        split: cloneJson(design.split),
      };
    case 'sound':
      return {
        sound: cloneJson(design.sound),
        mortar: {
          sound: design.sound.launch,
        },
      };
    case 'star':
    default:
      return {
        stars: {
          outer: stripColourFields(design.stars.outer),
          core: stripColourFields(design.stars.core),
        },
      };
  }
}

export function styleDefaultKindLabel(kind: FireworkStyleDefaultKind): string {
  switch (kind) {
    case 'star':
      return 'Star';
    case 'trail':
      return 'Trail';
    case 'launch':
      return 'Launch';
    case 'smoke':
      return 'Smoke';
    case 'strobe':
      return 'Strobe';
    case 'crackle':
      return 'Crackle';
    case 'split':
      return 'Split';
    case 'sound':
      return 'Sound';
  }
}

export function isFireworkStyleDefaultKind(value: unknown): value is FireworkStyleDefaultKind {
  return (
    typeof value === 'string' && (FIREWORK_STYLE_DEFAULT_KINDS as readonly string[]).includes(value)
  );
}

export function emptyStyleDefaultIdMap(): Record<FireworkStyleDefaultKind, string> {
  return Object.fromEntries(
    FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => [kind, NO_STYLE_DEFAULT_VALUE]),
  ) as Record<FireworkStyleDefaultKind, string>;
}

export function orderedStyleDefaultValues<T>(
  values: StyleDefaultValueMap<T>,
): Array<T | null | undefined> {
  return FIREWORK_STYLE_DEFAULT_KINDS.map((kind) => values[kind]);
}

function deleteNested(parent: JsonRecord, keys: readonly string[]) {
  if (keys.length === 0) return;
  const [key, ...rest] = keys;
  if (rest.length === 0) {
    delete parent[key];
    return;
  }
  const child = parent[key];
  if (!isRecord(child)) return;
  deleteNested(child, rest);
  if (Object.keys(child).length === 0) delete parent[key];
}

export function removeStyleDefaultOverridesFromRecord(
  defaults: JsonRecord,
  kind: FireworkStyleDefaultKind,
): void {
  switch (kind) {
    case 'star':
      delete defaults.stars;
      return;
    case 'trail': {
      delete defaults.burstTrail;
      const stars = isRecord(defaults.stars) ? defaults.stars : null;
      for (const layerKey of ['outer', 'core']) {
        const layer = stars && isRecord(stars[layerKey]) ? (stars[layerKey] as JsonRecord) : null;
        if (layer) delete layer.burstTrail;
      }
      return;
    }
    case 'launch':
      delete defaults.liftVelocity;
      deleteNested(defaults, ['launch', 'shell']);
      deleteNested(defaults, ['launch', 'liftParticles']);
      return;
    case 'smoke':
      deleteNested(defaults, ['launch', 'smoke']);
      deleteNested(defaults, ['mortar', 'smokeParticles']);
      return;
    case 'strobe':
      delete defaults.strobe;
      return;
    case 'crackle':
      delete defaults.crackle;
      return;
    case 'split':
      delete defaults.split;
      return;
    case 'sound':
      delete defaults.sound;
      deleteNested(defaults, ['mortar', 'sound']);
      return;
  }
}

/**
 * Remove nested stars.outer/stars.core burstTrail overrides so a top-level
 * burstTrail write is not shadowed when the compiled design prefers the
 * layer-level value (see burstTrailOverrideKind in design.ts). The top-level
 * burstTrail is preserved.
 */
export function clearNestedStarBurstTrails(defaults: JsonRecord): void {
  const stars = isRecord(defaults.stars) ? defaults.stars : null;
  if (!stars) return;
  for (const layerKey of ['outer', 'core']) {
    const layer = isRecord(stars[layerKey]) ? (stars[layerKey] as JsonRecord) : null;
    if (layer) delete layer.burstTrail;
  }
}
