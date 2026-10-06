import { Test } from '@nestjs/testing';
import { GithubService } from './github.service';

describe('GithubService', () => {
  let service: GithubService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [GithubService],
    }).compile();

    service = moduleRef.get(GithubService);
  });

  it('reports a ready GitHub add-on', () => {
    expect(service.status()).toEqual({ name: 'github', status: 'ready' });
  });
});
