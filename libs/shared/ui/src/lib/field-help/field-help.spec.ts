import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FieldHelp } from './field-help';

describe('FieldHelp', () => {
  let fixture: ComponentFixture<FieldHelp>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldHelp],
    }).compileComponents();

    fixture = TestBed.createComponent(FieldHelp);
    fixture.componentRef.setInput('controlId', 'tz');
    fixture.componentRef.setInput('description', 'Used for reminders.');
    fixture.componentRef.setInput('help', 'Example: Europe/Amsterdam');
    fixture.detectChanges();
  });

  it('exposes describedBy ids for both texts', () => {
    expect(fixture.componentInstance.describedBy()).toBe('tz-desc tz-help');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#tz-desc')?.textContent).toContain(
      'Used for reminders.',
    );
    expect(root.querySelector('#tz-help')?.textContent).toContain(
      'Europe/Amsterdam',
    );
  });
});
