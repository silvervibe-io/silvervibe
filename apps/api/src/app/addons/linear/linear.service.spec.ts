import { Test } from '@nestjs/testing';
import { LinearService } from './linear.service';

describe('LinearService', () => {
  let service: LinearService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LinearService],
    }).compile();

    service = moduleRef.get(LinearService);
  });

  it('reports a ready Linear add-on', () => {
    expect(service.status()).toEqual({ name: 'linear', status: 'ready' });
  });
});
