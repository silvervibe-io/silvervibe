import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FeedbackFacade } from '@silvervibe/stores/feedback';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackShellLinks } from '../feedback-shell-links';
import { FeedbackCreate } from './feedback-create';

describe('FeedbackCreate', () => {
  let fixture: ComponentFixture<FeedbackCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FeedbackCreate,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              feedback: {
                create: {},
                nav: {},
                visibility: {},
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
          provide: FeedbackFacade,
          useValue: {
            members: signal([]),
            loading: signal(false),
            error: signal(null),
            loadMembers: vi.fn(async () => undefined),
            createRequest: vi.fn(async () => 'req-1'),
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
          provide: FeedbackShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackCreate);
    fixture.detectChanges();
  });

  it('manages prompts and invites', () => {
    const component = fixture.componentInstance;
    component.addPrompt();
    expect(component.prompts().length).toBe(2);
    component.updatePrompt(1, 'Advice?');
    expect(component.prompts()[1]).toBe('Advice?');
    component.toggleInvite('u1', true);
    expect(component.isInvited('u1')).toBe(true);
  });
});
