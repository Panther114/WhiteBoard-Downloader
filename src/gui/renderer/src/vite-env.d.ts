/// <reference types="vite/client" />

declare global {
  interface Window {
    whiteboardGui: {
      getVersion: () => Promise<string>;
      loadConfig: () => Promise<Record<string, unknown>>;
      saveSetup: (payload: Record<string, unknown>) => Promise<{ ok: boolean }>;
      resetSetup: () => Promise<{ ok: boolean }>;
      runDoctor: (payload?: { loginTest?: boolean }) => Promise<Array<Record<string, unknown>>>;
      workflowStart: (payload?: Record<string, unknown>) => Promise<{ ok: boolean }>;
      discoverCourses: (payload?: { filterPattern?: string }) => Promise<
        Array<{ id: string; name: string; url: string; path: string }>
      >;
      discoverFiles: (
        courses: Array<{ id: string; name: string; url: string; path: string }>,
      ) => Promise<Record<string, unknown>>;
      downloadFiles: (
        files: Array<{
          name: string;
          url: string;
          courseName: string;
          sectionName: string;
          savePath: string;
          size?: number;
          fileType?: string;
        }>,
      ) => Promise<Record<string, unknown>>;
      cleanupWorkflow: () => Promise<{ ok: boolean }>;
      getPaths: () => Promise<{ downloads: string; logs: string; summary: string }>;
      openDownloads: () => Promise<string>;
      openLogs: () => Promise<string>;
      onWorkflowEvent: (handler: (event: { type: string; payload: unknown }) => void) => () => void;
    };
  }
}

export {};

