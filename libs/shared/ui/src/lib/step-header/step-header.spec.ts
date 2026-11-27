import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepHeader } from './step-header';

describe('StepHeader', () => {
  let fixture: ComponentFixture<StepHeader>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepHeader],
    }).compileComponents();

    fixture = TestBed.createComponent(StepHeader);
    fixture.componentRef.setInput('step', 2);
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('title', 'Participants');
    fixture.componentRef.setInput('nextLabel', 'Next: Review');
    fixture.detectChanges();
  });

  it('shows step progress and title', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Step 2 of 3');
    expect(root.textContent).toContain('Next: Review');
    expect(root.textContent).toContain('Participants');
    const bar = root.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('2');
    expect(bar?.getAttribute('aria-valuemax')).toBe('3');
  });
});
