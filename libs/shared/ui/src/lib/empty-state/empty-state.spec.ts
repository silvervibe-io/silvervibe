import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  let fixture: ComponentFixture<EmptyState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyState],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'No tools yet');
    fixture.componentRef.setInput('body', 'Enable a tool to get started.');
    fixture.componentRef.setInput('primaryLabel', 'Enable a tool');
    fixture.detectChanges();
  });

  it('renders copy and emits primary click', () => {
    const spy = vi.fn();
    fixture.componentInstance.primaryClick.subscribe(spy);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No tools yet');
    expect(root.textContent).toContain('Enable a tool to get started.');
    (root.querySelector('.btn-primary') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
