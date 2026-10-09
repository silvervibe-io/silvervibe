# Firebase Auth (local / foundation)

Issue: [#5](https://github.com/silvervibe-io/silvervibe/issues/5).  
Angular sign-in UX is [#6](https://github.com/silvervibe-io/silvervibe/issues/6); Nest guard hardening is [#7](https://github.com/silvervibe-io/silvervibe/issues/7).

## Create the Firebase project (console)

1. Open [Firebase console](https://console.firebase.google.com/) with the account that owns **silvervibe-io**.
2. **Add project** → name `silvervibe` (or `silvervibe-io`). Disable Google Analytics unless you want it.
3. In the project → **Build → Authentication → Get started**.
4. Enable providers you need for foundation:
   - **Email/Password** (required for early local testing)
   - **Google** (optional)
   - **GitHub** (optional): create a GitHub OAuth App; set **Redirect URL** to
     Firebase’s callback (`https://<project>.firebaseapp.com/__/auth/handler`);
     paste Client ID/Secret into the Firebase GitHub provider. Leave GitHub
     “wildcard matching” and “Device Flow” off.
5. **Project settings** (gear) → **Your apps** → **Add app** → **Web**  
   Nickname: `silvervibe-web`. Copy the web config object.

## Wire web config (Angular + `.env`)

Put the public web keys in **repo-root** `.env` (never commit):

| Env var                | Firebase web config field |
| ---------------------- | ------------------------- |
| `FIREBASE_API_KEY`     | `apiKey`                  |
| `FIREBASE_AUTH_DOMAIN` | `authDomain`              |
| `FIREBASE_PROJECT_ID`  | `projectId`               |
| `FIREBASE_APP_ID`      | `appId`                   |

### Where values live (do not hand-edit Angular env files)

| Context | Web config (`FIREBASE_API_KEY` …) | Admin (Nest) |
| ------- | --------------------------------- | ------------ |
| Local | Repo-root **`.env` only** | `.env` + ADC JSON path / private key |
| Angular serve/build | `npm run firebase:sync-web` (also runs via `npm start`) writes gitignored `firebase-web.local.ts` from `.env` | N/A (browser never gets Admin) |
| CI / Cloudflare Pages | Same four vars as **build environment / secrets**, then sync or inject at build | Secret Manager / CI secrets — never in the JS bundle |

Committed `environment.ts` only imports the generated local module. GitHub secret scanning flags Google API keys in git history even though the web key ships to the browser — keep it out of commits; restrict by **Websites** in Google Cloud; rotate if leaked.

Prod: set `FIREBASE_*` on Pages/CI for the build; do not put real `apiKey` in committed `environment.prod.ts`.

Apps call `AuthService.init(...)` only when `apiKey` and `projectId` are non-empty.

## Angular routes (issue #6)

Unlisted foundation routes (not linked from the public landing / standup home):

| Path       | Purpose                                           |
| ---------- | ------------------------------------------------- |
| `/auth`    | Sign in / sign out (email, Google, GitHub)        |
| `/account` | Guarded; calls `GET /api/me` with Bearer ID token |

`provideSilvervibeAuth` registers `HttpClient` with an interceptor that attaches
`Authorization: Bearer <idToken>` to `/api` requests when signed in.

## Wire Admin (Nest)

1. Firebase console → **Project settings → Service accounts**.
2. **Generate new private key** → download JSON (keep offline; do not commit).
3. In `.env`:

| Env var                 | From service account JSON                   |
| ----------------------- | ------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | `project_id` (same as web)                  |
| `FIREBASE_CLIENT_EMAIL` | `client_email`                              |
| `FIREBASE_PRIVATE_KEY`  | `private_key` — keep `\n` escapes in `.env` |

**Alternative (recommended locally):** set `GOOGLE_APPLICATION_CREDENTIALS` to the
downloaded JSON path (repo-relative is fine, e.g.
`./silvervibe-…-firebase-adminsdk-….json`). Leave `FIREBASE_CLIENT_EMAIL` /
`FIREBASE_PRIVATE_KEY` empty so Nest uses ADC. Those JSON filenames are
gitignored (`*-firebase-adminsdk-*.json`).

On Cloud Run later: mount the secret or use the runtime service account (ADC).

## Local behavior

| Situation                                           | API auth                                       |
| --------------------------------------------------- | ---------------------------------------------- |
| Admin **not** configured, `NODE_ENV` ≠ `production` | `Authorization: Bearer dev:<uid>` accepted     |
| Admin **configured**                                | Real Firebase ID tokens only (`dev:` disabled) |
| `NODE_ENV=production`                               | `dev:` always disabled                         |

```bash
# Without Admin (default until you fill keys):
curl -s -H "Authorization: Bearer dev:demo" http://localhost:3000/api/me

# After Admin is configured: sign in via the client, then:
curl -s -H "Authorization: Bearer <idToken>" http://localhost:3000/api/me
```

Optional Auth emulator:

```bash
# .env
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

## Verify config (no secrets printed)

```bash
npm run firebase:check
```

Reports which web / Admin variables are set. Does not call Google.

## Authorized domains

Firebase Auth → **Settings → Authorized domains** — include:

- `localhost`
- `silvervibe.io` / Pages preview hosts when you go live

## Checklist (acceptance #5)

- [ ] Firebase project exists under the correct account
- [ ] Email/Password (and optional Google) enabled
- [ ] Web config in local `.env`; run `npm run firebase:sync-web` (or `npm start`)
- [ ] Admin service account in local `.env` (`CLIENT_EMAIL` + `PRIVATE_KEY`) **or** ADC path documented
- [ ] `npm run firebase:check` shows web + Admin as configured
- [ ] No service-account JSON or `.env` committed
- [ ] With Admin configured, Nest can `verifyIdToken` (smoke via signed-in ID token → `/api/me`)
