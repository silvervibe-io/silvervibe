# Email: `info@silvervibe.io`

Issue: [#12](https://github.com/silvervibe-io/silvervibe/issues/12).

The landing and privacy pages use `mailto:info@silvervibe.io`. Delivery depends on
**Cloudflare Email Routing** (or Google Workspace) — not on the Angular app.

## Prefer: Cloudflare Email Routing

Free for the zone when DNS is on Cloudflare. Forwards inbound mail to a personal
inbox; it does **not** send as `@silvervibe.io` from a client (outbound needs
Workspace / another SMTP provider).

### Enable

1. Cloudflare dashboard → select **silvervibe.io** → **Email** → **Email Routing**.
2. **Get started** / enable Email Routing. Cloudflare adds the MX / TXT records it needs.
3. **Destination addresses** → add your personal inbox → verify the confirmation email.
4. **Routing rules** → **Custom addresses** (or catch-all):

| Custom address       | Action  | Destination         |
| -------------------- | ------- | ------------------- |
| `info@silvervibe.io` | Send to | your verified inbox |
| (optional) catch-all | Send to | same inbox          |

5. Wait for DNS to show **Active** on the Email Routing MX records.

### Test

```text
To: info@silvervibe.io
Subject: silvervibe email routing smoke
```

Confirm the message arrives in the destination inbox (and is not in spam).

From the live site: open https://silvervibe.io → click **info@silvervibe.io** →
send a short message.

### Optional

- Add **`support@`** / **`hello@`** the same way if you want aliases.
- If you later move to Google Workspace, disable Email Routing MX and use Google’s MX instead (do not keep both).

## Alternative: Google Workspace

Use Workspace if you need a real mailbox and outbound `@silvervibe.io` send.

1. Create Workspace for `silvervibe.io`.
2. Replace Cloudflare Email Routing MX with Google’s MX (Cloudflare DNS, orange cloud off for MX as required).
3. Create user or group `info@silvervibe.io`.

## App touchpoints (already wired)

| Surface             | Location                                       |
| ------------------- | ---------------------------------------------- |
| Landing mailto      | `apps/silvervibe/src/app/landing/landing.html` |
| Privacy contact     | `apps/silvervibe/src/app/privacy/privacy.html` |
| Privacy copy (docs) | [privacy.md](./privacy.md)                     |
| E2E asserts link    | `apps/silvervibe-e2e/src/example.spec.ts`      |

No app change is required once routing is active.

## Checklist

- [ ] Email Routing enabled; MX Active
- [ ] Destination address verified
- [ ] Rule for `info@silvervibe.io` → destination
- [ ] Test message received
- [ ] Landing mailto smoke on production
