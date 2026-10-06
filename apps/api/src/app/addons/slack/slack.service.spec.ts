import { Test } from '@nestjs/testing';
import { SlackService } from './slack.service';

describe('SlackService', () => {
  let service: SlackService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SlackService],
    }).compile();

    service = moduleRef.get(SlackService);
  });

  it('reports a ready Slack add-on', () => {
    expect(service.status()).toEqual({ name: 'slack', status: 'ready' });
  });
});
