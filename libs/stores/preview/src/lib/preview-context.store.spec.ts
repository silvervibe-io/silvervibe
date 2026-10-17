import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PLAN_KEYS } from '@silvervibe/shared/feature-flags';
import {
  PREVIEW_STORAGE_KEY,
  PreviewContextStore,
} from './preview-context.store';
import {
  PREVIEW_SWITCHER_EMAILS,
  PREVIEW_SWITCHER_USER_EMAIL,
} from './preview-tokens';

describe('PreviewContextStore', () => {
  const userEmail = signal<string | null>('founder@silvervibe.io');

  beforeEach(() => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PREVIEW_SWITCHER_EMAILS,
          useValue: ['founder@silvervibe.io'],
        },
        { provide: PREVIEW_SWITCHER_USER_EMAIL, useValue: userEmail },
        PreviewContextStore,
      ],
    });
    userEmail.set('founder@silvervibe.io');
  });

  afterEach(() => {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  });

  it('is eligible for allowlisted emails and inactive otherwise', () => {
    const store = TestBed.inject(PreviewContextStore);
    expect(store.isEligible()).toBe(true);
    expect(store.isActive()).toBe(true);
    expect(store.orgLabel()).toBe('Silvervibe');

    userEmail.set('other@example.com');
    expect(store.isEligible()).toBe(false);
    expect(store.orgLabel()).toBeNull();
  });

  it('maps workspace roles to team admin and persists persona', () => {
    const store = TestBed.inject(PreviewContextStore);
    expect(store.isWorkspaceAdmin()).toBe(true);
    expect(store.isTeamAdmin()).toBe(true);

    store.setWorkspaceRole('MEMBER');
    expect(store.isWorkspaceAdmin()).toBe(false);
    expect(store.isTeamAdmin()).toBe(false);
    expect(store.teamRole()).toBe('MEMBER');

    store.setPlanKey(PLAN_KEYS.team);
    expect(store.planKey()).toBe('team');

    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    expect(raw).toContain('"workspaceRole":"MEMBER"');
    expect(raw).toContain('"planKey":"team"');
  });
});
