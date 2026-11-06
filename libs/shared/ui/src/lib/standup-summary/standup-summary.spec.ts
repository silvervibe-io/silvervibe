import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { StandupSummary, groupSummarySections } from './standup-summary';

describe('groupSummarySections', () => {
  it('puts needs help before today and keeps yesterday last', () => {
    const sections = groupSummarySections(
      [
        '## Alpha standup — 2026-10-27',
        '### Today',
        '- **Ada**: Digests',
        '### Blockers',
        '- **Bob**: Waiting on key',
        '### Yesterday',
        '- **Ada**: OAuth',
      ].join('\n'),
    );
    expect(sections.map((section) => section.kind)).toEqual([
      'title',
      'help',
      'today',
      'yesterday',
    ]);
  });
});

describe('StandupSummary', () => {
  let fixture: ComponentFixture<StandupSummary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StandupSummary],
      providers: [
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
                  my: {
                    summaryNeedsHelp: 'Needs help',
                    summaryToday: 'Today',
                    summaryYesterday: 'Yesterday',
                  },
                },
              });
            }
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StandupSummary);
    fixture.componentRef.setInput(
      'text',
      [
        '## Alpha',
        '### Needs help',
        '- **Bob**: Waiting on key',
        '### Today',
        '- **Ada**: Digests',
        '### Yesterday',
        '- **Ada**: OAuth',
      ].join('\n'),
    );
    fixture.detectChanges();
  });

  it('shows needs help and today, and starts yesterday collapsed', () => {
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text.indexOf('Needs help')).toBeLessThan(text.indexOf('Today'));
    expect(text).toContain('Waiting on key');
    const yesterday = el.querySelector('details');
    expect(yesterday).not.toBeNull();
    expect(yesterday?.open).toBe(false);
    expect(yesterday?.textContent).toContain('Yesterday');
  });
});
