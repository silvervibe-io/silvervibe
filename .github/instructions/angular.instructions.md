---
applyTo: "apps/silvervibe/**/*.{ts,html},apps/vibestandup/**/*.{ts,html},libs/shared/**/*.{ts,html}"
---

# Angular / shared UI review

## Comment only on

- Broken templates (wrong bindings, missing `track` that causes real list bugs)
- Incorrect signal usage that breaks change detection or leaks subscriptions
- Security issues in templates (unsafe HTML / user content)

## Do not comment on

- Preference for Observables vs signals when signals are used intentionally
- Suggesting NgModules (standalone only)
- Constructor DI vs `inject()` (`inject()` is preferred)
- Style / formatting (CI handles it)
