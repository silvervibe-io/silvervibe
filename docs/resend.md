# Transactional email (Resend)

Team invite mail is sent by Nest via [Resend](https://resend.com) when
`RESEND_API_KEY` is set. Without the key, invites still work — copy the accept
link from team admin.

Inbound `info@silvervibe.io` remains Cloudflare Email Routing
([email-routing.md](./email-routing.md)); that path does **not** send app mail.

## Local

1. Create a Resend account and API key.
2. In repo-root `.env`:

```bash
RESEND_API_KEY=re_...
EMAIL_FROM=VibeStandup <onboarding@resend.dev>
PUBLIC_STANDUP_URL=http://localhost:4201
```

3. Restart `npm run start:api`.
4. Invite an address you can receive on. With `onboarding@resend.dev`, Resend
   only delivers to the email on your Resend account until you verify a domain.

## Production

1. Add and verify `silvervibe.io` in Resend (DNS records).
2. Set Cloud Run secrets / env (see [cloud-run.md](./cloud-run.md)):

| Variable             | Notes                                                     |
| -------------------- | --------------------------------------------------------- |
| `RESEND_API_KEY`     | Secret Manager                                            |
| `EMAIL_FROM`         | e.g. `VibeStandup <invites@silvervibe.io>`                |
| `PUBLIC_STANDUP_URL` | `https://standup.silvervibe.io` (used in the accept link) |

## Checklist

- [ ] `RESEND_API_KEY` in local `.env`; invite mail arrives
- [ ] Domain verified in Resend for production `EMAIL_FROM`
- [ ] Cloud Run has `RESEND_API_KEY` + `PUBLIC_STANDUP_URL` + `EMAIL_FROM`
