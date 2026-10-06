---
name: angular-ui
description: Builds Angular UI in Silvervibe with signals, OnPush, Tailwind, and daisyUI. Use when creating or editing Angular components, templates, pages, or styles in silvervibe or vibestandup.
---

# Angular UI

1. Standalone component, `ChangeDetectionStrategy.OnPush`, `inject()` for services.
2. State is a `signal` or an NgRx feature. Do not add `BehaviorSubject` for component state.
3. Template control flow is `@if`, `@for` (with `track`), `@switch`.
4. Put the page inside `sv-shell` from `@silvervibe/shared/ui`.
5. Use daisyUI classes from the project Tailwind entry. Check the daisyUI skill before inventing a component.
6. Add or update the colocated `.spec.ts` in the same change. Test the public method or rendered text.
7. Lazy routes:

```typescript
{
  path: 'board',
  loadComponent: () => import('./board/board').then((m) => m.Board),
}
```
