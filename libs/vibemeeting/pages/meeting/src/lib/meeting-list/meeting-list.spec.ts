import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MeetingFacade } from '@silvervibe/stores/meeting';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingShellLinks } from '../meeting-shell-links';
import { MeetingList } from './meeting-list';

describe('MeetingList', () => {
  let fixture: ComponentFixture<MeetingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MeetingList,
        TranslocoTestingModule.forRoot({
          langs: { en: { meeting: { list: {}, nav: {} } } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ workspaceId: 'ws-1' }),
            },
          },
        },
        {
          provide: MeetingFacade,
          useValue: {
            loading: signal(false),
            error: signal(null),
            meetings: signal([]),
            loadMeetings: vi.fn(async () => undefined),
          },
        },
        {
          provide: WorkspaceFacade,
          useValue: {
            selectedWorkspace: signal({ id: 'ws-1', name: 'Acme' }),
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

    fixture = TestBed.createComponent(MeetingList);
    fixture.detectChanges();
  });

  it('loads meetings for the selected workspace', async () => {
    const meetings = TestBed.inject(MeetingFacade);
    await fixture.componentInstance.ngOnInit();
    expect(meetings.loadMeetings).toHaveBeenCalledWith('ws-1');
  });
});
