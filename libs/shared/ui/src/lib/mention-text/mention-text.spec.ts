import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MentionText, parseSummaryBlocks } from './mention-text';

describe('parseSummaryBlocks', () => {
  it('renders headings, bold names, lists, and plain mentions', () => {
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
      expect(paragraph.inlines).toEqual([
        { kind: 'bold', text: 'Ada' },
        { kind: 'text', text: ': shipped @Ada' },
      ]);
    }
    const list = blocks[2];
    expect(list?.kind).toBe('list');
    if (list?.kind === 'list') {
      expect(list.items[0]).toEqual([{ kind: 'text', text: '#PROJ-12' }]);
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

  it('renders bold text and a #name mention', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('strong')?.textContent).toBe('Ada');
    expect(el.textContent).toContain('#PROJ-12');
    expect(el.querySelector('a')).toBeNull();
    expect(el.innerHTML).not.toContain('mention:user');
    expect(el.innerHTML).not.toContain('<script');
  });
});
