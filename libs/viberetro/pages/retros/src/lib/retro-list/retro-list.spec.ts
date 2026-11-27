import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RetroFacade } from '@silvervibe/stores/retro';
import { WorkspaceFacade } from '@silvervibe/stores/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroShellLinks } from '../retro-shell-links';
import { RetroList } from './retro-list';

describe('RetroList', () => {
  let fixture: ComponentFixture<RetroList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RetroList,
        TranslocoTestingModule.forRoot({
          langs: { en: { retro: { list: {}, nav: {} } } },
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
          provide: RetroFacade,
          useValue: {
            loading: signal(false),
            error: signal(null),
            retros: signal([]),
            loadRetros: vi.fn(async () => undefined),
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
          provide: RetroShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroList);
    fixture.detectChanges();
  });

  it('loads retros for the selected workspace', async () => {
    const retros = TestBed.inject(RetroFacade);
    await fixture.componentInstance.ngOnInit();
    expect(retros.loadRetros).toHaveBeenCalledWith('ws-1');
  });
});
