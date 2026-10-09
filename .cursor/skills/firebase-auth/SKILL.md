---
name: firebase-auth
description: Integrates Firebase Auth with Silvervibe Angular apps and Nest JWT verification. Use when adding login, guards, auth interceptors, or Firebase Admin setup.
---

# Firebase Auth

## Git

Auth foundation ships on an issue branch from `develop`, e.g. `feature/5-firebase-auth`.
Never commit service-account JSON or `.env`. See `docs/branching.md` and `docs/firebase.md`.

## Provisioning (foundation #5)

1. Create Firebase project; enable Email/Password (optional Google).
2. Web app config → `FIREBASE_API_KEY` / `AUTH_DOMAIN` / `PROJECT_ID` / `APP_ID` in `.env` only; sync with `npm run firebase:sync-web` (never commit a real `apiKey`).
3. Service account → `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (or ADC via `GOOGLE_APPLICATION_CREDENTIALS`).
4. `npm run firebase:check` (prints set/empty only).
5. Authorized domains: `localhost`, then production hosts.

## Angular

- Use the Firebase JS SDK (Auth only). Keep web config in local environment files / deploy injection; empty placeholders stay in git.
- `AuthService.init` runs only when `apiKey` + `projectId` are set (`app.config.ts`).
- After sign-in, attach the ID token to API calls (`Authorization: Bearer <token>`) — issue #6.

## Nest

- Verify tokens with Firebase Admin (`FIREBASE_PROJECT_ID`, cert env vars or ADC on Cloud Run).
- Implementation: `apps/api/src/app/auth/firebase-auth.service.ts`.
- Guard protected routes; resolve or create the Neon user by `firebase_uid` (`/api/me`) — harden in #7.
- Do not trust client-sent user ids without token verification.

## Local

| Admin configured? | Behavior |
| --- | --- |
| No | `Bearer dev:<uid>` outside `production` |
| Yes | Real ID tokens only |

Optional: Firebase Auth emulator (`FIREBASE_AUTH_EMULATOR_HOST`). Placeholders only in `.env.example`.
