import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import {
  PREVIEW_STORAGE_KEY,
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
  PreviewContextStore,
} from '@silvervibe/stores/preview';
import { of } from 'rxjs';
import { PreviewSwitcher } from './preview-switcher';

describe('PreviewSwitcher', () => {
  let fixture: ComponentFixture<PreviewSwitcher>;
  let preview: PreviewContextStore;
  const userEmail = signal<string | null>('founder@silvervibe.io');

  beforeEach(async () => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    userEmail.set('founder@silvervibe.io');
    await TestBed.configureTestingModule({
      imports: [PreviewSwitcher],
      providers: [
        {
          provide: PREVIEW_SWITCHER_EMAILS,
          useValue: ['founder@silvervibe.io'],
        },
        { provide: PREVIEW_SWITCHER_USER_EMAIL, useValue: userEmail },
        PreviewContextStore,
        ...provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
          loader: class {
            getTranslation() {
              return of({
                shell: {
                  preview: {
                    badge: 'Preview',
                    role: 'Role',
                    plan: 'Plan',
                    limits: '{{plan}}: {{teams}} teams / {{members}} members',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();

    preview = TestBed.inject(PreviewContextStore);
    fixture = TestBed.createComponent(PreviewSwitcher);
    await fixture.whenStable();
  });

  afterEach(() => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  });

  it('renders role and plan selects for allowlisted users', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Preview');
    expect(compiled.textContent).toContain('Silvervibe');
    expect(compiled.querySelectorAll('select').length).toBe(2);
  });

  it('updates preview role from the role select', () => {
    fixture.detectChanges();
    const roleSelect = fixture.nativeElement.querySelector(
      'select',
    ) as HTMLSelectElement;
    roleSelect.value = 'MEMBER';
    roleSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(preview.workspaceRole()).toBe('MEMBER');
  });

  it('hides when the signed-in email is not allowlisted', () => {
    userEmail.set('other@example.com');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('select')).toBeNull();
  });
});
