import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MeetingFacade } from '@silvervibe/stores/meeting';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingShellLinks } from '../meeting-shell-links';
import { MeetingCreate } from './meeting-create';

describe('MeetingCreate', () => {
  let fixture: ComponentFixture<MeetingCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MeetingCreate,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              meeting: {
                create: {},
                nav: {},
                editPolicy: {},
                closePolicy: {},
              },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: MeetingFacade,
          useValue: {
            members: signal([]),
            loading: signal(false),
            error: signal(null),
            loadMembers: vi.fn(async () => undefined),
            createMeeting: vi.fn(async () => 'meet-1'),
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
          provide: MeetingShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MeetingCreate);
    fixture.detectChanges();
  });

  it('manages agenda items and invites', () => {
    const component = fixture.componentInstance;
    component.addAgendaItem();
    expect(component.agendaItems().length).toBe(2);
    component.updateAgendaItem(1, 'Review roadmap');
    expect(component.agendaItems()[1]).toBe('Review roadmap');
    component.removeAgendaItem(0);
    expect(component.agendaItems()).toEqual(['Review roadmap']);
    component.toggleInvite('u1', true);
    expect(component.isInvited('u1')).toBe(true);
    component.toggleInvite('u1', false);
    expect(component.isInvited('u1')).toBe(false);
  });

  it('keeps at least one agenda item', () => {
    const component = fixture.componentInstance;
    component.removeAgendaItem(0);
    expect(component.agendaItems().length).toBe(1);
  });
});
