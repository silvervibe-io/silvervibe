import {
  getDefaultPlan,
  getVibestandupLimits,
  PLAN_KEYS,
  PLANS_CATALOG,
} from './plans';

describe('plans catalog', () => {
  it('defaults to the free plan with VibeStandup limits', () => {
    expect(PLANS_CATALOG.defaultPlanKey).toBe(PLAN_KEYS.free);
    const free = getDefaultPlan();
    expect(free.key).toBe('free');
    expect(free.tools.vibestandup).toEqual({
      enabledByDefault: true,
      maxTeams: 1,
      maxMembersPerTeam: 12,
    });
    expect(getVibestandupLimits()).toEqual(free.tools.vibestandup);
  });

  it('defines a team plan placeholder with higher limits', () => {
    const limits = getVibestandupLimits(PLAN_KEYS.team);
    expect(limits.maxTeams).toBeGreaterThan(1);
    expect(limits.maxMembersPerTeam).toBeGreaterThan(12);
  });
});
