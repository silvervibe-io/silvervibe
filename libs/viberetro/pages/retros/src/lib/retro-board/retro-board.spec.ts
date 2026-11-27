import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { RetroFacade } from '@silvervibe/stores/retro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroShellLinks } from '../retro-shell-links';
import { RetroBoard } from './retro-board';

describe('RetroBoard', () => {
  let fixture: ComponentFixture<RetroBoard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RetroBoard,
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              retro: { board: {}, nav: {}, column: {} },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: RetroFacade,
          useValue: {
            selected: signal({
              id: 'retro-1',
              title: 'Sprint',
              status: 'OPEN',
              noteVisibility: 'LIVE',
              closePolicy: 'CREATOR_OR_ADMIN',
              notes: [],
              canAddNotes: true,
              canClose: true,
              summary: null,
            }),
            loading: signal(false),
            error: signal(null),
            loadRetro: vi.fn(async () => undefined),
            addNote: vi.fn(async () => undefined),
            deleteNote: vi.fn(async () => undefined),
            close: vi.fn(async () => undefined),
          },
        },
        {
          provide: RetroShellLinks,
          useValue: { links: signal([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RetroBoard);
    fixture.componentRef.setInput('retroId', 'retro-1');
    fixture.detectChanges();
  });

  it('submits a draft note', async () => {
    const retros = TestBed.inject(RetroFacade);
    const component = fixture.componentInstance;
    component.draftBody.set('Went well');
    await component.addNote();
    expect(retros.addNote).toHaveBeenCalledWith('retro-1', {
      column: 'WENT_WELL',
      body: 'Went well',
    });
  });
});
