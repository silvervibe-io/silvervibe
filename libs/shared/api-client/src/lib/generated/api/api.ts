/**
 * Tree-shakeable re-exports of OpenAPI *DataService classes.
 *
 * OpenAPI Generator normally emits side-effect imports + an `APIS` array that
 * keeps every service alive. `tools/generate-api-client.mjs` rewrites this file
 * after each generation so unused services can drop out of app bundles.
 */
export * from './auth-data.service';
export * from './auth-data.serviceInterface';
export * from './flags-data.service';
export * from './flags-data.serviceInterface';
export * from './github-data.service';
export * from './github-data.serviceInterface';
export * from './health-data.service';
export * from './health-data.serviceInterface';
export * from './jira-data.service';
export * from './jira-data.serviceInterface';
export * from './jobs-data.service';
export * from './jobs-data.serviceInterface';
export * from './linear-data.service';
export * from './linear-data.serviceInterface';
export * from './slack-data.service';
export * from './slack-data.serviceInterface';
export * from './standups-data.service';
export * from './standups-data.serviceInterface';
export * from './teams-data.service';
export * from './teams-data.serviceInterface';
export * from './workspaces-data.service';
export * from './workspaces-data.serviceInterface';
