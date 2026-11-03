import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MentionText } from './mention-text';

describe('MentionText', () => {
  let fixture: ComponentFixture<MentionText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MentionText],
    }).compileComponents();
    fixture = TestBed.createComponent(MentionText);
    fixture.componentRef.setInput('segments', [
      { kind: 'text', text: 'with ' },
      { kind: 'person', text: '@Ada' },
      { kind: 'text', text: ' on ' },
      {
        kind: 'link',
        text: 'PROJ-12',
        href: 'https://example.test/browse/PROJ-12',
      },
    ]);
    fixture.detectChanges();
  });

  it('renders a person name and an issue link', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('span.font-semibold')?.textContent).toBe('@Ada');
    const link = el.querySelector('a');
    expect(link?.textContent).toBe('PROJ-12');
    expect(link?.getAttribute('href')).toBe(
      'https://example.test/browse/PROJ-12',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});
