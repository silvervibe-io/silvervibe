import { Injectable, signal } from '@angular/core';
import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { GrowthbookClientProvider } from '@openfeature/growthbook-client-provider';
import { FLAG_KEYS } from '@silvervibe/shared/feature-flags';
import { StaticBooleanProvider } from './static-boolean.provider';

export type FeatureFlagsConfig = {
  clientKey?: string;
  apiHost?: string;
};

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private readonly readySignal = signal(false);
  readonly ready = this.readySignal.asReadonly();

  private readonly vibestandupEnabledSignal = signal(false);
  /** Last evaluation of `tools.vibestandup.enabled` (updated on init). */
  readonly vibestandupEnabled = this.vibestandupEnabledSignal.asReadonly();

  private readonly usingGrowthBookSignal = signal(false);
  readonly usingGrowthBook = this.usingGrowthBookSignal.asReadonly();

  private initPromise: Promise<void> | null = null;

  init(config: FeatureFlagsConfig = {}): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.bootstrap(config);
    }
    return this.initPromise;
  }

  private async bootstrap(config: FeatureFlagsConfig): Promise<void> {
    const clientKey = config.clientKey;
    const apiHost = config.apiHost ?? 'https://cdn.growthbook.io';

    if (clientKey) {
      await OpenFeature.setProviderAndWait(
        new GrowthbookClientProvider({ apiHost, clientKey }, { timeout: 2000 }),
      );
      this.usingGrowthBookSignal.set(true);
    } else {
      await OpenFeature.setProviderAndWait(
        new StaticBooleanProvider({
          [FLAG_KEYS.toolsVibestandupEnabled]: true,
          [FLAG_KEYS.addonsGithubWebhooks]: false,
        }),
      );
      this.usingGrowthBookSignal.set(false);
    }

    OpenFeature.addHandler(ProviderEvents.Ready, () =>
      this.readySignal.set(true),
    );
    this.readySignal.set(true);

    const enabled = await OpenFeature.getClient(
      'silvervibe-web',
    ).getBooleanValue(FLAG_KEYS.toolsVibestandupEnabled, false);
    this.vibestandupEnabledSignal.set(enabled);
  }

  async isEnabled(flagKey: string, defaultValue = false): Promise<boolean> {
    await this.init();
    return OpenFeature.getClient('silvervibe-web').getBooleanValue(
      flagKey,
      defaultValue,
    );
  }
}
