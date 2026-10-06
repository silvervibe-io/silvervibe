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

  it('stores the standup draft', async () => {
    const fixture = TestBed.createComponent(App);
    const component = fixture.componentInstance;

    component.yesterday.set('Shipped the shell');
    component.today.set('Wire the API');
    component.blockers.set('None');
    component.save();
    await fixture.whenStable();

    expect(component.saved()).toEqual({
      yesterday: 'Shipped the shell',
      today: 'Wire the API',
      blockers: 'None',
    });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent,
    ).toContain('Vibe Standup');
  });
});
