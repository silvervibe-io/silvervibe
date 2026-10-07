import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { appConfig } from './app.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [...appConfig.providers],
    }).compileComponents();
  });

  it('renders the Silver Vibe landing headline', async () => {
    const fixture = TestBed.createComponent(App);

    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Silver');
    expect(compiled.textContent).toContain('Vibe');
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'A better vibe for async work.',
    );
    expect(compiled.textContent).toContain('personal open-source');
    expect(compiled.textContent).not.toContain('VibeStandup');

    const github = compiled.querySelector(
      'a[href="https://github.com/silvervibe-io/silvervibe"]',
    );
    const email = compiled.querySelector('a[href="mailto:info@silvervibe.io"]');
    expect(github?.textContent?.trim()).toBe('Source on GitHub');
    expect(email?.textContent?.trim()).toBe('info@silvervibe.io');
  });
});
