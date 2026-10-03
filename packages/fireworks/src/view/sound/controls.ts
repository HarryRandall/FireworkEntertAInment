/** Accessible framework-independent sound controls sharing persisted browser viewer preferences. */
import { SETTINGS, setSetting, setVolume, onSettings } from '../settings';
// Normalised volume step for keyboard and pointer controls, one percent of linear gain.
const VOLUME_STEP = 0.01;
/** Appends mute and volume controls to the native player, returning complete listener cleanup. */
export function mountSoundControls(bar: HTMLElement): () => void {
  const abort = new AbortController();
  const mute = document.createElement('button');
  mute.type = 'button';
  mute.title = 'Mute or unmute all previews';
  mute.addEventListener(
    'click',
    () => {
      setSetting('sound', !SETTINGS.sound);
    },
    { signal: abort.signal },
  );
  const label = document.createElement('label');
  label.textContent = 'Volume';
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = String(VOLUME_STEP);
  volume.setAttribute('aria-label', 'Sound volume');
  volume.style.cssText = 'flex:none;width:70px;min-width:0';
  volume.addEventListener(
    'input',
    () => {
      setVolume(Number(volume.value));
    },
    { signal: abort.signal },
  );
  label.append(volume);
  bar.append(mute, label);
  const unsubscribe = onSettings(() => {
    mute.textContent = SETTINGS.sound ? 'Mute' : 'Unmute';
    mute.setAttribute('aria-pressed', String(!SETTINGS.sound));
    if (document.activeElement !== volume) volume.value = String(SETTINGS.volume);
  });
  return () => {
    unsubscribe();
    abort.abort();
    mute.remove();
    label.remove();
  };
}
