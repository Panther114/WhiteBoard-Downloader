import { contextBridge, ipcRenderer } from 'electron';
import { Course, DiscoveredFile } from '../types';

type WorkflowEvent = { type: string; payload: unknown };

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
  loadConfig: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('config:load'),
  saveSetup: (payload: Record<string, unknown>): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('setup:save', payload),
  resetSetup: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('setup:reset'),
  runDoctor: (payload?: { loginTest?: boolean }): Promise<Array<Record<string, unknown>>> =>
    ipcRenderer.invoke('doctor:run', payload || {}),
  workflowStart: (payload?: Record<string, unknown>): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('workflow:start', payload || {}),
  discoverCourses: (payload?: { filterPattern?: string }): Promise<Course[]> =>
    ipcRenderer.invoke('workflow:discover-courses', payload || {}),
  discoverFiles: (courses: Course[]): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('workflow:discover-files', { courses }),
  downloadFiles: (files: DiscoveredFile[]): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('workflow:download', { files }),
  cleanupWorkflow: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('workflow:cleanup'),
  getPaths: (): Promise<{ downloads: string; logs: string; summary: string }> =>
    ipcRenderer.invoke('paths:get'),
  openDownloads: (): Promise<string> => ipcRenderer.invoke('path:open-downloads'),
  openLogs: (): Promise<string> => ipcRenderer.invoke('path:open-logs'),
  onWorkflowEvent: (handler: (event: WorkflowEvent) => void): (() => void) => {
    const listener = (_: unknown, evt: WorkflowEvent) => handler(evt);
    ipcRenderer.on('workflow:event', listener);
    return () => ipcRenderer.removeListener('workflow:event', listener);
  },
};

contextBridge.exposeInMainWorld('whiteboardGui', api);

