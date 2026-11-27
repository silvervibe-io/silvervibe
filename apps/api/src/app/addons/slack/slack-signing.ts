import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_SKEW_SEC = 60 * 5;

/**
 * Verify Slack request signature (v0 HMAC-SHA256 over timestamp + raw body).
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(input: {
  signingSecret: string;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  rawBody: Buffer | string;
  nowSec?: number;
}): boolean {
  const signature = input.signatureHeader?.trim();
  const timestamp = input.timestampHeader?.trim();
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) {
    return false;
  }
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SEC) {
    return false;
  }
  const body =
    typeof input.rawBody === 'string'
      ? input.rawBody
      : input.rawBody.toString('utf8');
  const base = `v0:${timestamp}:${body}`;
  const digest = createHmac('sha256', input.signingSecret)
    .update(base, 'utf8')
    .digest('hex');
  const expected = `v0=${digest}`;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
