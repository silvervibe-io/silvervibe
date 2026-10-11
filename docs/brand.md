# Brand mark & favicon

Calm, friendly mark for **SilverVibe™**: a sitting-cat silhouette with soft
teal sparkles (“vibe”), paired with a Manrope wordmark (**SilverVibe** — one
word, capitals on S and V only).

## Assets

| File                                          | Use                           |
| --------------------------------------------- | ----------------------------- |
| `apps/silvervibe/public/brand/mark.svg`       | Icon / avatar / app chrome    |
| `apps/silvervibe/public/brand/logo.svg`       | Full logo (mark + wordmark)   |
| `apps/silvervibe/public/favicon.svg`          | Browser tab (modern browsers) |
| `apps/silvervibe/public/favicon.ico`          | Safari / legacy fallback      |
| `apps/silvervibe/public/apple-touch-icon.png` | iOS home screen (180×180)     |

## Colors

| Token      | Hex       | Role                       |
| ---------- | --------- | -------------------------- |
| Silver     | `#9AA3AD` | “Silver” half of wordmark  |
| Slate mark | `#5C6670` | Cat silhouette (light UI)  |
| Vibe teal  | `#3D8B84` | “Vibe” half + sparkles     |

Dark `prefers-color-scheme` variants are embedded in the SVGs (`#C5CCD6` /
`#5EB5AD`).

Aligned with daisyUI theme tokens in `docs/theme.md` (cool slate + restrained
teal secondary/accent — no purple glow).

## Favicon guidance (summary)

- Prefer **SVG** for Chromium/Firefox; keep **ICO** for Safari/legacy.
- Icon must stay readable at **16×16**: bold silhouette, few stars, no fine lines.
- Apple touch icon: opaque **180×180** PNG with padding; iOS rounds corners.
- Do not copy GitHub’s Octocat; this mark is an original sitting-cat profile.

## Usage in Angular

```html
<img src="brand/logo.svg" alt="SilverVibe" width="170" height="32" /> <img src="brand/mark.svg" alt="" width="32" height="32" />
```

`index.html` links `favicon.svg` + `favicon.ico` + `apple-touch-icon.png`.
