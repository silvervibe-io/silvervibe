import { createAction, props } from '@ngrx/store';
import { AppEntity } from './app.models';

export const initApp = createAction('[App Page] Init');

export const loadAppSuccess = createAction(
  '[App/API] Load App Success',
  props<{ app: AppEntity[] }>(),
);

export const loadAppFailure = createAction(
  '[App/API] Load App Failure',
  props<{ error: any }>(),
);
