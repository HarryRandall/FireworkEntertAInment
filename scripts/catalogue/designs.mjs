import { upgradeDesign } from '../../packages/renderer/src/schema/index.ts';

// Renderer adjustment convention: time scales with the square root of height.
const HEIGHT_TIME_EXPONENT = 0.5;
// v1 schema minimum, seconds; a zero-height shell still needs a valid lift time.
const MIN_LAUNCH_TIME_S = 0.001;

/** Applies catalogue colour and shell height without converting old simulation tuning. */
export function catalogueDesign(templateDesign, firework) {
  const design = structuredClone(templateDesign);
  const colours =
    firework.color_palette.length >= 2
      ? firework.color_palette
      : firework.primary_color
        ? [firework.primary_color]
        : null;
  if (colours) {
    const colour = {
      mode: colours.length >= 2 ? 'alternate' : 'solid',
      stops: [
        [0, colours],
        [1, colours],
      ],
    };
    // Inner pistils retain their contrast; Saturn's planet and ring are both main layers.
    for (const burst of design.breaks) {
      for (const layer of burst.layers.filter(
        (layer) => !layer.name.toLowerCase().includes('pistil'),
      )) {
        layer.colour = structuredClone(colour);
      }
    }
    if (design.ground) {
      for (const part of Object.values(design.ground)) {
        if (typeof part === 'object' && part !== null && 'colour' in part) {
          part.colour =
            typeof part.colour === 'string'
              ? (firework.primary_color ?? colours[0])
              : structuredClone(colour);
        }
      }
    }
  }
  // Explicit old metallic modes change the trail, not the main star palette.
  const mode =
    firework.render_overrides_json.stars?.outer?.burstTrail?.colourMode ??
    firework.render_overrides_json.burstTrail?.colourMode;
  // sRGB values of the old engine's linear hot trail colours, rounded to bytes.
  const trailColours = { gold: '#fff3ce', silver: '#f8fcff', ember: '#ffce8b', star: 'star' };
  if (Object.hasOwn(trailColours, mode)) {
    for (const burst of design.breaks) {
      for (const layer of burst.layers.filter(
        (layer) => !layer.name.toLowerCase().includes('pistil'),
      )) {
        layer.trail.colour = trailColours[mode];
      }
    }
  }
  if (design.kind === 'shell' && firework.height_meters !== null) {
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
