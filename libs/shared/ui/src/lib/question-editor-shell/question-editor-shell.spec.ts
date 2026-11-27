import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuestionEditorShell } from './question-editor-shell';

@Component({
  imports: [QuestionEditorShell],
  template: `
    <sv-question-editor-shell
      title="Questions"
      purpose="What members answer each day."
      tip="Built-in questions can be disabled but not removed."
    >
      <li>Yesterday</li>
      <button type="button" actions>Add</button>
    </sv-question-editor-shell>
  `,
})
class Host {}

describe('QuestionEditorShell', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('projects questions and actions with tip callout', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Questions');
    expect(root.textContent).toContain('What members answer each day.');
    expect(root.textContent).toContain('Yesterday');
    expect(root.textContent).toContain('Add');
    expect(root.textContent).toContain(
      'Built-in questions can be disabled but not removed.',
    );
  });
});
