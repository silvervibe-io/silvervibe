import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Shell);
    fixture.componentRef.setInput('title', 'Silvervibe');
    fixture.componentRef.setInput('links', [
      { label: 'Standup', href: '/standup' },
    ]);
    await fixture.whenStable();
  });

  it('renders the product title', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Silvervibe');
  });

  it('renders navigation links', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Standup');
  });
});
