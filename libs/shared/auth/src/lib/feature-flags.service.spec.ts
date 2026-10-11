import { TestBed } from '@angular/core/testing';
import { FLAG_KEYS } from '@silvervibe/shared/feature-flags';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  it('evaluates the in-memory vibestandup flag on init', async () => {
    TestBed.configureTestingModule({
      providers: [FeatureFlagsService],
    });
    const service = TestBed.inject(FeatureFlagsService);

    await service.init({});
    expect(service.usingGrowthBook()).toBe(false);
    expect(service.vibestandupEnabled()).toBe(true);
    await expect(
      service.isEnabled(FLAG_KEYS.toolsVibestandupEnabled, false),
    ).resolves.toBe(true);
  });
});
