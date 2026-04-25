import { Course, DiscoveredFile } from '../types';
import { WorkflowSummary } from '../workflow/types';

export type WorkerCommandType =
  | 'startWorkflow'
  | 'discoverCourses'
  | 'discoverFiles'
  | 'download'
  | 'cleanup'
  | 'shutdown';

export interface WorkerCommandMap {
  startWorkflow: {
    username?: string;
    password?: string;
    downloadDir?: string;
    headless?: boolean;
  };
  discoverCourses: {
    filterPattern?: string;
  };
  discoverFiles: {
    courses: Course[];
  };
  download: {
    files: DiscoveredFile[];
  };
  cleanup: Record<string, never>;
  shutdown: Record<string, never>;
}

export interface WorkerResponseMap {
  startWorkflow: { ok: true; downloadDir: string; logFile: string };
  discoverCourses: Course[];
  discoverFiles: {
    discovered: DiscoveredFile[];
    enriched: DiscoveredFile[];
    files: DiscoveredFile[];
    skippedOnDisk: number;
  };
  download: WorkflowSummary;
  cleanup: { ok: true };
  shutdown: { ok: true };
}

export interface WorkerCommandMessage<T extends WorkerCommandType = WorkerCommandType> {
  kind: 'command';
  id: string;
  command: T;
  payload?: WorkerCommandMap[T];
}

export interface WorkerReadyMessage {
  kind: 'ready';
}

export interface WorkerResponseMessage {
  kind: 'response';
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface WorkerEventMessage {
  kind: 'event';
  type: string;
  payload: unknown;
}

export interface WorkerLogMessage {
  kind: 'log';
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export type WorkerOutgoingMessage =
  | WorkerReadyMessage
  | WorkerResponseMessage
  | WorkerEventMessage
  | WorkerLogMessage;
