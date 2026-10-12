# Brand mark & favicon

Calm, friendly mark for **SilverVibe™**: a front-facing meditation-cat
outline (closed eyes, crossed legs) with soft teal ✨-style sparkles
(“vibe”), paired with a Manrope wordmark (**SilverVibe** — one word, capitals
on S and V only).

## Assets

| File                                          | Use                                               |
| --------------------------------------------- | ------------------------------------------------- |
| `apps/silvervibe/public/brand/mark.svg`       | Icon (light; also follows `prefers-color-scheme`) |
| `apps/silvervibe/public/brand/mark-dark.svg`  | Icon for `data-theme="silvervibe-dark"`           |
| `apps/silvervibe/public/brand/logo.svg`       | Full logo light / compact                         |
| `apps/silvervibe/public/brand/logo-dark.svg`  | Full logo dark                                    |
| `apps/silvervibe/public/brand/logo-lg.svg`    | Hero / landing wordmark                           |
| `apps/silvervibe/public/favicon.svg`          | Browser tab (modern browsers)                     |
| `apps/silvervibe/public/favicon.ico`          | Safari / legacy fallback                          |
| `apps/silvervibe/public/apple-touch-icon.png` | iOS home screen (180×180)                         |

## Colors

| Token      | Hex (light) | Hex (dark) | Role                      |
| ---------- | ----------- | ---------- | ------------------------- |
| Silver     | `#9AA3AD`   | `#C5CCD6`  | “Silver” half of wordmark |
| Slate mark | `#5C6670`   | `#C5CCD6`  | Cat outline               |
| Vibe teal  | `#3D8B84`   | `#5EB5AD`  | “Vibe” half + ✨ sparkles |

Light SVGs also embed `@media (prefers-color-scheme: dark)` fallbacks. For
app chrome driven by `ThemeService`, prefer `mark-dark.svg` / `logo-dark.svg`
when `mode === 'dark'`.

Aligned with daisyUI theme tokens in `docs/theme.md` (cool slate + restrained
teal secondary/accent — no purple glow).

## Trademark (™)

Keep **™ outside the SVG** as adjacent HTML (superscript next to the wordmark).
On the landing hero, prefer **mark + HTML wordmark + ™** so spacing stays tight
and Manrope loads from the page (SVG-as-`<img>` cannot use page fonts).

## Favicon guidance (summary)

- Prefer **SVG** for Chromium/Firefox; keep **ICO** for Safari/legacy.
- Icon must stay readable at **16×16**: bold silhouette, few sparkles, no fine lines.
- Apple touch icon: opaque **180×180** PNG with padding; iOS rounds corners.
- Do not copy GitHub’s Octocat; this mark is an original sitting-cat profile.

## Usage in Angular

```html
<!-- Hero: mark + HTML wordmark + ™ -->
<img src="brand/mark.svg" alt="" width="80" height="80" />
<span>SilverVibe</span><span aria-hidden="true">™</span>

<!-- Compact lockup -->
<img src="brand/logo.svg" alt="SilverVibe" width="170" height="32" />
```

`index.html` links `favicon.svg` + `favicon.ico` + `apple-touch-icon.png`.
