import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PollFacade } from '@silvervibe/stores/poll';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollShellLinks } from '../poll-shell-links';
import { PollList } from './poll-list';

describe('PollList', () => {
  let fixture: ComponentFixture<PollList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PollList,
        TranslocoTestingModule.forRoot({
          langs: { en: { poll: { list: {}, nav: {} } } },
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
          provide: PollFacade,
          useValue: {
            loading: signal(false),
            error: signal(null),
            polls: signal([]),
            loadPolls: vi.fn(async () => undefined),
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
          provide: PollShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PollList);
    fixture.detectChanges();
  });

  it('loads polls for the selected workspace', async () => {
    const polls = TestBed.inject(PollFacade);
    await fixture.componentInstance.ngOnInit();
    expect(polls.loadPolls).toHaveBeenCalledWith('ws-1');
  });
});
