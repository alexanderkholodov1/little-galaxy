# Portfolio runtime contract

The portfolio publishes `/tokens.css` at the same origin as
`/galaxy/`. This document is the handoff for coordinated P v0.1.0. The plan of
record remains `../portfolio/docs/plan/` on `main`; its architecture and CHANGELOG
should record this implementation contract in the coordinated portfolio change.

## Theme tokens

`/tokens.css` provides light values on `:root` (also applicable to
`:root[data-theme="light"]`) and dark values on `:root[data-theme="dark"]`.
Galaxy resolves the system preference before rendering, sets `data-theme`, and
follows OS changes until a visitor explicitly toggles the theme.

| Portfolio token | Local light fallback | Local dark fallback |
| --- | --- | --- |
| `--pf-paper` | `#f1f5f9` | `#071421` |
| `--pf-ink` | `#102e4c` | `#e1eaf4` |
| `--pf-action` | `#0050ae` | `#5fccf3` |
| `--pf-rule` | `#6b819a` | `#60788e` |
| `--pf-warning` | `#805000` | `#e7bd70` |
| `--pf-confirmed` | `#226640` | `#82cda2` |
| `--pf-font-display` | `"Spectral", Georgia, serif` | same |
| `--pf-font-text` | `"Archivo Narrow", "Trebuchet MS", sans-serif` | same |

Galaxy reads these through local aliases such as
`--paper: var(--pf-paper, #f1f5f9)`. Bundled CSS never assigns `--pf-*` variables,
so the portfolio's values remain authoritative regardless of stylesheet order.
Missing tokens, or an unavailable stylesheet, use the complete local fallbacks.
The portfolio should supply complete font stacks and load any faces it names.
Galaxy self-hosts Spectral 400 and Archivo Narrow 400/700.

`--pf-rule` is a control boundary and must contrast at least 3:1 against paper.
The local control fallbacks compute to 3.664:1 (light) and 4.044:1 (dark).
Pale local hairlines separate sections; they do not identify controls. Local text
contrast is 12.635:1 (light) and 15.275:1 (dark); action text is 6.949:1 and
10.095:1 respectively. The reference scene stays dark with local sky, star,
message and retry-control colors, independent of portfolio theme tokens.

## Credits in the game

The game does not fetch `/profile.json` or render profile/social navigation.
Every game route has a small `Credits` / `Créditos` control with a 44px target.
It opens a closable native dialog containing only the localized game name,
`Alexander Kholodov · USFQ`, and one portfolio home link (`/` in English,
`/es/` in Spanish). Escape closes it; focus stays inside while open and returns
to the control on close. Permanent object pages contain no extra profile links.
This supersedes the former corner identity mark and profile sheet (operator
correction, 2026-10-24). Palette/type tokens remain shared with the portfolio.

Implementation evidence: `App.tsx`, `App.test.tsx`, `styles.css`, and the viewport
acceptance journey in `tests/ui/viewport.spec.js`.

## Memory / P v1.1.0

G v0.6.0 adds the [format 1 season contract](memory-format.md). Serve the complete exported JSON
directory at `/galaxy/season/bad-2026/` and retain the SPA rewrite for `/galaxy/o/**`. A complete
static archive makes home replay and permanent pages work without Firestore or anonymous sign-in.
The ordinary fair home reads one aggregate snapshot; opening replay reads the compact archive.
Do not place Firebase credentials or owner UIDs in the public export. The emulator-only rehearsal
CLI exports files without closing the season, modifying the portfolio or publishing anything.
