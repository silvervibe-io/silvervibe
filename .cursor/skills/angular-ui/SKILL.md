---
name: angular-ui
description: Builds Angular UI in Silvervibe with signals, OnPush, Tailwind, and daisyUI. Use when creating or editing Angular components, templates, pages, or styles in silvervibe or vibestandup.
---

# Angular UI

1. Standalone component, `ChangeDetectionStrategy.OnPush`, `inject()` for services.
2. State is a `signal` or an NgRx feature. Do not add `BehaviorSubject` for component state. Prefer signals over Observables in components; bridge with `toSignal` / `httpResource` / Promises when an API is Observable-only.
3. Component APIs use signal-based `input()`, `output()`, `model()`, `viewChild()`, `contentChild()`, etc. — not `@Input` / `@Output` / `@ViewChild` decorators.
4. Forms use **Signal Forms** (`form()`, `FormField`, validators from `@angular/forms/signals`). Do not add new `FormBuilder` / `ReactiveFormsModule` / template-driven forms.
5. Template control flow is `@if`, `@for` (with `track`), `@switch`.
6. Put the page inside `sv-shell` from `@silvervibe/shared/ui`.
7. Use daisyUI classes from the project Tailwind entry. Check the daisyUI skill before inventing a component.
8. User-facing copy goes through **Transloco** (`@silvervibe/shared/i18n`). Follow the `transloco-i18n` skill — no new hard-coded UI strings; keep `en` + `nl`/`de`/`fr`/`el`/`es`/`pt`/`it`/`pl` in sync.
9. Add or update the colocated `.spec.ts` in the same change. Test the public method or rendered text.
10. Theme (issue #2): light-first **and** a first-class **dark** theme; calm, clear, user-friendly vibe (high readability, soft contrast — not loud/neon). Prefer shared tokens over one-off colors.
11. Lazy routes:

```typescript
{
  path: 'board',
  loadComponent: () => import('./board/board').then((m) => m.Board),
}
```
