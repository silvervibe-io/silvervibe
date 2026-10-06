---
name: firebase-auth
description: Integrates Firebase Auth with Silvervibe Angular apps and Nest JWT verification. Use when adding login, guards, auth interceptors, or Firebase Admin setup.
---

# Firebase Auth

## Angular

- Use the Firebase JS SDK (Auth only). Keep config in environment files from Firebase web app settings (public).
- After sign-in, attach the ID token to API calls (`Authorization: Bearer <token>`).

## Nest

- Verify tokens with Firebase Admin (`FIREBASE_PROJECT_ID`, service account JSON or ADC on Cloud Run).
- Guard protected routes; resolve or create the Neon user by `firebase_uid`.
- Do not trust client-sent user ids without token verification.

## Local

Use the Firebase Auth emulator when possible (`FIREBASE_AUTH_EMULATOR_HOST`). Document project ids in `.env.example` only as placeholders.
