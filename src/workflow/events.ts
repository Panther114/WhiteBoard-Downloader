export type WorkflowEventName =
  | 'login:start'
  | 'login:success'
  | 'login:failure'
  | 'courses:discovered'
  | 'files:discovery:start'
  | 'files:discovery:complete'
  | 'files:ready'
  | 'download:start'
  | 'download:progress'
  | 'download:complete'
  | 'download:error'
  | 'download:skip'
  | 'summary:ready';

export interface WorkflowEvent<T = unknown> {
  type: WorkflowEventName;
  payload: T;
}

