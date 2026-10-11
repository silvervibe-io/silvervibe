import { describe, expect, it } from 'vitest';
import { FLAG_KEYS, TOOL_KEYS, isKnownToolKey } from './flag-keys';

describe('flag and tool keys', () => {
  it('uses dotted domains for flags', () => {
    expect(FLAG_KEYS.toolsVibestandupEnabled).toBe('tools.vibestandup.enabled');
  });

  it('exposes workspace tool keys', () => {
    expect(TOOL_KEYS.vibestandup).toBe('vibestandup');
    expect(TOOL_KEYS.addonsGithub).toBe('addons.github');
  });

  it('detects known tool keys', () => {
    expect(isKnownToolKey('vibestandup')).toBe(true);
    expect(isKnownToolKey('not-a-tool')).toBe(false);
  });
});
