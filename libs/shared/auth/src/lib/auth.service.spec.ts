import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('starts with no user and becomes ready without Firebase config', async () => {
    TestBed.configureTestingModule({
      providers: [AuthService],
    });
    const service = TestBed.inject(AuthService);
    service.init({ apiKey: '', projectId: '' });

    expect(service.user()).toBeNull();
    await expect(service.whenReady()).resolves.toBeUndefined();
    expect(service.ready()).toBe(true);
    await expect(service.idToken()).resolves.toBeNull();
  });
});
