import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MeetingFacade } from '@silvervibe/stores/meeting';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingShellLinks } from '../meeting-shell-links';
import { MeetingDetail } from './meeting-detail';

describe('MeetingDetail', () => {
  let fixture: ComponentFixture<MeetingDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MeetingDetail,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              meeting: { detail: {}, nav: {} },
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
            selected: signal({
              id: 'meet-1',
              workspaceId: 'ws-1',
              title: 'Planning',
              context: null,
              status: 'OPEN',
              editPolicy: 'CREATOR_OR_ADMIN',
              closePolicy: 'CREATOR_OR_ADMIN',
              scheduledAt: null,
              recap: null,
              invites: [],
              agendaItems: [{ id: 'a1', body: 'Roadmap', sortOrder: 0 }],
              decisions: [],
              actions: [],
              canEditNotes: true,
              canClose: true,
              canEditSettings: true,
            }),
            loading: signal(false),
            error: signal(null),
            loadMeeting: vi.fn(async () => undefined),
            setDecisions: vi.fn(async () => undefined),
            setActions: vi.fn(async () => undefined),
            close: vi.fn(async () => undefined),
          },
        },
        {
          provide: MeetingShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MeetingDetail);
    fixture.componentRef.setInput('meetingId', 'meet-1');
    fixture.detectChanges();
  });

  it('saves drafted decisions and drops blanks', async () => {
    const meetings = TestBed.inject(MeetingFacade);
    const component = fixture.componentInstance;
    component.addDecision();
    component.updateDecision(0, '  Ship it  ');
    component.addDecision();
    await component.saveDecisions();
    expect(meetings.setDecisions).toHaveBeenCalledWith('meet-1', {
      decisions: [{ body: 'Ship it' }],
    });
  });

  it('saves drafted actions with assignee and done state', async () => {
    const meetings = TestBed.inject(MeetingFacade);
    const component = fixture.componentInstance;
    component.addAction();
    component.updateAction(0, { body: 'Write docs', assigneeId: 'u1' });
    component.updateAction(0, { done: true });
    await component.saveActions();
    expect(meetings.setActions).toHaveBeenCalledWith('meet-1', {
      actions: [{ body: 'Write docs', assigneeId: 'u1', done: true }],
    });
  });

  it('closes the meeting with the recap', async () => {
    const meetings = TestBed.inject(MeetingFacade);
    const component = fixture.componentInstance;
    component.recapDraft.set('  Done  ');
    await component.closeMeeting();
    expect(meetings.close).toHaveBeenCalledWith('meet-1', 'Done');
  });
});
