import { createHash } from 'node:crypto';
import { upgradeDesign } from '../../packages/renderer/src/schema/index.ts';
import {
  compileFireworkDesign,
  safeParseFireworkDesign,
} from '../../packages/fireworks/src/design.ts';
import {
  CALIBER_BASELINE_MM,
  CALIBER_SCALING,
  parseCaliberMm,
} from '../../packages/fireworks/src/model/scaling.ts';

// Existing renderer height adjustment: time scales with square root of height.
const HEIGHT_TIME_EXPONENT = 0.5;
// v1 schema minimum lift time, seconds.
const MIN_LAUNCH_TIME_S = 0.001;
// Visual calibration: old speed 3.2 corresponds to the peony template's 26 m spread.
const SPREAD_M_PER_OLD_SPEED = 26 / 3.2;
// Visual calibration: old head budget 170 corresponds to the peony's 1.1 renderer size.
const HEAD_SIZE_PER_OLD_UNIT = 1.1 / 170;
// Old effects/constants.ts STAR_DRAG, including the star spawner's 0.6 multiplier, 1/s.
const OLD_STAR_DRAG_PER_S = 2.15 * 0.6;
// Visual gravity calibration: old -0.24 corresponds to v1 9 m/s², with inverted y.
const GRAVITY_M_S2_PER_OLD_UNIT = -9 / 0.24;
// Old simulation probability is evaluated at a 60 Hz reference step.
const OLD_REFERENCE_RATE_HZ = 60;
// Old renderer default secondary fraction; v1 palettes allow at most 16 entries.
const DEFAULT_SECONDARY_FRACTION = 0.22;
const MAX_PALETTE_ENTRIES = 16;
// Old linear hot metallic colours converted to sRGB by the old renderer's display path.
const TRAIL_COLOURS = { gold: '#fff3ce', silver: '#f8fcff', ember: '#ffce8b' };
// Fixed hue samples approximate the old continuous saturated random HSV generator.
const RANDOM_PALETTE = ['#ff2626', '#ffff26', '#26ff26', '#26ffff', '#2626ff', '#ff26ff'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mean = (range) => (range[0] + range[1]) / 2;
const variation = (range) => (range[1] === 0 ? 0 : 1 - range[0] / range[1]);

/** Resolves the authoritative saved look; incomplete legacy rows use the old compiler. */
export function resolvedOldDesign(firework, effectModel = {}) {
  return firework.render_snapshot_json
    ? safeParseFireworkDesign(firework.render_snapshot_json)
    : compileFireworkDesign({
        baseModel: effectModel,
        variantOverrides: firework.render_overrides_json,
        primaryColor: firework.primary_color,
        colorPalette: firework.color_palette,
      });
}

/** Converts the old RGB byte fractions, which are stored before display gamma conversion. */
function hex(value, fallback = '#ffffff') {
  if (!value || value === 'random') return fallback;
  if (typeof value === 'string') return value;
  return (
    '#' +
    ['r', 'g', 'b']
      .map((key) =>
        Math.round(clamp(value[key], 0, 1) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Maps per-layer palettes and life-relative opening and closing colour fades. */
function colour(old, star, firework, inner, notes) {
  const pattern = star.colourPattern;
  let colours = pattern.colours
    .filter((entry) => entry.weight > 0)
    .map((entry) => hex(entry.color));
  let random = pattern.mode === 'random' || star.color === 'random';
  if (!colours.length) {
    if (star.color) colours = star.color === 'random' ? RANDOM_PALETTE : [hex(star.color)];
    else if (inner) colours = [hex(old.secondaryColor ?? old.color)];
    else if (firework.color_palette?.length) colours = firework.color_palette;
    else if (old.color === 'random') {
      colours = RANDOM_PALETTE;
      random = true;
    } else colours = [hex(old.color, firework.primary_color ?? '#ffffff')];
    if (
      !inner &&
      !star.color &&
      !firework.color_palette?.length &&
      old.secondaryColor &&
      old.color !== 'random'
    ) {
      const secondary = hex(old.secondaryColor);
      const secondaryCount = Math.round(
        (old.secondaryColorRatio ?? DEFAULT_SECONDARY_FRACTION) * MAX_PALETTE_ENTRIES,
      );
      colours = [
        ...Array(MAX_PALETTE_ENTRIES - secondaryCount).fill(colours[0]),
        ...Array(secondaryCount).fill(secondary),
      ];
    }
  }
  if (pattern.mode === 'bands' || pattern.mode === 'stripes')
    notes.push(
      `${inner ? 'Core' : 'Outer'} ${pattern.mode} (${pattern.axis}, ${pattern.count}) use an alternating palette: v1 has no spatial colour masks.`,
    );
  if (pattern.colours.some((entry) => entry.weight !== 100))
    notes.push('Weighted colour-pattern entries use an unweighted v1 palette.');
  const opening = star.head.opening.colour;
  const closing = star.head.closing.colour;
  const stops = [[0, opening.enabled ? [hex(opening.color)] : colours]];
  if (opening.enabled) stops.push([opening.fadePercent / 100, colours]);
  if (closing.enabled) {
    const at = 1 - closing.fadePercent / 100;
    // Overlapping old fades are approximated by ordered authored stops.
    if (at > stops.at(-1)[0]) stops.push([at, colours]);
    else notes.push('Overlapping opening and closing fades use an ordered v1 colour curve.');
  }
  stops.push([1, closing.enabled ? [hex(closing.color)] : colours]);
  if (random && !pattern.colours.length)
    notes.push('Continuous old random hues use six fixed saturated v1 hue samples.');
  return { mode: random ? 'random' : colours.length > 1 ? 'alternate' : 'solid', stops };
}

/** Builds schema-complete modifiers; unused fields retain neutral values. */
function modifier(kind, values = {}) {
  return {
    kind,
    at: 0,
    rate_hz: 12,
    count: 4,
    amount: 1,
    spread: 'burst',
    gap: 0,
    angular_speed_rad_s: 0,
    rate_rad_s: 0,
    ...values,
  };
}

/** Maps trail budgets, particle life and motion without pretending to reproduce sprite shapes. */
function trail(old, star, notes) {
  const source = star.burstTrail;
  const streak = source.preset === 'solidStreaks' || source.preset === 'cometTail';
  const enabled = source.enabled && source.preset !== 'none';
  const lengthS =
    source.lifetime.mode === 'dynamic'
      ? mean(star.burst.life) * source.lifetime.percent
      : source.lifetime.baseSeconds;
  if (enabled)
    notes.push(
      'Trail width curves, sprite shapes, placement and particle-life colour fades use v1 density, size and spread approximations.',
    );
  return {
    sparks: enabled ? Math.round(clamp(source.particlesPerStar * old.trail.density, 0, 10000)) : 0,
    length_s: clamp(
      (lengthS + source.lifetime.afterglowSeconds) *
        old.trail.length *
        (streak ? old.trail.streakLife : 1),
      0.001,
      20,
    ),
    spread_m_s: clamp((source.width.front + source.width.tail) * source.motion.turbulence, 0, 200),
    gravity_m_s2: clamp(source.motion.gravity * GRAVITY_M_S2_PER_OLD_UNIT, -40, 100),
    drag_per_s: clamp(source.motion.drag, 0.001, 30),
    size: clamp(
      source.particleSize.base * old.trail.thickness * (streak ? old.trail.streakSize : 1),
      0,
      10,
    ),
    flicker: clamp(source.flicker.chance * source.flicker.strength, 0, 1),
    colour: TRAIL_COLOURS[source.colourMode] ?? 'star',
    glitter: enabled && ['glitter', 'blink'].includes(old.trailProfile) ? old.trail.sparkle : 0,
    glitter_delay_s: 0,
    fork: 0,
  };
}

/** Converts old outer and inner star tuning into independent v1 layers. */
function layer(base, old, star, firework, inner, notes) {
  const mm = parseCaliberMm(firework.caliber ?? '') ?? CALIBER_BASELINE_MM;
  const ratio = mm / CALIBER_BASELINE_MM;
  const result = structuredClone(base);
  result.id = inner ? 'core-stars' : 'outer-stars';
  result.name = inner ? 'Inner stars' : 'Outer stars';
  result.count = star.enabled
    ? Math.round(clamp(star.count * ratio ** CALIBER_SCALING.stars, 0, 10000))
    : 0;
  result.hidden = !star.enabled;
  result.radius_m = clamp(
    star.burst.speed[1] * SPREAD_M_PER_OLD_SPEED * ratio ** CALIBER_SCALING.spread,
    0,
    500,
  );
  result.speed_var = variation(star.burst.speed);
  result.life_s = clamp(mean(star.burst.life) * ratio ** CALIBER_SCALING.life, 0.001, 120);
  result.life_var = clamp((star.burst.life[1] - star.burst.life[0]) / mean(star.burst.life), 0, 1);
  if ((star.burst.life[1] - star.burst.life[0]) / mean(star.burst.life) > 1)
    notes.push(
      'Old star life range exceeds v1 life variation; the mean is retained and variation capped.',
    );
  result.drag_per_s = clamp(
    (OLD_STAR_DRAG_PER_S * star.burst.airResistancePercent) / 100,
    0.001,
    30,
  );
  result.gravity_m_s2 = clamp(mean(star.burst.gravity) * GRAVITY_M_S2_PER_OLD_UNIT, -40, 100);
  const tuningKey = {
    weeping: 'weeping',
    falling_tail: 'fallingTail',
    radial_arms: 'radialArms',
    pearls: 'pearls',
    ring: 'ring',
    waterfall: 'waterfall',
  }[old.geometry];
  if (tuningKey) {
    const shape = old.geometryTuning[tuningKey];
    result.life_s = clamp((result.life_s * (shape.lifePercent ?? 100)) / 100, 0.001, 120);
    result.gravity_m_s2 = clamp(
      (result.gravity_m_s2 * (shape.gravityPercent ?? 100)) / 100,
      -40,
      100,
    );
    result.drag_per_s = clamp((result.drag_per_s * (shape.dragPercent ?? 100)) / 100, 0.001, 30);
    if (shape.spread !== undefined)
      result.radius_m *= shape.spread + (shape.spreadVariation ?? 0) / 2;
  }
  result.head = {
    size: clamp(star.head.size * HEAD_SIZE_PER_OLD_UNIT, 0, 10),
    visible: star.head.visible,
    halo: clamp(star.head.glowStrength, 0, 4),
  };
  result.colour = colour(old, star, firework, inner, notes);
  const hold = clamp(star.head.brightnessHoldPercent / 100, 0.001, 0.999);
  result.brightness = [
    [0, star.head.opening.size.enabled ? star.head.opening.size.startPercent / 100 : 1],
    [hold, 1],
    [1, star.head.closing.size.enabled ? star.head.closing.size.endPercent / 100 : 0],
  ];
  result.trail = trail(old, star, notes);
  result.modifiers = [];
  if (old.strobe.enabled)
    notes.push(
      'v1 strobe retains frequency; duty cycle, dim phase, desynchronisation and strobing fraction use renderer defaults.',
    );
  if (old.strobe.enabled)
    result.modifiers.push(
      modifier('strobe', {
        rate_hz: old.strobe.frequencyHz,
        amount: old.strobe.amountPercent / 100,
        gap: 1 - old.strobe.dutyCycle,
      }),
    );
  if (old.crackle.enabled && old.crackle.probability > 0)
    result.modifiers.push(
      modifier('crackle', {
        at: clamp(1 - old.crackle.triggerWindowSeconds / result.life_s, 0, 1),
        count: old.crackle.fragmentCount,
        rate_hz: Math.max(0.001, old.crackle.probability * OLD_REFERENCE_RATE_HZ),
        amount: old.crackle.fragmentSpeed,
        spread: 'continuous',
      }),
    );
  if (!inner && old.split.enabled)
    result.modifiers.push(
      modifier(old.geometry === 'split_cross' ? 'crossette' : 'split', {
        at: old.split.delayRatio,
        count: old.split.fragments,
        amount: old.split.speed,
      }),
    );
  if (old.trailProfile === 'glitter')
    result.modifiers.push(modifier('glitter', { amount: old.trail.sparkle }));
  if (old.trailProfile === 'blink' && !old.strobe.enabled)
    result.modifiers.push(modifier('twinkle', { amount: old.trail.sparkle }));
  if (old.geometry === 'fish' || old.trailProfile === 'fish')
    result.modifiers.push(
      modifier('fish', {
        amount: old.geometryTuning.fish.wiggleStrength,
        rate_rad_s: old.geometryTuning.fish.wiggleRate,
      }),
    );
  if (old.geometry === 'whirl')
    result.modifiers.push(
      modifier('twist', {
        angular_speed_rad_s: old.geometryTuning.whirl.spinRate,
        amount: old.geometryTuning.whirl.spinStrength,
      }),
    );
  // Family-only v1 behaviours have no legacy switch: preserve the template's intent.
  for (const item of base.modifiers.filter((item) =>
    ['ghost', 'flutter', 'twinkle'].includes(item.kind),
  )) {
    if (!result.modifiers.some((mapped) => mapped.kind === item.kind))
      result.modifiers.push(structuredClone(item));
    if (item.kind === 'ghost')
      result.colour.reignition = base.colour.reignition ?? {
        at: item.at,
        duration: Math.max(0.001, item.gap),
        amount: 1,
      };
  }
  if (inner) result.pattern = 'sphere';
  else if (old.geometry === 'ring') result.pattern = 'ring';
  else if (['falling_tail', 'waterfall'].includes(old.geometry)) result.pattern = 'bottom';
  else if (old.geometry === 'fragment_cloud') result.pattern = 'random';
  if (old.geometry === 'waterfall')
    notes.push(
      'Waterfall width becomes a bottom hemisphere radius; scatter, drop-start and drift cannot be reproduced exactly.',
    );
  if (old.geometry === 'waterfall')
    result.radius_m = clamp(old.geometryTuning.waterfall.width / 2, 0, 500);
  if (old.split.enabled)
    notes.push(
      'v1 split children retain fragment count and trigger; child life, head size and trail life use renderer defaults.',
    );
  notes.push(
    'Old gravity ranges, terminal velocity, head softness and animated head size use mean gravity, halo and brightness curves; motion is an approximation.',
  );
  return result;
}

/** Maps a resolved old look while retaining template launch height and existing height timing. */
export function catalogueDesign(templateDesign, firework, effectModel = {}, notes = []) {
  const design = structuredClone(templateDesign);
  const old = resolvedOldDesign(firework, effectModel);
  design.seed = createHash('sha256').update(`catalogue:${firework.slug}`).digest().readUInt32BE(0);
  for (const burst of design.breaks) {
    const base = burst.layers[0];
    const outer = layer(base, old, old.stars.outer, firework, false, notes);
    const core = layer(burst.layers[1] ?? base, old, old.stars.core, firework, true, notes);
    burst.layers = old.stars.core.enabled ? [outer, core] : [outer];
    burst.core.enabled = old.burstFlashIntensity > 0;
    burst.core.flash_on = old.burstFlashIntensity > 0;
    burst.core.flash = clamp(old.burstFlashIntensity, 0, 10);
    burst.core.colour = hex(old.color, firework.primary_color ?? '#ffffff');
    burst.core.ring = old.geometry === 'ring';
    // Stars in the old inner layer are represented above, not duplicated as flash sparks.
    burst.core.count = 0;
    burst.fade.white_hot = 0;
    burst.fade.ember_at = 1;
    burst.fade.fade_at = 1;
    burst.fade.prime_s = 0;
  }
  if (design.launch) {
    const lift = old.launch.liftParticles;
    const tracer = hex(old.launch.shell.colour ?? lift.colour, '#fff3ce');
    design.launch.tail = !lift.enabled
      ? 'dark'
      : lift.motion.swirlStrength > 0
        ? 'heli'
        : lift.flicker.chance > 0.5
          ? 'glitter'
          : tracer === '#ffffff' || tracer === '#f8fcff'
            ? 'silver'
            : 'gold';
    design.launch.sparks = lift.enabled ? lift.amount : 0;
    design.launch.spread = clamp(
      lift.motion.turbulence + old.launch.shell.trail.tailAngle / 60,
      0,
      20,
    );
    design.launch.smoke = old.launch.smoke.enabled
      ? clamp((old.launch.smoke.opacity * old.launch.smoke.particles) / 100, 0, 4)
      : 0;
    notes.push(
      `Launch tracer ${tracer} uses nearest ${design.launch.tail} tail; v1 has no custom tracer or smoke colour. Old lift/fuse tuning is omitted to retain existing template lift time and height logic.`,
    );
  }
  if (design.ground) {
    const star = old.stars.outer;
    const mappedTrail = trail(old, star, notes);
    const mappedColour = colour(old, star, firework, false, notes);
    if (design.ground.comets) {
      Object.assign(design.ground.comets, {
        count: star.count,
        colour: mappedColour,
        size: clamp(star.head.size * HEAD_SIZE_PER_OLD_UNIT, 0, 10),
        sparks: mappedTrail.sparks,
        tail_life_s: mappedTrail.length_s,
        trail: mappedTrail.colour,
        glitter: mappedTrail.glitter,
      });
      notes.push(
        'Ground comet sequences retain template heights and timing; old aerial geometry and inner stars cannot be represented by this ground kind.',
      );
    }
    if (design.ground.fountain) {
      Object.assign(design.ground.fountain, {
        rate_per_s: star.emissionRate,
        colour: mappedColour.stops.at(-1)[1][0],
        size: clamp(star.head.size * HEAD_SIZE_PER_OLD_UNIT, 0, 10),
        life_s: mean(star.burst.life),
        glitter: mappedTrail.glitter,
        flicker: mappedTrail.flicker,
      });
      notes.push(
        'v1 fountain colour accepts one hex colour only. Primary colour retained; alternate palettes and life-relative colour fades need renderer support.',
      );
    }
  }
  if (
    design.kind === 'shell' &&
    firework.height_meters !== null &&
    firework.height_meters !== undefined
  ) {
    const heightM = Number(firework.height_meters);
    const referenceHeightM = design.launch.height_m;
    if (referenceHeightM <= 0)
      throw new Error('A shell template needs a positive reference height.');
    design.launch.time_s = Math.max(
      MIN_LAUNCH_TIME_S,
      design.launch.time_s * (heightM / referenceHeightM) ** HEIGHT_TIME_EXPONENT,
    );
    design.launch.height_m = heightM;
  }
  return upgradeDesign(design, 1);
}

/** Stable catalogue spelling for renderer keys, including camelCase keys. */
export function templateSlug(key) {
  return `renderer-${key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll('_', '-')}`;
}
