/** Shared validated viewer preferences, persisted only in the current browser. */
const STORAGE_KEY = 'sc-viewer-settings';
// Prototype master volume, normalised linear gain.
const DEFAULT_VOLUME = 0.7;
/** Browser-wide rendering and camera preferences matching the prototype. */
export interface ViewerSettings {
  stats: boolean;
  sound: boolean;
  volume: number;
  smoke: boolean;
  stars: boolean;
  grid: boolean;
  free: boolean;
  shake: boolean;
}
/** Current preferences; use setSetting so mounted viewers and storage stay in sync. */
export const SETTINGS: ViewerSettings = {
  stats: false,
  sound: false,
  // Prototype master gain, normalised to the browser volume range.
  volume: DEFAULT_VOLUME,
  smoke: true,
  stars: true,
  grid: true,
  free: false,
  shake: true,
};
const defaults = { ...SETTINGS };
// Only these preferences affect rendered pixels or camera controls.
const VISUAL_KEYS = ['smoke', 'stars', 'grid', 'free', 'shake'] as const;
const listeners = new Set<() => void>();
let loaded = false;
function readSettings(encoded: string | null): void {
  if (encoded === null) {
    Object.assign(SETTINGS, defaults);
    return;
  }
  const value: unknown = JSON.parse(encoded);
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('Viewer preferences must be an object');
  for (const key of Object.keys(defaults) as (keyof ViewerSettings)[]) {
    const entry: unknown = key in value ? Reflect.get(value, key) : defaults[key];
    readPreference(key, entry);
  }
}
function readPreference(key: keyof ViewerSettings, entry: unknown): void {
  if (key === 'volume') {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 1)
      SETTINGS.volume = entry;
    else console.warn(`Ignoring invalid viewer preference: ${key}`);
  } else if (typeof entry === 'boolean') SETTINGS[key] = entry;
  else console.warn(`Ignoring invalid viewer preference: ${key}`);
}
function storageChanged(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    readSettings(event.newValue);
  } catch (cause) {
    console.warn('Could not read viewer preferences', cause);
  }
  for (const listener of listeners) listener();
}
/** Changes one validated boolean preference, persists it and updates all mounted viewers. */
export function setSetting(key: Exclude<keyof ViewerSettings, 'volume'>, value: boolean): void {
  SETTINGS[key] = value;
  persistSettings();
}
function persistSettings(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SETTINGS));
  } catch (cause) {
    console.warn('Could not save viewer preferences', cause);
  }
  for (const listener of listeners) listener();
}
/** Loads browser preferences once and returns cleanup for a shared preference subscription. */
export function onSettings(listener: () => void): () => void {
  if (!loaded) {
    try {
      readSettings(window.localStorage.getItem(STORAGE_KEY));
    } catch (cause) {
      console.warn('Could not read viewer preferences', cause);
    }
    loaded = true;
  }
  if (listeners.size === 0) window.addEventListener('storage', storageChanged);
  listeners.add(listener);
  listener();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', storageChanged);
  };
}

/** Subscribes to visual changes only, including initial state; audio changes never request a draw. */
export function onVisualSettings(listener: () => void): () => void {
  let previous: boolean[] = [];
  return onSettings(() => {
    const current = VISUAL_KEYS.map((key) => SETTINGS[key]);
    if (current.every((value, index) => value === previous[index])) return;
    previous = current;
    listener();
  });
}

/** Sets normalised linear volume, persists it and notifies all viewers; invalid values are rejected. */
export function setVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1)
    throw new RangeError('Volume must be between zero and one');
  SETTINGS.volume = volume;
  persistSettings();
}
