import { Test } from '@nestjs/testing';
import { FLAG_KEYS } from '@silvervibe/shared/feature-flags';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsController', () => {
  it('returns vibestandup flag evaluation', async () => {
    const flags = {
      booleanFlag: jest.fn().mockResolvedValue(true),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [{ provide: FeatureFlagsService, useValue: flags }],
    }).compile();

    const controller = moduleRef.get(FeatureFlagsController);
    const result = await controller.vibestandup('ws1', 'uid1');

    expect(flags.booleanFlag).toHaveBeenCalledWith(
      FLAG_KEYS.toolsVibestandupEnabled,
      false,
      { workspaceId: 'ws1', firebaseUid: 'uid1' },
    );
    expect(result).toEqual({
      key: FLAG_KEYS.toolsVibestandupEnabled,
      enabled: true,
    });
  });
});
