import { Test } from '@nestjs/testing';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [TeamsService],
    }).compile();

    service = moduleRef.get(TeamsService);
  });

  it('reports a ready Microsoft Teams add-on', () => {
    expect(service.status()).toEqual({ name: 'teams', status: 'ready' });
  });
});
