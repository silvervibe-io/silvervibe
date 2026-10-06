import { createAction, props } from '@ngrx/store';

export interface StandupDraft {
  yesterday: string;
  today: string;
  blockers: string;
}

export const saveDraft = createAction(
  '[Standup] Save Draft',
  props<StandupDraft>(),
);
