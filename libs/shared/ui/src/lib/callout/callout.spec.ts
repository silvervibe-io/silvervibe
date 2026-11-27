import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Callout } from './callout';

describe('Callout', () => {
  let fixture: ComponentFixture<Callout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Callout],
    }).compileComponents();

    fixture = TestBed.createComponent(Callout);
    fixture.componentRef.setInput('variant', 'tip');
    fixture.componentRef.setInput('title', 'Invite the bot');
    fixture.componentRef.setInput('body', 'Run /invite in the channel.');
    fixture.detectChanges();
  });

  it('renders title, body, and accessible variant label', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Invite the bot');
    expect(root.textContent).toContain('Run /invite in the channel.');
    expect(root.querySelector('.sr-only')?.textContent).toContain('Tip');
  });
});
