import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { StandupFacade } from '@silvervibe/stores/standup';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { of } from 'rxjs';
import { InviteAccept } from './invite-accept';

describe('InviteAccept', () => {
  let fixture: ComponentFixture<InviteAccept>;
  let standup: {
    acceptInvite: ReturnType<typeof vi.fn>;
  };
  let workspaces: {
    loadMyWorkspaces: ReturnType<typeof vi.fn>;
    selectWorkspace: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    standup = {
      acceptInvite: vi.fn().mockResolvedValue({
        teamId: 't1',
        workspaceId: 'ws1',
        member: { id: 'm1', userId: 'u1', role: 'MEMBER' },
      }),
    };
    workspaces = {
      loadMyWorkspaces: vi.fn().mockResolvedValue(undefined),
      selectWorkspace: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InviteAccept],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'tok-1' } },
          },
        },
        { provide: StandupFacade, useValue: standup },
        { provide: WorkspaceFacade, useValue: workspaces },
        ...provideTransloco({
          config: {
            availableLangs: ['en'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
            prodMode: true,
          },
          loader: class {
            getTranslation() {
              return of({
                standup: {
                  nav: { myStandup: 'My standup' },
                  invite: {
                    title: 'Join team',
                    accepting: 'Accepting…',
                    success: 'Joined',
                    goStandup: 'Open standup',
                    signIn: 'Sign in',
                    missingToken: 'Missing',
                    acceptFailed: 'Failed',
                  },
                },
                nav: { account: 'Account' },
                shell: {
                  theme: { toDark: 'Dark', toLight: 'Light' },
                  preview: {
                    badge: 'Preview',
                    role: 'Role',
                    plan: 'Plan',
                    limits: '{{plan}}',
                  },
                },
                common: { language: { label: 'Language', en: 'English' } },
              });
            }
          },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteAccept);
  });

  it('accepts the invite and selects the workspace', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    expect(standup.acceptInvite).toHaveBeenCalledWith('tok-1');
    expect(workspaces.loadMyWorkspaces).toHaveBeenCalled();
    expect(workspaces.selectWorkspace).toHaveBeenCalledWith('ws1');
    expect(fixture.componentInstance.success()).toBe(true);
    expect(fixture.componentInstance.busy()).toBe(false);
  });
});
