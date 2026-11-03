/**
 * Generated Nest API client (OpenAPI Generator from `openapi/silvervibe.openapi.json`).
 * Regenerate with `npm run api-client` (or `npm run openapi:client`).
 *
 * Layout under `src/lib/generated`:
 * - `api/` — one `*DataService` per OpenAPI tag
 * - `model/` — one interface file per schema
 *
 * Import `*DataService` classes via deep paths so unused addon clients stay out
 * of app initial bundles (#129):
 *
 *   import { AuthDataService } from '@silvervibe/shared/api-client/api/auth-data.service';
 *
 * DTOs / enums / `provideSilvervibeApiClient` stay on this barrel.
 */
export { provideSilvervibeApiClient } from './lib/provide-api-client';
export * from './lib/generated/model/models';
export { BASE_PATH, COLLECTION_FORMATS } from './lib/generated/variables';
export {
  Configuration,
  type ConfigurationParameters,
} from './lib/generated/configuration';
