# Portfolio runtime contract

The portfolio publishes `/tokens.css` and `/profile.json` at the same origin as
`/galaxy/`. This document is the handoff for coordinated P v0.1.0; the external
plan is read-only in this workspace. Its architecture and CHANGELOG must record
this contract in the portfolio PR.

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

## `/profile.json`

The endpoint serves JSON. The consumer sends `Accept: application/json`, aborts
after five seconds, and treats network errors, unsuccessful HTTP responses,
invalid JSON and an invalid top-level profile as unavailable. No invented
personal information is substituted.

```json
{
  "name": "Public portfolio name",
  "role": { "en": "Public role", "es": "Rol público" },
  "nav": [
    {
      "href": { "en": "/", "es": "/es/" },
      "label": { "en": "Portfolio", "es": "Portafolio" }
    }
  ],
  "socials": [
    { "href": "https://example.com/", "label": "Public social label" }
  ],
  "links": []
}
```

- The root must be an object with a nonempty string `name`; surrounding name
  whitespace is trimmed. `role` is optional portfolio content, reserved for a
  role line; this foundation consumer does not render it. Unknown fields are
  ignored. The example is a schema illustration, not operator content.
- `links`, `nav` and `socials` are optional arrays, combined in that order.
  Invalid entries are skipped. Duplicates with the same resolved EN and ES href
  pair keep their first occurrence. Absent arrays produce an empty link list.
- Each entry requires `href` as either a string shared by both languages, or
  an object with safe strings for **both** `en` and `es`. The current language
  selects the href. An unsafe or missing language rejects the entire entry.
- Safe hrefs are root-relative paths beginning with a single `/`, or absolute
  `https:` URLs. Protocol-relative URLs, other schemes, whitespace, backslashes
  and control characters are rejected. Hrefs are not trimmed into validity.
- `label` is a nonempty string shared by both languages, or an object requiring
  nonempty `en`. Missing/empty `es` falls back to English. Labels are trimmed and
  rendered as text, never HTML.
- When the profile or its links are unavailable, the navigation falls back to
  `Portfolio` at `/` in English and `Portafolio` at `/es/` in Spanish. The signature
  always points to that language's portfolio root and uses `name` if available,
  otherwise `Collective Galaxy` / `Galaxia Colectiva`.

Implementation evidence: `apps/web/src/profile.ts`, `profile.test.ts`,
`App.test.tsx`, and `styles.css`.
