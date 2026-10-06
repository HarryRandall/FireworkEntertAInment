/** Small framework-independent viewer transport and settings, shared by browser consumers. */
import { mountSoundControls } from './sound/controls';
import type { Viewer } from './viewer';
import { SETTINGS, setSetting, type ViewerSettings } from './settings';
// Keyboard nudges, in show seconds; the range itself must retain arbitrary exact instants.
const SEEK_STEP_S = 0.01;
// Prototype quarter-speed multiplier, dimensionless.
const QUARTER_SPEED = 0.25;
const SPEEDS = [QUARTER_SPEED, 0.5, 1, 2];
const ROWS: readonly [Exclude<keyof ViewerSettings, 'volume'>, string][] = [
  ['stats', 'Frame rate and particles'],
  ['smoke', 'Smoke'],
  ['ground', 'Ground lattice'],
  ['shake', 'Camera shake'],
  ['free', 'Free camera'],
];
const CSS = `
.sc-player{position:absolute;inset:0;pointer-events:none;color:#eef0f5;font:500 12px system-ui;z-index:1}
.sc-player-bar{position:absolute;bottom:10px;left:10px;right:10px;display:flex;gap:6px;align-items:center;padding:6px;border-radius:12px;background:rgba(10,12,20,.85);pointer-events:auto;flex-wrap:wrap}
.sc-player button,.sc-player select{background:#202738;color:inherit;border:1px solid #637087;border-radius:6px;padding:6px;cursor:pointer;font:inherit}
.sc-player :focus-visible{outline:2px solid #2ee0a3;outline-offset:2px}
.sc-player input[type=range]{flex:1;min-width:70px;accent-color:#2ee0a3}
.sc-player-settings{position:absolute;right:10px;bottom:60px;background:#101726;border:1px solid #637087;border-radius:10px;padding:10px;max-width:calc(100% - 20px);pointer-events:auto}
.sc-player-settings label{display:flex;gap:8px;padding:5px}.sc-player-stats{position:absolute;top:10px;left:10px;background:#101726;padding:6px;border-radius:6px}
`;
function button(label: string, action: () => void, signal: AbortSignal): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.addEventListener('click', action, { signal });
  return element;
}
function settings(signal: AbortSignal): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'sc-player-settings';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'View settings');
  for (const [key, title] of ROWS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.setting = key;
    input.checked = SETTINGS[key];
    input.addEventListener(
      'change',
      () => {
        setSetting(key, input.checked);
      },
      { signal },
    );
    label.append(input, title);
    panel.append(label);
  }
  const hint = document.createElement('p');
  hint.textContent = 'Drag to orbit. Scroll or pinch to zoom. Free camera adds Shift-drag panning.';
  panel.append(hint);
  return panel;
}
/** Mounts one accessible native transport; state changes preserve the play button's DOM and focus. */
export function buildPlayer(viewer: Viewer): () => void {
  const abort = new AbortController();
  const signal = abort.signal;
  const root = playerRoot();
  const bar = document.createElement('div');
  bar.className = 'sc-player-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Playback');
  const play = button(
    'Play',
    () => {
      viewer.toggle();
    },
    signal,
  );
  const range = seekRange(viewer, signal);
  const speed = speedSelect(viewer, signal);
  const time = document.createElement('output');
  time.setAttribute('aria-label', 'Playback time');
  const panel = settings(signal);
  const gear = button(
    'Settings',
    () => {
      panel.hidden = !panel.hidden;
      gear.setAttribute('aria-expanded', String(!panel.hidden));
    },
    signal,
  );
  gear.setAttribute('aria-expanded', 'false');
  const stats = statsElement();
  wireTransport(viewer, signal, { root, bar, play, range, speed, panel, gear, time });
  const removeSound = mountSoundControls(bar);
  root.append(bar, panel, stats);
  viewer.container.append(root);
  const unsubscribe = viewer.on(() => {
    paint(viewer, { play, range, speed, panel, stats, time });
  });
  return () => {
    removeSound();
    unsubscribe();
    abort.abort();
    root.remove();
  };
}
function seekRange(viewer: Viewer, signal: AbortSignal): HTMLInputElement {
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = String(viewer.duration);
  // Native step sanitisation would round both playback readouts and authored seeks.
  range.step = 'any';
  range.setAttribute('aria-label', 'Preview time');
  range.addEventListener(
    'keydown',
    (event) => {
      const direction = seekDirection(event.key);
      if (direction === 0) return;
      event.preventDefault();
      const time_s = viewer.t + direction * SEEK_STEP_S;
      viewer.pause();
      viewer.seek(time_s);
      range.value = String(viewer.t);
    },
    { signal },
  );
  range.addEventListener(
    'input',
    () => {
      // Pause emits synchronously and paints the old time back into an unfocused range.
      const time_s = Number(range.value);
      viewer.pause();
      viewer.seek(time_s);
    },
    { signal },
  );
  return range;
}
function seekDirection(key: string): number {
  if (key === 'ArrowRight' || key === 'ArrowUp') return 1;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return -1;
  return 0;
}
function speedSelect(viewer: Viewer, signal: AbortSignal): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Playback speed');
  for (const speed of SPEEDS) {
    const option = document.createElement('option');
    option.value = String(speed);
    option.textContent = `${String(speed)}×`;
    select.append(option);
  }
  select.value = String(viewer.speed);
  select.addEventListener(
    'change',
    () => {
      viewer.setSpeed(Number(select.value));
    },
    { signal },
  );
  return select;
}
function paint(
  viewer: Viewer,
  elements: {
    play: HTMLButtonElement;
    range: HTMLInputElement;
    speed: HTMLSelectElement;
    panel: HTMLElement;
    stats: HTMLElement;
    time: HTMLOutputElement;
  },
): void {
  elements.time.textContent = `${viewer.t.toFixed(2)} / ${viewer.duration.toFixed(2)} s`;
  const label = viewer.playing ? 'Pause' : 'Play';
  if (elements.play.textContent !== label) elements.play.textContent = label;
  elements.range.max = String(viewer.duration);
  if (document.activeElement !== elements.range) elements.range.value = String(viewer.t);
  elements.speed.value = String(viewer.speed);
  elements.stats.hidden = !SETTINGS.stats;
  if (SETTINGS.stats)
    elements.stats.textContent = `${String(Math.round(viewer.fps))} fps · ${String(viewer.count)} particles`;
  for (const input of Array.from(elements.panel.querySelectorAll('input[data-setting]'))) {
    if (!(input instanceof HTMLInputElement)) continue;
    const key = input.dataset.setting;
    if (key !== undefined && key in SETTINGS)
      input.checked = SETTINGS[key as Exclude<keyof ViewerSettings, 'volume'>];
  }
}

function wireTransport(
  viewer: Viewer,
  signal: AbortSignal,
  elements: {
    root: HTMLElement;
    bar: HTMLElement;
    play: HTMLButtonElement;
    range: HTMLInputElement;
    speed: HTMLSelectElement;
    panel: HTMLElement;
    gear: HTMLButtonElement;
    time: HTMLOutputElement;
  },
): void {
  const { root, bar, play, range, speed, panel, gear, time } = elements;
  root.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        panel.hidden = true;
        gear.setAttribute('aria-expanded', 'false');
        gear.focus();
      }
    },
    { signal },
  );
  bar.append(
    play,
    button(
      'Restart',
      () => {
        viewer.seek(0);
        viewer.play();
      },
      signal,
    ),
    range,
    time,
    speed,
    button(
      'Reset view',
      () => {
        viewer.resetCamera();
      },
      signal,
    ),
    gear,
  );
}

function statsElement(): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'sc-player-stats';
  return element;
}
function playerRoot(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'sc-player';
  const style = document.createElement('style');
  style.textContent = CSS;
  element.append(style);
  return element;
}
