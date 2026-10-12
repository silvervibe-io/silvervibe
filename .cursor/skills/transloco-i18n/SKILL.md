---
name: transloco-i18n
description: Adds and maintains Transloco i18n in Silvervibe Angular apps and shared libs. Use when translating UI, adding locales, i18n keys, language switchers, or working under libs/shared/i18n.
---

# Transloco i18n (Silvervibe)

## Stack

- Library: `@jsverse/transloco` (v9.x for Angular ≥20 / this repo’s Angular 22).
- Shared Nx lib: `@silvervibe/shared/i18n` (`libs/shared/i18n`) — `provideSilvervibeI18n()`, loader, locale list.
- Catalogs: JSON under `libs/shared/i18n/assets/i18n/` (bundled via `catalogs.ts`; also copied to app assets for tooling).
- Default language: **`en`**.
- Target languages: **`nl`**, **`de`**, **`fr`**, **`el`**, **`es`**, **`pt`**, **`it`**, **`pl`**.

## Rules

1. No user-facing hard-coded copy in templates or TS — use Transloco keys (`*transloco`, pipe, or `TranslocoService`).
2. Key style: **nested**, scoped by area — `common.*`, `auth.*`, `landing.*`, `standup.*`, `shell.*`. Prefer `auth.signIn.title` over English-as-key.
3. Do **not** translate brand/product names (**SilverVibe**, **VibeStandup**, legal entity names) unless marketing explicitly asks.
4. Keep Nest/API messages as **stable codes or keys**; translate on the client.
5. When adding a key in `en`, add the same key to **all** locale files in the same change (`nl`, `de`, `fr`, `el`, `es`, `pt`, `it`, `pl`). Empty string is worse than a temporary English fallback only if product accepts it — prefer real translations.
6. Runtime switch via shared shell language control; persist choice (localStorage) when that helper exists.
7. Wire apps with `provideSilvervibeI18n()` in `app.config.ts` (alongside auth/theme). Use `reRenderOnLangChange: true`.
8. Specs: assert translation **keys** or mock `TranslocoService` / provide test loader — do not assert locale-specific prose unless testing the catalog.

## Nx / boundaries

- i18n helpers live in `scope:shared`. Prefer `type:util` or `type:feature` as tagged for the lib; UI that only displays strings stays in existing feature/ui libs and **depends on** i18n.
- `type:ui` must not pull data-access; Transloco config/providers are fine from apps and feature libs.

## Editor / MCP

- Use **i18n Ally** (`lokalise.i18n-ally`) for missing keys and inline hints.
- For Transloco API docs: Context7 or the `transloco` gitmcp entry in `.cursor/mcp.json`.
- Optional TMS: Lokalise MCP (`lokalise_sd` / `lokalise_pm`) after OAuth — not required for in-repo JSON catalogs.

## Git

Ship i18n work on an issue branch from `develop`, e.g. `feature/<n>-transloco-i18n`. PR base = `develop`.
