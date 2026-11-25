import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FeedbackFacade } from '@silvervibe/stores/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackShellLinks } from '../feedback-shell-links';
import { FeedbackDetail } from './feedback-detail';

describe('FeedbackDetail', () => {
  let fixture: ComponentFixture<FeedbackDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FeedbackDetail,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              feedback: { detail: {}, nav: {} },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: FeedbackFacade,
          useValue: {
            selected: signal({
              id: 'req-1',
              title: 'Sprint review',
              status: 'OPEN',
              answerVisibility: 'PRIVATE_TO_REQUESTER',
              anonymous: false,
              closePolicy: 'CREATOR_OR_ADMIN',
              context: null,
              prompts: [{ id: 'p1', body: 'What went well?', sortOrder: 0 }],
              answers: [],
              canAnswer: true,
              canClose: true,
              summary: null,
            }),
            loading: signal(false),
            error: signal(null),
            loadRequest: vi.fn(async () => undefined),
            upsertAnswers: vi.fn(async () => undefined),
            close: vi.fn(async () => undefined),
          },
        },
        {
          provide: FeedbackShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackDetail);
    fixture.componentRef.setInput('requestId', 'req-1');
    fixture.detectChanges();
  });

  it('saves drafted answers', async () => {
    const feedback = TestBed.inject(FeedbackFacade);
    const component = fixture.componentInstance;
    component.setDraft('p1', 'Great collab');
    await component.saveAnswers();
    expect(feedback.upsertAnswers).toHaveBeenCalledWith('req-1', {
      answers: [{ promptId: 'p1', body: 'Great collab' }],
    });
  });
});
