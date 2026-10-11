import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Landing } from './landing';

describe('Landing', () => {
  let fixture: ComponentFixture<Landing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
  });

  it('renders the SilverVibe landing headline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const brand = compiled.querySelector('p[aria-label="SilverVibe"]');
    expect(brand).toBeTruthy();
    expect(brand?.textContent).toContain('SilverVibe');
    expect(brand?.textContent).toContain('™');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'A better vibe for async work.',
    );
    expect(compiled.textContent).toContain('personal open-source');
    expect(compiled.textContent).toContain('Privacy');
    expect(compiled.textContent).not.toContain('VibeStandup');
  });

  it('uses the light mark by default', () => {
    expect(fixture.componentInstance.markSrc()).toBe('brand/mark.svg');
    expect(fixture.componentInstance.isDark()).toBe(false);
  });
});
