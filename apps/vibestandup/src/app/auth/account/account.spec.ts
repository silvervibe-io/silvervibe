import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@silvervibe/shared/auth';
import { of } from 'rxjs';
import { Account } from './account';

describe('Account', () => {
  let fixture: ComponentFixture<Account>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user: () => ({ uid: 'u1', email: 'u1@example.com' }),
            signOut: () => of(undefined),
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Account);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('loads /api/me profile', async () => {
    const req = http.expectOne('/api/me');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'cuid1',
      firebaseUid: 'u1',
      email: 'u1@example.com',
      displayName: 'User',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('cuid1');
    expect(fixture.nativeElement.textContent).toContain('u1@example.com');
  });
});
