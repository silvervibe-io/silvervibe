/**
 * Prints whether GrowthBook / OpenFeature env vars are set (not values).
 */
import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: join(root, '.env') });

function present(name) {
  const raw = process.env[name]?.replace(/^["']|["']$/g, '').trim();
  return Boolean(raw);
}

const web = {
  GROWTHBOOK_API_HOST: present('GROWTHBOOK_API_HOST'),
  GROWTHBOOK_CLIENT_KEY: present('GROWTHBOOK_CLIENT_KEY'),
};

const server = {
  GROWTHBOOK_SERVER_KEY: present('GROWTHBOOK_SERVER_KEY'),
};

const hasSdkKey = web.GROWTHBOOK_CLIENT_KEY || server.GROWTHBOOK_SERVER_KEY;

console.log('GrowthBook / OpenFeature env (set = true, empty = false)');
console.log(
  JSON.stringify({ web, server, apiCanUseGrowthBook: hasSdkKey }, null, 2),
);

if (!hasSdkKey) {
  console.log(
    'Status: no SDK key — Nest + Angular use static OpenFeature defaults (see docs/growthbook.md).',
  );
  process.exitCode = 0;
} else {
  console.log(
    'Status: SDK key present — set boolean flags in GrowthBook to match FLAG_KEYS (tools.vibestandup.enabled, addons.github.webhooks).',
  );
}
