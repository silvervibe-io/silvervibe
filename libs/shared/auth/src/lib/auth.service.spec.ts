import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('starts with no user', () => {
    TestBed.configureTestingModule({
      providers: [AuthService],
    });
    const service = TestBed.inject(AuthService);

    expect(service.user()).toBeNull();
  });
});
