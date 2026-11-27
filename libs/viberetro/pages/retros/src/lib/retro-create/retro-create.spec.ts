import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RetroFacade } from '@silvervibe/stores/retro';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroShellLinks } from '../retro-shell-links';
import { RetroCreate } from './retro-create';

describe('RetroCreate', () => {
  let fixture: ComponentFixture<RetroCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RetroCreate,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              retro: { create: {}, nav: {}, visibility: {}, closePolicy: {} },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: RetroFacade,
          useValue: {
            members: signal([]),
            loading: signal(false),
            error: signal(null),
            loadMembers: vi.fn(async () => undefined),
            createRetro: vi.fn(async () => 'retro-1'),
          },
        },
        {
          provide: WorkspaceFacade,
          useValue: {
            selectedWorkspaceId: signal('ws-1'),
            loadMyWorkspaces: vi.fn(async () => undefined),
          },
        },
        {
          provide: RetroShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroCreate);
    fixture.detectChanges();
  });

  it('toggles invite selection', () => {
    const component = fixture.componentInstance;
    component.toggleInvite('u1', true);
    expect(component.isInvited('u1')).toBe(true);
    component.toggleInvite('u1', false);
    expect(component.isInvited('u1')).toBe(false);
  });
});
