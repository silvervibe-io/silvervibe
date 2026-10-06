import { Test } from '@nestjs/testing';
import { JiraService } from './jira.service';

describe('JiraService', () => {
  let service: JiraService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [JiraService],
    }).compile();

    service = moduleRef.get(JiraService);
  });

  it('reports a ready Jira add-on', () => {
    expect(service.status()).toEqual({ name: 'jira', status: 'ready' });
  });
});
