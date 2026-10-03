# Viewer camera and player

Renderer version `0.6.0` identifies the new live camera framing. Particle maths and
existing numerical goldens retain their previous outputs.

`Viewer` defaults to audience camera controls and click-to-toggle playback.
`ui: true` adds a native play/restart/scrub/speed/recentre/settings bar. The renderer
owns this DOM transport so it also works without React or an application UI kit.
Its native controls follow the prototype rather than introducing a React/registry
dependency into the WebGL package.

Consumers which prepare stills before interaction can omit `ui` and call
`buildPlayer(viewer)` once preparation finishes. They own its returned cleanup and
call it before disposing the viewer. The review page uses this sequence so an
enabled Play button means thumbnail generation has finished seeking and drawing.
Native scrubbing captures the requested seconds before pausing, since pause emits
a synchronous readout update. A seek preserves play state; the native scrubber
explicitly pauses first.

Drag to orbit. The eye stays above the ground; dragging past the floor looks up.
Wheel and two-touch pinch zoom along the ground, with higher tilt limits closer to
the show. **Free camera** adds right-drag or Shift-drag panning and wider zoom.
Resize refits only an untouched camera. `setShots(shots, true)` and
`setDesign(design, true)` retain a user pose; reset returns to fitted framing.
`framingFor(shots, tight, aspect, fov)` is DOM-free and returns metre tuples for
live audience or raised poster framing. Poster capture/moment upgrades are separate.

Preferences share the prototype's `sc-viewer-settings` browser key. Only known
boolean fields load; malformed values and storage failures produce visible console
warnings. Smoke, starfield, grid, free camera, shake and stats update mounted views.
The sound preference is retained in storage, but audio controls/playback are absent.

Large close shell booms shake only during playback, delayed by capped acoustic
travel time. Controls rebuild an absolute pose before shake, so offsets do not
accumulate. Pause and paused seeks redraw without shake; reduced motion suppresses it.

Space toggles the last-clicked mounted viewer. It ignores buttons, editable fields,
sliders, repeats and command modifiers, preventing native buttons from toggling
playback twice. Canvas taps focus the viewer. Movement at any point, cancelled
pointers, right/Shift gestures and multi-touch suppress click-to-toggle, including a
drag which returns to its starting position. `controls: false` and
`clickToPause: false` disable those behaviours independently.

The play button updates only when playback state changes. It keeps the same DOM
node and focus during frame updates. `dispose()` removes the player, gesture,
keyboard and settings listeners, camera controls and GPU query resources.

Node tests verify framing, floor/zoom constraints, shake, preference validation,
click suppression, shortcut cleanup, unfocused scrubbing and paused transport state.
Browser journeys cover large/phone views,
finales, wheel, real Chromium touch dispatch, free pan, playback focus, reload
persistence and profiling. They are written and typechecked; the composer must run
them and capture desktop/390 px light/dark screenshots. Real touch devices and the
owner's visual comparison remain required evidence.
