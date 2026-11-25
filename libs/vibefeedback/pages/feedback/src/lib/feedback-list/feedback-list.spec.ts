import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FeedbackFacade } from '@silvervibe/stores/feedback';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackShellLinks } from '../feedback-shell-links';
import { FeedbackList } from './feedback-list';

describe('FeedbackList', () => {
  let fixture: ComponentFixture<FeedbackList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FeedbackList,
        TranslocoTestingModule.forRoot({
          langs: { en: { feedback: { list: {}, nav: {} } } },
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
          provide: FeedbackFacade,
          useValue: {
            loading: signal(false),
            error: signal(null),
            requests: signal([]),
            loadRequests: vi.fn(async () => undefined),
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
          provide: FeedbackShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackList);
    fixture.detectChanges();
  });

  it('loads requests for the selected workspace', async () => {
    const feedback = TestBed.inject(FeedbackFacade);
    await fixture.componentInstance.ngOnInit();
    expect(feedback.loadRequests).toHaveBeenCalledWith('ws-1');
  });
});
