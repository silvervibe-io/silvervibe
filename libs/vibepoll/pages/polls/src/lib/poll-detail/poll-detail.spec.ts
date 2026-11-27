import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PollFacade } from '@silvervibe/stores/poll';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PollShellLinks } from '../poll-shell-links';
import { PollDetail } from './poll-detail';

describe('PollDetail', () => {
  let fixture: ComponentFixture<PollDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PollDetail,
        TranslocoTestingModule.forRoot({
          langs: { en: { poll: { detail: {}, nav: {} } } },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: PollFacade,
          useValue: {
            selected: signal({
              id: 'poll-1',
              myOptionIds: ['opt-1'],
              allowMulti: false,
              canVote: true,
              canClose: true,
              canSeeResults: true,
              status: 'OPEN',
              question: 'Q?',
              options: [],
            }),
            results: signal(null),
            loading: signal(false),
            error: signal(null),
            loadPoll: vi.fn(async () => undefined),
            vote: vi.fn(async () => undefined),
            close: vi.fn(async () => undefined),
          },
        },
        {
          provide: PollShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PollDetail);
    fixture.componentRef.setInput('pollId', 'poll-1');
    fixture.detectChanges();
  });

  it('selects a single option for radio mode', () => {
    const component = fixture.componentInstance;
    component.toggleOption('opt-2', false, true);
    expect(component.isSelected('opt-2')).toBe(true);
    expect(component.isSelected('opt-1')).toBe(false);
  });

  it('submits the current selection', async () => {
    const polls = TestBed.inject(PollFacade);
    const component = fixture.componentInstance;
    component.toggleOption('opt-2', false, true);
    await component.submitVote();
    expect(polls.vote).toHaveBeenCalledWith('poll-1', ['opt-2']);
  });
});
