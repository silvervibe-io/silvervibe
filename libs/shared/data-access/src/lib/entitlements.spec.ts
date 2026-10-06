import { describe, expect, it } from 'vitest';
import { isToolEnabled } from './entitlements';

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
