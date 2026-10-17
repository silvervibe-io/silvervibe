import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Icon } from './icon';

describe('Icon', () => {
  let fixture: ComponentFixture<Icon>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Icon],
    }).compileComponents();
    fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'sun');
    fixture.detectChanges();
  });

  it('masks the shared sun SVG asset', () => {
    const span = (fixture.nativeElement as HTMLElement).querySelector(
      'span',
    ) as HTMLElement;
    expect(span.style.maskImage).toContain('icons/sun.svg');
  });

  it('masks the shared moon SVG asset', () => {
    fixture.componentRef.setInput('name', 'moon');
    fixture.detectChanges();
    const span = (fixture.nativeElement as HTMLElement).querySelector(
      'span',
    ) as HTMLElement;
    expect(span.style.maskImage).toContain('icons/moon.svg');
  });
});
