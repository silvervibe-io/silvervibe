import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsSection } from './settings-section';

describe('SettingsSection', () => {
  let fixture: ComponentFixture<SettingsSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsSection],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsSection);
    fixture.componentRef.setInput('title', 'Schedule');
    fixture.componentRef.setInput('purpose', 'When people answer');
    fixture.detectChanges();
  });

  it('renders title and purpose', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Schedule');
    expect(root.textContent).toContain('When people answer');
  });

  it('toggles learn-more disclosure', () => {
    fixture.componentRef.setInput('learnMore', 'Extra guidance.');
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Extra guidance.',
    );
  });

  it('emits save when dirty and clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentRef.setInput('dirty', true);
    fixture.detectChanges();
    const saveBtn = (fixture.nativeElement as HTMLElement).querySelector(
      '.btn-primary',
    ) as HTMLButtonElement;
    saveBtn.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
