import { EntityState, EntityAdapter, createEntityAdapter } from '@ngrx/entity';
import { createReducer, on, Action } from '@ngrx/store';

import * as AppActions from './app.actions';
import { AppEntity } from './app.models';

export const APP_FEATURE_KEY = 'app';

export interface AppState extends EntityState<AppEntity> {
  selectedId?: string | number; // which App record has been selected
  loaded: boolean; // has the App list been loaded
  error?: string | null; // last known error (if any)
}

export interface AppPartialState {
  readonly [APP_FEATURE_KEY]: AppState;
}

export const appAdapter: EntityAdapter<AppEntity> =
  createEntityAdapter<AppEntity>();

export const initialAppState: AppState = appAdapter.getInitialState({
  // set initial required properties
  loaded: false,
});

const reducer = createReducer(
  initialAppState,
  on(AppActions.initApp, (state) => ({ ...state, loaded: false, error: null })),
  on(AppActions.loadAppSuccess, (state, { app }) =>
    appAdapter.setAll(app, { ...state, loaded: true }),
  ),
  on(AppActions.loadAppFailure, (state, { error }) => ({ ...state, error })),
);

export function appReducer(state: AppState | undefined, action: Action) {
  return reducer(state, action);
}
