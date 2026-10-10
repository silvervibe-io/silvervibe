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

  it('renders the Silver Vibe landing headline', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Silver');
    expect(compiled.textContent).toContain('Vibe');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'A better vibe for async work.',
    );
    expect(compiled.textContent).toContain('personal open-source');
    expect(compiled.textContent).toContain('Privacy');
    expect(compiled.textContent).not.toContain('VibeStandup');
  });
});
