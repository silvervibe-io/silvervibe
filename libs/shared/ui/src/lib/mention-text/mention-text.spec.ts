import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MentionText, parseSummaryBlocks } from './mention-text';

describe('parseSummaryBlocks', () => {
  it('renders headings, bold names, lists, people, and https links', () => {
    const blocks = parseSummaryBlocks(
      [
        '## Today',
        '**Ada**: shipped [@Ada](mention:user:user_1)',
        '- [PROJ-12](https://example.test/browse/PROJ-12)',
        '- plain',
      ].join('\n'),
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'list',
    ]);
    const paragraph = blocks[1];
    expect(paragraph?.kind).toBe('paragraph');
    if (paragraph?.kind === 'paragraph') {
      expect(paragraph.inlines.map((part) => part.kind)).toEqual([
        'bold',
        'text',
        'person',
      ]);
    }
    const list = blocks[2];
    expect(list?.kind).toBe('list');
    if (list?.kind === 'list') {
      expect(list.items[0]?.[0]).toEqual({
        kind: 'link',
        text: 'PROJ-12',
        href: 'https://example.test/browse/PROJ-12',
      });
    }
  });
});

describe('MentionText', () => {
  let fixture: ComponentFixture<MentionText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MentionText],
    }).compileComponents();
    fixture = TestBed.createComponent(MentionText);
    fixture.componentRef.setInput(
      'text',
      'with **Ada** on [PROJ-12](https://example.test/browse/PROJ-12)',
    );
    fixture.detectChanges();
  });

  it('renders bold text and an issue link', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('strong')?.textContent).toBe('Ada');
    const link = el.querySelector('a');
    expect(link?.textContent).toBe('PROJ-12');
    expect(link?.getAttribute('href')).toBe(
      'https://example.test/browse/PROJ-12',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(el.innerHTML).not.toContain('<script');
  });
});
