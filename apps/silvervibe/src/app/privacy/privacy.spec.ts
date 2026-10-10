import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Privacy } from './privacy';

describe('Privacy', () => {
  let fixture: ComponentFixture<Privacy>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Privacy],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Privacy);
    await fixture.whenStable();
  });

  it('renders the privacy policy heading', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Privacy policy',
    );
    expect(compiled.textContent).toContain('Firebase Authentication');
    expect(compiled.textContent).toContain('info@silvervibe.io');
  });
});
