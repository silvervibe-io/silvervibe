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
        new GrowthbookClientProvider(
          { apiHost, clientKey },
          { timeout: 2000 },
        ),
      );
    } else {
      await OpenFeature.setProviderAndWait(
        new StaticBooleanProvider({
          [FLAG_KEYS.toolsVibestandupEnabled]: true,
        }),
      );
    }

    OpenFeature.addHandler(ProviderEvents.Ready, () =>
      this.readySignal.set(true),
    );
    this.readySignal.set(true);
  }

  async isEnabled(flagKey: string, defaultValue = false): Promise<boolean> {
    await this.init();
    return OpenFeature.getClient('silvervibe-web').getBooleanValue(
      flagKey,
      defaultValue,
    );
  }
}
