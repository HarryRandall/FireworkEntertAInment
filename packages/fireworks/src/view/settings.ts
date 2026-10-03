/** Shared validated viewer preferences, persisted only in the current browser. */
const STORAGE_KEY = 'sc-viewer-settings';
/** Browser-wide rendering and camera preferences matching the prototype. */
export interface ViewerSettings {
  stats: boolean;
  sound: boolean;
  smoke: boolean;
  stars: boolean;
  grid: boolean;
  free: boolean;
  shake: boolean;
}
/** Current preferences; use setSetting so mounted viewers and storage stay in sync. */
export const SETTINGS: ViewerSettings = {
  stats: false,
  sound: true,
  smoke: true,
  stars: true,
  grid: true,
  free: false,
  shake: true,
};
const defaults = { ...SETTINGS };
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
    if (typeof entry === 'boolean') SETTINGS[key] = entry;
    else console.warn(`Ignoring invalid viewer preference: ${key}`);
  }
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
export function setSetting(key: keyof ViewerSettings, value: boolean): void {
  SETTINGS[key] = value;
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
