import { createFeature, createReducer, on } from '@ngrx/store';
import { StandupDraft, saveDraft } from './standup.actions';

const initialState: StandupDraft = {
  yesterday: '',
  today: '',
  blockers: '',
};

export const standupFeature = createFeature({
  name: 'standup',
  reducer: createReducer(
    initialState,
    on(
      saveDraft,
      (_state, draft): StandupDraft => ({
        yesterday: draft.yesterday,
        today: draft.today,
        blockers: draft.blockers,
      }),
    ),
  ),
});
