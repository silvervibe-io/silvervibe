# Design system / theme foundation

Issue: [#2](https://github.com/silvervibe-io/silvervibe/issues/2). Theme store: [#57](https://github.com/silvervibe-io/silvervibe/issues/57).

## Goals

- **Light-first**, with a first-class **dark** theme
- Calm, clear, user-friendly (soft contrast, high readability — not neon/purple glow)
- Shared tokens via daisyUI + CSS variables; new product UI should use semantic colors (`bg-base-100`, `text-base-content`, `btn-primary`, …)

Marketing pages (landing, vibestandup home, privacy) use the same semantic
tokens so light/dark switch covers the full surface, not only chrome controls.

## Themes

| `data-theme`      | Mode  | Role                        |
| ----------------- | ----- | --------------------------- |
| `silvervibe`      | Light | Default                     |
| `silvervibe-dark` | Dark  | `prefersdark` + user toggle |

Source: `libs/shared/ui/src/styles/silvervibe-themes.css`

## How apps opt in

1. In `styles.css`:

```css
@import 'tailwindcss';
@plugin "daisyui" {
  themes: false;
}
@import '../../../libs/shared/ui/src/styles/silvervibe-themes.css';
@source '../';
@source '../../../libs';
```

2. In `app.config.ts`, add `provideSilvervibeTheme()` from `@silvervibe/shared/ui`.
3. Prefer `sv-shell` for app chrome (includes `sv-theme-toggle`).
4. Set `<html data-theme="silvervibe">` in `index.html` to avoid a flash before JS runs.

## Runtime API

NgRx Signal Store (same pattern as neo-scout):

```ts
import { ThemeStore } from '@silvervibe/stores/theme';
import { provideSilvervibeTheme, ThemeToggle } from '@silvervibe/shared/ui';

inject(ThemeStore).toggle(); // or setMode('dark' | 'light')
```

UI control: `<sv-theme-toggle />` — daisyUI `swap swap-rotate` sun/moon icons.

Preference is stored in `localStorage` under `silvervibe.theme`.

## Checklist (acceptance #2 / #57)

- [ ] Both apps import shared theme CSS
- [ ] `provideSilvervibeTheme()` registered
- [ ] `ThemeStore` + `sv-theme-toggle` switch `data-theme` between `silvervibe` and `silvervibe-dark`
- [ ] Landing / vibestandup home / shell show the toggle
- [ ] Landing / home / privacy surfaces switch with `data-theme` (no hard-coded light greys)
- [ ] New screens use daisyUI semantic colors (`bg-base-*`, `text-base-content`, …)
