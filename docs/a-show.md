# A-show presentation audit

The operator's 1.0.0-alpha.9.0.6 work package targets recruiters opening the current game on
phones and laptops. The current Unbounded/Figtree typefaces, material colours and glow remain.
Home uses one measured status/action stack; the author attribution is its colophon. The workshop
keeps its large specimen and aligned readings. No physics, limits, rules, data model or workflows
are changed.

## Defects and repairs

- The welcome scrim left the entire HUD visible. Name entry and settings also left interactive
  controls underneath their sheets. Foreground sheets now hide that background chrome; settings
  reserve a full close-button row and clip scrolling content below it.
- The resting notice used fixed coordinates outside the home layout, the disabled launch button
  retained its active appearance, and the timelapse link used the browser's default blue. The
  notice now participates in the home stack, above visibly disabled launch controls, with a
  44px, themed timelapse action. The notice follows live language changes and disappears with
  Home while an existing workshop draft remains editable.
- Attribution floated separately below THROW. It now aligns beneath the dock, with space reserved
  for the round-button labels. Focus and author sheets participate in the same stack.
- The theme toggle and workshop tabs measured 36px; timelapse play measured 42×38.25px and its
  speed select 69×41px at 360px. These controls now meet the 44px phone target.
- Long specimen/player names and Spanish labels could squeeze controls or truncate button text.
  Names and buttons wrap, grids reserve range-input space, and sheets scroll within the viewport.
- Unselected type/ammo/toggle text and muted sound icons used literal pale colours even on light
  panels. They now use theme text colours. Action buttons retain the original warm material.
- The error card competed with the remaining UI, and the network fallback still claimed assets
  came from jsDelivr. The error is centred in a clear foreground, including on the timelapse;
  the fallback now describes the actual loading failure.

The timelapse link's solid reference pairs measure 8.78:1 (sky blue on dark slate) and 5.39:1
(deep blue on cream). Transparent glass still depends on the actual rendered sky; screenshots
are part of the audit, not a blanket contrast certification for every possible scene pixel.

## Evidence and regression coverage

Screenshots and per-state geometry readings live in `.tmp/show/before/` and `.tmp/show/after/`,
with subdirectories `<width>x<height>-<en|es>-<dark|light>`. The before client is preserved under
`.tmp/show/baseline/`. Viewports: 360×780, 390×844, 412×915, 768×1024, 1280×800, 1920×1080.
Both matrices use system reduced motion and local Auth/Firestore emulators, blocking nonlocal
requests. These are local browser captures, not hosted or physical-device acceptance.

`tests/ui/layout.spec.js` joins the existing `pnpm run test:ui` emulator journey. Its default
journeys use the longer Spanish labels/light panels on a 360px phone and English/dark panels
at 1280px; `GALAXY_LAYOUT_MATRIX=1 pnpm run test:ui` expands both languages/themes at both
widths. Both variants check: intro, sound, scroll positions in settings, author, every
workshop type and surface tab, name validation/long names/keyboard-sized viewport, pad/aim/result,
THROW, AURORA, offline notification, a live freeze during editing, resting Home and timelapse.
Geometry uses actual element boxes after fonts and finite animations settle. It respects clipped
scroll containers, includes disabled controls, and exempts only the timelapse action contained by
the notice itself from the notice-intersection check. There are no fixed sleeps or retries.

The default geometry coverage fits the existing six-minute CI journey job without workflow edits.
The full eight-case local UI matrix passed; the screenshot audit expands to all six viewport sizes.

Local check and relay/rehearsal evidence is recorded as work progresses in
`.tmp/CHECKPOINT-show.md`. No push, PR, deploy or physical-phone claim is made by this work package.
The companion plan changelog entry is staged in `docs/plan-updates/alpha9-show.patch`.
