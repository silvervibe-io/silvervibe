import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  OpenFeature,
  Client,
  EvaluationContext,
} from '@openfeature/server-sdk';
import { GrowthbookProvider } from '@openfeature/growthbook-provider';
import { FLAG_KEYS } from '@silvervibe/shared/feature-flags';
import { StaticBooleanProvider } from './static-boolean.provider';

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private client!: Client;

  async onModuleInit(): Promise<void> {
    const clientKey =
      process.env['GROWTHBOOK_CLIENT_KEY'] ??
      process.env['GROWTHBOOK_SERVER_KEY'];
    const apiHost =
      process.env['GROWTHBOOK_API_HOST'] ?? 'https://cdn.growthbook.io';

    if (clientKey) {
      await OpenFeature.setProviderAndWait(
        new GrowthbookProvider({ apiHost, clientKey }, { timeout: 2000 }),
      );
      this.logger.log('OpenFeature using GrowthBook provider');
    } else {
      await OpenFeature.setProviderAndWait(
        new StaticBooleanProvider({
          [FLAG_KEYS.toolsVibestandupEnabled]: true,
          [FLAG_KEYS.addonsGithubWebhooks]: false,
        }),
      );
      this.logger.warn(
        'GROWTHBOOK_CLIENT_KEY missing; using static OpenFeature defaults',
      );
    }

    this.client = OpenFeature.getClient('silvervibe-api');
  }

  async booleanFlag(
    key: string,
    defaultValue = false,
    context: Record<string, string | number | boolean | undefined> = {},
  ): Promise<boolean> {
    const evaluationContext: EvaluationContext = {};
    const targetingKey =
      (typeof context['firebaseUid'] === 'string'
        ? context['firebaseUid']
        : undefined) ??
      (typeof context['workspaceId'] === 'string'
        ? context['workspaceId']
        : undefined);

    if (targetingKey) {
      evaluationContext['targetingKey'] = targetingKey;
    }

    for (const [entryKey, value] of Object.entries(context)) {
      if (value !== undefined) {
        evaluationContext[entryKey] = value;
      }
    }

    return this.client.getBooleanValue(key, defaultValue, evaluationContext);
  }
}
