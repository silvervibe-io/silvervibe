import { describe, expect, it } from 'vitest';
import { enabledToolKeys, isToolEnabled } from './entitlements';

describe('isToolEnabled', () => {
  it('returns true when the tool key is entitled', () => {
    expect(isToolEnabled(['vibestandup', 'addons.github'], 'vibestandup')).toBe(
      true,
    );
  });

  it('returns false when the tool key is missing', () => {
    expect(isToolEnabled(['vibestandup'], 'addons.slack')).toBe(false);
  });
});

describe('enabledToolKeys', () => {
  it('returns only enabled keys', () => {
    expect(
      enabledToolKeys([
        { toolKey: 'vibestandup', enabled: true },
        { toolKey: 'addons.github', enabled: false },
        { toolKey: 'addons.slack', enabled: true },
      ]),
    ).toEqual(['vibestandup', 'addons.slack']);
  });
});
