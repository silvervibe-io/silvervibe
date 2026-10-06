---
name: feature-flags
description: Implements OpenFeature evaluations with GrowthBook as the provider for Silvervibe Nest and Angular apps. Use when adding feature flags, experiments, rollouts, or GrowthBook config.
---

# Feature flags

## Placement

- Nest: OpenFeature server SDK + GrowthBook provider in `apps/api`.
- Angular: OpenFeature web SDK + GrowthBook provider in a shared lib (planned `@silvervibe/shared/feature-flags`).
- GrowthBook project/env keys come from env vars (`GROWTHBOOK_CLIENT_KEY`, `GROWTHBOOK_API_HOST`).

## Rules

1. Wrap every evaluation in OpenFeature (`client.getBooleanValue`, etc.).
2. Pass workspace/user attributes for targeting (`workspaceId`, `firebaseUid`).
3. Keep entitlement truth in Neon; use a flag only to gate rollout of an already-entitled tool.
4. After adding a flag, document the key in `docs/platform.md`.
