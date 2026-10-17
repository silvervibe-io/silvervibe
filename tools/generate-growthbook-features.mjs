/**
 * Builds a GrowthBook SDK FeatureDefinition map from the plan catalog + flag defaults.
 *
 * Output (SDK payload shape):
 *   libs/shared/feature-flags/growthbook/features.json
 *
 * Also writes a flat `features` object file for `new GrowthBook({ features })`:
 *   libs/shared/feature-flags/growthbook/features.definitions.json
 *
 * Usage: npm run growthbook:generate-features
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libDir = join(root, 'libs/shared/feature-flags');
const outDir = join(libDir, 'growthbook');

const catalog = JSON.parse(
  readFileSync(join(libDir, 'src/lib/plans.catalog.json'), 'utf8'),
);
const flagDefaults = JSON.parse(
  readFileSync(join(libDir, 'src/lib/flag-defaults.json'), 'utf8'),
);

/** @type {Record<string, { defaultValue: unknown; rules?: unknown[] }>} */
const features = {};

/** @type {Array<{ key: string; valueType: string; description: string; defaultValue: unknown }>} */
const inventory = [];

for (const [key, meta] of Object.entries(flagDefaults)) {
  let defaultValue = meta.defaultValue;
  if (meta.defaultValueFrom === 'plans.catalog') {
    defaultValue = catalog;
  }

  features[key] = { defaultValue };
  inventory.push({
    key,
    valueType: meta.valueType,
    description: meta.description,
    defaultValue,
  });
}

const freeLimits = catalog.plans?.free?.tools?.vibestandup;
if (freeLimits) {
  const limitsKey = 'vibestandup.limits';
  if (!features[limitsKey]) {
    features[limitsKey] = {
      defaultValue: {
        planKey: 'free',
        maxTeams: freeLimits.maxTeams,
        maxMembersPerTeam: freeLimits.maxMembersPerTeam,
      },
    };
    inventory.push({
      key: limitsKey,
      valueType: 'json',
      description:
        'Convenience JSON of free-tier VibeStandup limits (Neon plan remains authoritative when enforced).',
      defaultValue: features[limitsKey].defaultValue,
    });
  }
}

mkdirSync(outDir, { recursive: true });

const definitionsPath = join(outDir, 'features.definitions.json');
const payloadPath = join(outDir, 'features.json');
const inventoryPath = join(outDir, 'features.inventory.json');

writeFileSync(definitionsPath, `${JSON.stringify(features, null, 2)}\n`);
writeFileSync(
  payloadPath,
  `${JSON.stringify({ status: 200, features }, null, 2)}\n`,
);
writeFileSync(
  inventoryPath,
  `${JSON.stringify(
    {
      generatedFor: 'GrowthBook FeatureDefinition / SDK payload',
      note: 'Create matching features in the GrowthBook UI (or API) using these keys and defaults. Do not treat flags as purchase proof — use Neon workspace_tools + plan.',
      attributesSuggested: ['id', 'firebaseUid', 'workspaceId', 'planKey'],
      features: inventory,
    },
    null,
    2,
  )}\n`,
);

console.log(`Wrote ${definitionsPath}`);
console.log(`Wrote ${payloadPath}`);
console.log(`Wrote ${inventoryPath}`);
console.log(`Features: ${Object.keys(features).length}`);
