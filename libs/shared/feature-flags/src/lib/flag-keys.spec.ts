import { describe, expect, it } from 'vitest';
import { FLAG_KEYS, TOOL_KEYS, isKnownToolKey } from './flag-keys';

describe('flag and tool keys', () => {
  it('uses dotted domains for flags', () => {
    expect(FLAG_KEYS.toolsVibestandupEnabled).toBe('tools.vibestandup.enabled');
    expect(FLAG_KEYS.vibestandupMultiTeamEnabled).toBe(
      'vibestandup.multiTeam.enabled',
    );
    expect(FLAG_KEYS.plansCatalog).toBe('plans.catalog');
    expect(FLAG_KEYS.vibestandupLimits).toBe('vibestandup.limits');
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
