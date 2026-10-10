import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { Home } from './home';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            standup: { yesterday: '', today: '', blockers: '' },
          },
        }),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
  });

  it('renders the standup draft form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Vibe Standup');
    expect(compiled.textContent).toContain('Yesterday');
    expect(compiled.textContent).toContain('Save draft');
  });
});
