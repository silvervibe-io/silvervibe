import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PollFacade } from '@silvervibe/stores/poll';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollShellLinks } from '../poll-shell-links';
import { PollCreate } from './poll-create';

describe('PollCreate', () => {
  let fixture: ComponentFixture<PollCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PollCreate,
        TranslocoTestingModule.forRoot({
          langs: { en: { poll: { create: {}, nav: {} } } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: PollFacade,
          useValue: {
            members: signal([]),
            loading: signal(false),
            error: signal(null),
            loadMembers: vi.fn(async () => undefined),
            createPoll: vi.fn(async () => 'poll-1'),
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
          provide: PollShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PollCreate);
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
