import { createHmac } from 'node:crypto';
import { verifySlackSignature } from './slack-signing';

function sign(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`, 'utf8')
    .digest('hex');
  return `v0=${digest}`;
}

describe('verifySlackSignature', () => {
  const secret = 'test-signing-secret';
  const body = 'token=x&team_id=T1&user_id=U1';
  const ts = '1700000000';

  it('accepts a valid signature within skew', () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        signatureHeader: sign(secret, ts, body),
        timestampHeader: ts,
        rawBody: body,
        nowSec: Number(ts) + 30,
      }),
    ).toBe(true);
  });

  it('rejects a bad signature', () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        signatureHeader: 'v0=deadbeef',
        timestampHeader: ts,
        rawBody: body,
        nowSec: Number(ts),
      }),
    ).toBe(false);
  });

  it('rejects an old timestamp', () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        signatureHeader: sign(secret, ts, body),
        timestampHeader: ts,
        rawBody: body,
        nowSec: Number(ts) + 60 * 10,
      }),
    ).toBe(false);
  });
});
