import catalog from './plans.catalog.json';

export type VibestandupPlanLimits = {
  enabledByDefault: boolean;
  maxTeams: number;
  maxMembersPerTeam: number;
};

export type PlanToolLimits = {
  vibestandup?: VibestandupPlanLimits;
};

export type WorkspacePlanDefinition = {
  key: string;
  name: string;
  description: string;
  tools: PlanToolLimits;
};

export type PlansCatalog = {
  defaultPlanKey: string;
  plans: Record<string, WorkspacePlanDefinition>;
};

/** Canonical workspace plan catalog (source: `plans.catalog.json`). */
export const PLANS_CATALOG = catalog as PlansCatalog;

export const PLAN_KEYS = {
  free: 'free',
  team: 'team',
} as const;

export type PlanKey = (typeof PLAN_KEYS)[keyof typeof PLAN_KEYS];

export function getPlan(planKey: string): WorkspacePlanDefinition | undefined {
  return PLANS_CATALOG.plans[planKey];
}

export function getDefaultPlan(): WorkspacePlanDefinition {
  const plan = getPlan(PLANS_CATALOG.defaultPlanKey);
  if (!plan) {
    throw new Error(
      `Default plan "${PLANS_CATALOG.defaultPlanKey}" missing from plans catalog`,
    );
  }
  return plan;
}

export function getVibestandupLimits(
  planKey: string = PLANS_CATALOG.defaultPlanKey,
): VibestandupPlanLimits {
  const plan = getPlan(planKey) ?? getDefaultPlan();
  const limits = plan.tools.vibestandup;
  if (!limits) {
    throw new Error(`Plan "${plan.key}" has no vibestandup tool limits`);
  }
  return limits;
}
