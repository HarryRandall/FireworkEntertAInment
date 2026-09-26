import { isRecord, rgbObjectToHex } from './control-values.ts';

/** Catalogue swatches are derived display metadata, never renderer input. */
export function fireworkColourMetadata(settings: unknown): {
  primaryColor: string | null;
  secondaryColor: string | null;
  colorPalette: string[];
} {
  const colours: string[] = [];
  function add(value: unknown) {
    const hex = rgbObjectToHex(value);
    if (hex && !colours.includes(hex)) colours.push(hex);
  }
  if (isRecord(settings)) {
    if (isRecord(settings.colour) && settings.colour.enabled === false) {
      colours.push('#ffffff');
    } else if (isRecord(settings.stars)) {
      for (const key of ['outer', 'core']) {
        const layer = settings.stars[key];
        if (!isRecord(layer) || layer.enabled === false) continue;
        const pattern = isRecord(layer.colourPattern) ? layer.colourPattern : {};
        const palette = Array.isArray(pattern.colours) ? pattern.colours : [];
        if (palette.length) {
          for (const entry of pattern.mode === 'solid' ? palette.slice(0, 1) : palette) {
            if (isRecord(entry)) add(entry.color);
          }
        } else {
          add(layer.color ?? (key === 'core' ? settings.secondaryColor : settings.color));
          if (key === 'outer') add(settings.secondaryColor);
        }
      }
    }
  }
  return {
    primaryColor: colours[0] ?? null,
    secondaryColor: colours[1] ?? null,
    colorPalette: colours.slice(0, 12),
  };
}
