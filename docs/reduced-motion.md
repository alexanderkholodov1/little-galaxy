# Reduced-motion visibility audit

The booth scene overlay stays mounted and normally disappears through the terminal opacity of
`scene-crossfade`. Disabling that animation left its default opacity at one, covering the scene.
Under `prefers-reduced-motion: reduce` it now has explicit opacity zero and no animation.

All other reduced-motion rules and consumers were checked:

- `styles.css` scroll behavior only changes scrolling and has no element lifetime.
- Shooting-star messages normally disappear at the end of `star-message`. They now use a
  stationary, six-second step animation with terminal opacity zero. `Screen.tsx` also removes
  expired effects on its independent 500ms timer; historical playback can retain a message node,
  so the CSS terminal state must remain safe independently of that cleanup.
- `version-crossfade` intentionally covers a pending version reload. Its reduced-motion state
  is explicitly opaque. `Screen.tsx` reloads after a 600ms timer and clears the cover on effect
  cleanup, independent of animation completion; no animation-end listener controls its lifetime.
- `SkyEffects.tsx` removes travel under reduced motion but still computes time-based opacity
  and effect expiry. `GalaxyScene.tsx` removes camera drift and interpolation; neither controls
  disappearance of a DOM overlay.

`tests/ui/reduced-motion.spec.js` uses Chromium with `reducedMotion: 'reduce'`. It verifies the
actual booth scene on load and across scene routes, plus terminal message/reload CSS states.
Both regressions fail against the original stylesheet (opacity one instead of zero) and pass
with this fix. No hosted preview or physical-device acceptance is claimed by these local tests.
