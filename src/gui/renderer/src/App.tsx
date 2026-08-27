import React, { useEffect, useMemo, useRef, useState } from 'react';
import appIconUrl from '../../../../assets/app-icon.ico';

type Stage = 'welcome' | 'setup' | 'doctor' | 'courses' | 'files' | 'download' | 'summary' | 'agent' | 'updates';
type View = 'home' | 'download' | 'setup' | 'doctor' | 'agent' | 'updates';
type Course = { id: string; name: string; url: string; path: string };
type DiscoveredFile = {
  name: string;
  url: string;
  courseName: string;
  sectionName: string;
  savePath: string;
  size?: number;
  fileType?: string;
};
type DoctorRow = { status: 'pass' | 'warn' | 'fail'; message: string; required?: boolean };
type Summary = {
  coursesDiscovered: number;
  coursesSelected: number;
  filesDiscovered: number;
  filesSelected: number;
  filesDownloaded: number;
  filesSkipped: number;
  filesFailed: number;
  failedFiles: Array<{ name: string; reason: string }>;
};

type IconName =
  | 'home'
  | 'download'
  | 'setup'
  | 'diagnostics'
  | 'agent'
  | 'updates'
  | 'folder'
  | 'file'
  | 'terminal'
  | 'scan'
  | 'search'
  | 'search-x'
  | 'check'
  | 'check-circle'
  | 'check-square'
  | 'x'
  | 'x-circle'
  | 'key'
  | 'lock'
  | 'monitor'
  | 'eye'
  | 'sparkles'
  | 'open'
  | 'refresh'
  | 'cloud-download'
  | 'hard-drive'
  | 'clock'
  | 'gauge'
  | 'alert'
  | 'warning'
  | 'info'
  | 'book'
  | 'back'
  | 'sliders'
  | 'shield';

const iconPaths: Record<IconName, React.ReactNode> = {
  home: <><path d="m4 10 8-6 8 6" /><path d="M6.5 9.5V20h11V9.5" /><path d="M10 20v-5h4v5" /></>,
  download: <><path d="M12 3v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19h14" /><path d="M8 22h8" /></>,
  setup: <><circle cx="12" cy="8" r="3.1" /><path d="M5.5 20c.8-3.4 3-5 6.5-5s5.7 1.6 6.5 5" /></>,
  diagnostics: <><path d="M12 3.5v5l3.2 1.8" /><circle cx="12" cy="12" r="7.8" /><path d="m8.5 19.1-1 2" /><path d="m15.5 19.1 1 2" /></>,
  agent: <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /><path d="M9 4V2h6v2" /></>,
  updates: <><path d="M20 11a8 8 0 0 0-13.7-4.8L4 8.5" /><path d="M4 4.5v4h4" /><path d="M4 13a8 8 0 0 0 13.7 4.8l2.3-2.3" /><path d="M20 19.5v-4h-4" /></>,
  folder: <><path d="M3.5 7.5h6l1.8 2h9.2v9.2a1.8 1.8 0 0 1-1.8 1.8H5.3a1.8 1.8 0 0 1-1.8-1.8Z" /><path d="M3.5 7.5V5.8A1.8 1.8 0 0 1 5.3 4h4l2 2h6.4" /></>,
  file: <><path d="M6.5 3.5h7l4 4V20a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path d="M13.5 3.5V8h4" /><path d="M8.5 12h5M8.5 16h5" /></>,
  terminal: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m7 10 2.5 2L7 14" /><path d="M12 14h4" /></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="3.5" /><path d="M12 8.5v7M8.5 12h7" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></>,
  'search-x': <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2M8.8 8.8l4 4M12.8 8.8l-4 4" /></>,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  'check-circle': <><circle cx="12" cy="12" r="8.2" /><path d="m8 12.2 2.7 2.7L16.5 9" /></>,
  'check-square': <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 2.5 2.5L16.5 9" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  'x-circle': <><circle cx="12" cy="12" r="8.2" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  key: <><circle cx="8.5" cy="15.5" r="3.5" /><path d="m11 13 8-8M15 5l4 4M16.5 8.5l2 2" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
  monitor: <><rect x="3.5" y="4.5" width="17" height="12" rx="2" /><path d="M8 20h8M12 16.5V20" /></>,
  eye: <><path d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z" /><circle cx="12" cy="12" r="2" /></>,
  sparkles: <><path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2Z" /><path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6Z" /></>,
  open: <><path d="M14 4h6v6M20 4l-8 8" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-13.7-4.8L4 8.5" /><path d="M4 4.5v4h4" /><path d="M4 13a8 8 0 0 0 13.7 4.8l2.3-2.3" /><path d="M20 19.5v-4h-4" /></>,
  'cloud-download': <><path d="M7.5 18.5H6a4 4 0 1 1 1.7-7.6A5.5 5.5 0 0 1 18 12.5h.5a3 3 0 1 1 0 6H16" /><path d="M12 11v8M8.8 15.8 12 19l3.2-3.2" /></>,
  'hard-drive': <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 15h.01M10 15h.01M13 15h4" /><path d="M7 9h10" /></>,
  clock: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.5v5l3.2 1.8" /></>,
  gauge: <><path d="M4.5 17a8.2 8.2 0 1 1 15 0" /><path d="m12 12 4-4" /><path d="M6 18h.01M18 18h.01" /></>,
  alert: <><path d="M12 4 3.7 19h16.6L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  warning: <><path d="M12 4 3.7 19h16.6L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="8.2" /><path d="M12 11v5M12 8h.01" /></>,
  book: <><path d="M4.5 5.5a2 2 0 0 1 2-2H19v16H6.5a2 2 0 0 0-2 2Z" /><path d="M4.5 5.5v14M8 7h7M8 11h7" /></>,
  back: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  sliders: <><path d="M4 6h6M14 6h6M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="12" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.5-7 9-4.1-1.5-7-4.7-7-9V6Z" /><path d="m9 12 2 2 4-4" /></>,
};

function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}

function AppIcon({ className = '' }: { className?: string }) {
  return <img className={`app-icon ${className}`} src={appIconUrl} alt="" aria-hidden="true" />;
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const eta = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '?';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const WIZARD_STEPS = ['Courses', 'Files', 'Download', 'Summary'] as const;
const WIZARD_ICONS: IconName[] = ['book', 'file', 'download', 'check-circle'];
const wizardStepIndex = (stage: Stage): number => {
  if (stage === 'courses') return 0;
  if (stage === 'files') return 1;
  if (stage === 'download') return 2;
  if (stage === 'summary') return 3;
  return -1;
};

export function App() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isScanningCourses, setIsScanningCourses] = useState(false);
  const [config, setConfig] = useState({
    username: '',
    password: '',
    downloadDir: './downloads',
    headless: true,
  });
  const [paths, setPaths] = useState({ downloads: '', logs: '', summary: '' });
  const [doctorRows, setDoctorRows] = useState<DoctorRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<DiscoveredFile[]>([]);
  const [fileSearch, setFileSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedFileUrls, setSelectedFileUrls] = useState<Set<string>>(new Set());
  const [knownByUrl, setKnownByUrl] = useState<Map<string, number>>(new Map());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [downloadState, setDownloadState] = useState({
    completed: 0,
    failed: 0,
    skipped: 0,
    downloadedBytes: 0,
    totalKnownBytes: 0,
    unknownCount: 0,
    speed: 0,
    currentFile: '',
  });
  const [perUrlDownloaded, setPerUrlDownloaded] = useState<Map<string, number>>(new Map());
  const [speedWindow, setSpeedWindow] = useState({ lastTs: Date.now(), bytes: 0 });
  const [selectedRunFileCount, setSelectedRunFileCount] = useState(0);
  const [agentInfo, setAgentInfo] = useState<Record<string, unknown> | null>(null);
  const [agentOutput, setAgentOutput] = useState<Record<string, unknown> | null>(null);
  const [updateState, setUpdateState] = useState<Record<string, unknown>>({ status: 'idle' });

  const selectedRunUrlSetRef = useRef<Set<string>>(new Set());
  const selectedRunKnownByUrlRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!window.whiteboardGui) {
      setVersion('dev preview');
      return;
    }
    (async () => {
      try {
        setVersion(await window.whiteboardGui.getVersion());
        const cfg = (await window.whiteboardGui.loadConfig()) as Record<string, unknown>;
        setConfig(prev => ({
          ...prev,
          username: String(cfg.username || ''),
          downloadDir: String(cfg.downloadDir || './downloads'),
          headless: Boolean(cfg.headless ?? true),
        }));
        setHasCredentials(Boolean(cfg.hasCredentials));
        setPaths(await window.whiteboardGui.getPaths());
        setUpdateState(await window.whiteboardGui.getUpdateState());
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      }
    })();
  }, []);

  useEffect(() => {
    if (!window.whiteboardGui) return;
    const unsub = window.whiteboardGui.onWorkflowEvent(evt => {
      if (evt.type === 'download:start') {
        const payload = evt.payload as { name: string; url: string };
        if (!selectedRunUrlSetRef.current.has(payload.url)) return;
        setDownloadState(s => ({ ...s, currentFile: payload.name }));
      }
      if (evt.type === 'download:progress') {
        const payload = evt.payload as { url: string; downloaded: number };
        if (!selectedRunUrlSetRef.current.has(payload.url)) return;
        setPerUrlDownloaded(prev => {
          const next = new Map(prev);
          const old = next.get(payload.url) || 0;
          if (payload.downloaded > old) {
            const delta = payload.downloaded - old;
            setSpeedWindow(w => ({ ...w, bytes: w.bytes + delta }));
            next.set(payload.url, payload.downloaded);

            const knownSize = selectedRunKnownByUrlRef.current.get(payload.url);
            if (typeof knownSize === 'number') {
              const oldKnown = Math.min(old, knownSize);
              const nextKnown = Math.min(payload.downloaded, knownSize);
              const knownDelta = Math.max(0, nextKnown - oldKnown);
              if (knownDelta > 0) {
                setDownloadState(s => ({
                  ...s,
                  downloadedBytes:
                    s.totalKnownBytes > 0 ? Math.min(s.totalKnownBytes, s.downloadedBytes + knownDelta) : 0,
                }));
              }
            }
          }
          return next;
        });
      }
      if (evt.type === 'download:complete') {
        const payload = evt.payload as { url?: string };
        if (payload.url && !selectedRunUrlSetRef.current.has(payload.url)) return;
        setDownloadState(s => ({ ...s, completed: s.completed + 1 }));
      }
      if (evt.type === 'download:error') {
        const payload = evt.payload as { url?: string };
        if (payload.url && !selectedRunUrlSetRef.current.has(payload.url)) return;
        setDownloadState(s => ({ ...s, failed: s.failed + 1 }));
      }
      if (evt.type === 'download:skip') {
        const payload = evt.payload as { url?: string };
        if (payload.url && !selectedRunUrlSetRef.current.has(payload.url)) return;
        setDownloadState(s => ({ ...s, skipped: s.skipped + 1 }));
      }
      if (evt.type === 'summary:ready') {
        setSummary(evt.payload as Summary);
      }
      if (evt.type === 'update:state') setUpdateState(evt.payload as Record<string, unknown>);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setSpeedWindow(prev => {
        const elapsed = (now - prev.lastTs) / 1000;
        if (elapsed < 1) return prev;
        setDownloadState(s => ({ ...s, speed: prev.bytes / elapsed }));
        return { lastTs: now, bytes: 0 };
      });
    }, 500);
    return () => clearInterval(t);
  }, []);

  const visibleCourses = useMemo(
    () => courses.filter(c => c.name.toLowerCase().includes(courseSearch.toLowerCase())),
    [courses, courseSearch],
  );

  const selectableFiles = useMemo(() => {
    return files.filter(f => {
      if (
        fileSearch &&
        !`${f.name} ${f.courseName} ${f.sectionName}`.toLowerCase().includes(fileSearch.toLowerCase())
      ) {
        return false;
      }
      if (typeFilter !== 'all') {
        const t = (f.fileType || '').toLowerCase();
        if (t !== typeFilter) return false;
      }
      return true;
    });
  }, [files, fileSearch, typeFilter]);

  const selectedCourses = courses.filter(c => selectedCourseIds.has(c.id));
  const selectedFiles = files.filter(f => selectedFileUrls.has(f.url));
  const progressPercent =
    downloadState.totalKnownBytes > 0
      ? Math.min(100, (downloadState.downloadedBytes / downloadState.totalKnownBytes) * 100)
      : selectedRunFileCount > 0
        ? ((downloadState.completed + downloadState.skipped) / selectedRunFileCount) * 100
        : 0;

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

  const remainingKnownBytes = Math.max(0, downloadState.totalKnownBytes - downloadState.downloadedBytes);
  const countProgress = downloadState.completed + downloadState.skipped;

  const activeView: View =
    isPreparingDownload || stage === 'courses' || stage === 'files' || stage === 'download' || stage === 'summary'
      ? 'download'
      : stage === 'welcome'
        ? 'home'
        : (stage as View);

  function toggleFileSelection(url: string) {
    setSelectedFileUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function runWithUiError(action: () => Promise<void>): Promise<void> {
    setErrorMessage('');
    try {
      await action();
    } catch (error) {
      setStatus('');
      setErrorMessage(toErrorMessage(error));
    }
  }

  async function openDownloads() {
    await window.whiteboardGui.openDownloads();
  }

  async function openLogs() {
    await window.whiteboardGui.openLogs();
  }

  async function startFlow() {
    if (isPreparingDownload) return;
    setIsPreparingDownload(true);
    await runWithUiError(async () => {
      setStage('welcome');
      setStatus('Connecting to Blackboard and discovering courses...');
      await window.whiteboardGui.workflowStart({
        username: config.username || undefined,
        password: config.password || undefined,
        downloadDir: config.downloadDir,
        headless: config.headless,
      });
      const discovered = await window.whiteboardGui.discoverCourses();
      setCourses(discovered);
      setSelectedCourseIds(new Set(discovered.map(c => c.id)));
      setStage('courses');
      setStatus('');
    });
    setIsPreparingDownload(false);
  }

  async function beginDownload() {
    await startFlow();
  }

  async function runScanFiles() {
    setIsScanningCourses(true);
    await runWithUiError(async () => {
      try {
        setStatus('Scanning selected courses for files...');
        const result = (await window.whiteboardGui.discoverFiles(selectedCourses)) as {
          files: DiscoveredFile[];
          skippedOnDisk: number;
        };
        setFiles(result.files);
        setSelectedFileUrls(new Set(result.files.map(f => f.url)));
        const known = new Map<string, number>();
        for (const f of result.files) if (typeof f.size === 'number') known.set(f.url, f.size);
        setKnownByUrl(known);
        setDownloadState({
          completed: 0,
          failed: 0,
          skipped: 0,
          downloadedBytes: 0,
          totalKnownBytes: 0,
          unknownCount: 0,
          speed: 0,
          currentFile: '',
        });
        setPerUrlDownloaded(new Map());
        setSelectedRunFileCount(0);
        selectedRunUrlSetRef.current = new Set();
        selectedRunKnownByUrlRef.current = new Map();
        setStage('files');
        setStatus('');
      } finally {
        setIsScanningCourses(false);
      }
    });
  }

  async function startDownload() {
    await runWithUiError(async () => {
      const runSelectedFiles = [...selectedFiles];
      const selectedKnownByUrl = new Map<string, number>();
      for (const f of runSelectedFiles) {
        const knownSize = knownByUrl.get(f.url);
        if (typeof knownSize === 'number') {
          selectedKnownByUrl.set(f.url, knownSize);
        } else if (typeof f.size === 'number') {
          selectedKnownByUrl.set(f.url, f.size);
        }
      }

      const totalKnownBytes = Array.from(selectedKnownByUrl.values()).reduce((a, b) => a + b, 0);
      selectedRunUrlSetRef.current = new Set(runSelectedFiles.map(f => f.url));
      selectedRunKnownByUrlRef.current = selectedKnownByUrl;
      setSelectedRunFileCount(runSelectedFiles.length);
      setPerUrlDownloaded(new Map());
      setSpeedWindow({ lastTs: Date.now(), bytes: 0 });
      setDownloadState({
        completed: 0,
        failed: 0,
        skipped: 0,
        downloadedBytes: 0,
        totalKnownBytes,
        unknownCount: runSelectedFiles.length - selectedKnownByUrl.size,
        speed: 0,
        currentFile: '',
      });

      setStatus('Downloading selected files...');
      setStage('download');
      const result = (await window.whiteboardGui.downloadFiles(runSelectedFiles)) as Summary;
      setSummary(result);
      setStatus('');
      setStage('summary');
    });
  }

  async function saveSetup(testLogin: boolean) {
    await runWithUiError(async () => {
      setStatus(testLogin ? 'Saving setup and testing login...' : 'Saving setup...');
      await window.whiteboardGui.saveSetup({ ...config, testLogin });
      setHasCredentials(Boolean(config.username.trim()) && (Boolean(config.password) || hasCredentials));
      setStatus('Setup saved.');
      setStage('welcome');
    });
  }

  async function resetSetup() {
    await runWithUiError(async () => {
      await window.whiteboardGui.resetSetup();
      setHasCredentials(false);
      setConfig(prev => ({ ...prev, username: '', password: '' }));
      setStatus('Setup reset.');
    });
  }

  async function runDoctor(loginTest = false) {
    await runWithUiError(async () => {
      setStatus('Running doctor checks...');
      const rows = (await window.whiteboardGui.runDoctor({ loginTest })) as DoctorRow[];
      setDoctorRows(rows);
      setStatus('');
    });
  }

  async function loadAgentStatus() {
    await runWithUiError(async () => {
      setStatus('Checking agent readiness...');
      setAgentInfo(await window.whiteboardGui.getAgentStatus());
      setStatus('');
      setStage('agent');
    });
  }

  async function syncAgent() {
    await runWithUiError(async () => {
      setStatus('Reading Blackboard instructions and building agent export...');
      setAgentOutput(await window.whiteboardGui.syncAgent({ includeFiles: false, includeInstructions: true }));
      setStatus('Agent export ready.');
    });
  }

  async function checkUpdates() {
    await runWithUiError(async () => {
      setUpdateState(await window.whiteboardGui.checkForUpdates());
      setStage('updates');
    });
  }

  async function downloadAppUpdate() {
    await runWithUiError(async () => setUpdateState(await window.whiteboardGui.downloadUpdate()));
  }

  const fileTypes = Array.from(new Set(files.map(f => (f.fileType || '').toLowerCase()).filter(Boolean)));

  const navItems: Array<{ id: View; label: string; hint: string; icon: React.ReactNode }> = [
    {
      id: 'home',
      label: 'Home',
      hint: 'Overview & quick start',
      icon: <Icon name="home" size={22} />,
    },
    {
      id: 'download',
      label: 'Download',
      hint: 'Courses → files → save',
      icon: <Icon name="download" size={22} />,
    },
    {
      id: 'setup',
      label: 'Setup',
      hint: 'Credentials & options',
      icon: <Icon name="setup" size={22} />,
    },
    {
      id: 'doctor',
      label: 'Diagnostics',
      hint: 'Environment health',
      icon: <Icon name="diagnostics" size={22} />,
    },
    {
      id: 'agent',
      label: 'Agent Export',
      hint: 'Read-only for AI',
      icon: <Icon name="agent" size={22} />,
    },
    {
      id: 'updates',
      label: 'Updates',
      hint: 'App version',
      icon: <Icon name="updates" size={22} />,
    },
  ];

  function onNav(id: View) {
    if (id === 'home') {
      setStage('welcome');
    } else if (id === 'download') {
      if (activeView === 'download' || isPreparingDownload) return;
      void beginDownload();
    } else if (id === 'setup') {
      setStage('setup');
    } else if (id === 'doctor') {
      setStage('doctor');
      if (doctorRows.length === 0) void runDoctor(false);
    } else if (id === 'agent') {
      void loadAgentStatus();
    } else if (id === 'updates') {
      void checkUpdates();
    }
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <AppIcon />
          </div>
          <div className="brand-text">
            <strong>BlackboardChina</strong>
            <span>Downloader</span>
          </div>
        </div>

        <nav className="rail-nav" aria-label="Primary">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`rail-item ${activeView === item.id ? 'is-active' : ''}`}
              aria-label={item.label}
              aria-current={activeView === item.id ? 'page' : undefined}
              title={item.hint}
              onClick={() => onNav(item.id)}
            >
              <span className="rail-icon">{item.icon}</span>
              <span className="rail-label">
                <span className="rail-title">{item.label}</span>
                <span className="rail-hint">{item.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="rail-version">v{version || '…'}</div>
          <div className="rail-paths">
            <button className="linklike" onClick={openDownloads} title={paths.downloads}>
              Downloads
            </button>
            <span className="sep">·</span>
            <button className="linklike" onClick={openLogs} title={paths.logs}>
              Logs
            </button>
          </div>
          <p className="rail-note">Educational use only. Use responsibly.</p>
        </div>
      </aside>

      <main className="stage">
        <header className="topbar">
          <div className="topbar-crumb">
            <h1>
              <Icon name={activeView === 'download' ? 'download' : activeView} size={24} />
              {navItems.find(n => n.id === activeView)?.label ?? 'Home'}
            </h1>
          </div>
          <div className="topbar-meta">
            <span className="pill pill-soft">{version || 'Loading…'}</span>
            {hasCredentials ? (
              <span className="pill pill-ok"><Icon name="shield" size={14} /> Credentials ready</span>
            ) : (
              <span className="pill pill-warn"><Icon name="key" size={14} /> Credentials needed</span>
            )}
          </div>
        </header>

        {status && (
          <div className="banner banner-info" role="status">
            <Icon name={isPreparingDownload ? 'cloud-download' : 'info'} size={17} />
            <span>{status}</span>
          </div>
        )}
        {errorMessage && (
          <div className="banner banner-error" role="alert">
            <Icon name="alert" size={17} />
            <span><strong className="banner-title">Something went wrong</strong>{errorMessage}</span>
          </div>
        )}

        {stage === 'welcome' && isPreparingDownload && (
          <section className="view download-launch" aria-live="polite">
            <div className="download-launch-card panel">
              <div className="launch-visual">
                <div className="launch-orbit">
                  <AppIcon />
                </div>
              </div>
              <div className="launch-copy">
                <span className="eyebrow"><span className="live-dot" /> Preparing download</span>
                <h2>Getting your workspace ready.</h2>
                <p>Connecting securely to Blackboard, then loading the courses available to you.</p>
              </div>
              <div className="launch-stages">
                <div className="launch-stage is-current">
                  <span className="launch-stage-icon"><Icon name="cloud-download" size={17} /></span>
                  <span><strong>Connect to Blackboard</strong><small>Opening the course workspace</small></span>
                  <span className="spinner" aria-label="Loading" />
                </div>
                <div className="launch-stage">
                  <span className="launch-stage-icon"><Icon name="book" size={17} /></span>
                  <span><strong>Discover courses</strong><small>Course choices will appear here next</small></span>
                </div>
                <div className="launch-stage">
                  <span className="launch-stage-icon"><Icon name="folder" size={17} /></span>
                  <span><strong>Choose files</strong><small>Review everything before saving</small></span>
                </div>
              </div>
            </div>
          </section>
        )}

        {stage === 'welcome' && !isPreparingDownload && (
          <section className="view">
            <div className="hero">
              <div className="hero-copy">
              <h2 className="hero-title">Pull your Blackboard files without the chaos.</h2>
              <p className="hero-lede">
                Sign in once, choose your courses and files, and save them to a tidy folder. Blackboard stays
                read-only.
              </p>
              <div className="hero-actions">
                <button className="btn-primary btn-lg" onClick={beginDownload}>
                  <Icon name="download" size={18} />
                  Start a download
                </button>
                <button className="btn-ghost" onClick={() => onNav('setup')}>
                  <Icon name="key" size={17} />
                  Configure credentials
                </button>
              </div>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="hero-art-ring" />
                <AppIcon />
                <span className="hero-art-pixel hero-art-pixel-a" />
                <span className="hero-art-pixel hero-art-pixel-b" />
              </div>
            </div>

            <div className="grid-cards">
              <button className="stat-card" onClick={() => onNav('doctor')}>
                <span className="stat-icon"><Icon name="diagnostics" size={20} /></span>
                <span className="stat-k">Environment</span>
                <span className="stat-v">Diagnostics</span>
                <span className="stat-d">Verify runtime, Chromium &amp; network.</span>
              </button>
              <button className="stat-card" onClick={() => onNav('agent')}>
                <span className="stat-icon"><Icon name="agent" size={20} /></span>
                <span className="stat-k">Agent export</span>
                <span className="stat-v">For AI tools</span>
                <span className="stat-d">Read-only instructions &amp; manifest.</span>
              </button>
              <button className="stat-card" onClick={() => onNav('updates')}>
                <span className="stat-icon"><Icon name="updates" size={20} /></span>
                <span className="stat-k">App</span>
                <span className="stat-v">Updates</span>
                <span className="stat-d">Keep the desktop app current.</span>
              </button>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3><Icon name="folder" size={19} /> Where things go</h3>
              </div>
              <dl className="kv">
                <div>
                  <dt><Icon name="download" size={14} /> Downloads</dt>
                  <dd className="mono">{paths.downloads || '…'}</dd>
                </div>
                <div>
                  <dt><Icon name="terminal" size={14} /> Logs</dt>
                  <dd className="mono">{paths.logs || '…'}</dd>
                </div>
                <div>
                  <dt><Icon name="file" size={14} /> Last summary</dt>
                  <dd className="mono">{paths.summary || '…'}</dd>
                </div>
              </dl>
              <p className="micro">Tip: disable your VPN before running a download, and keep this app to personal study use.</p>
            </div>
          </section>
        )}

        {stage === 'setup' && (
          <section className="view">
            <div className="panel">
              <div className="panel-head">
                <h3><Icon name="setup" size={19} /> Setup</h3>
                <p className="panel-sub">Stored locally on this machine. The password is kept in the OS secure store.</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span className="field-label"><Icon name="key" size={14} /> Blackboard username / G-number</span>
                  <input
                    value={config.username}
                    onChange={e => setConfig({ ...config, username: e.target.value })}
                    placeholder="g12345678"
                  />
                </label>
                <label className="field">
                  <span className="field-label"><Icon name="lock" size={14} /> Password</span>
                  <input
                    type="password"
                    value={config.password}
                    onChange={e => setConfig({ ...config, password: e.target.value })}
                    placeholder="Leave blank to keep saved password"
                  />
                </label>
                <label className="field field-wide">
                  <span className="field-label"><Icon name="folder" size={14} /> Download directory</span>
                  <input
                    value={config.downloadDir}
                    onChange={e => setConfig({ ...config, downloadDir: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field-label"><Icon name="monitor" size={14} /> Browser mode</span>
                  <select
                    value={config.headless ? 'headless' : 'visible'}
                    onChange={e => setConfig({ ...config, headless: e.target.value === 'headless' })}
                  >
                    <option value="headless">Headless</option>
                    <option value="visible">Visible</option>
                  </select>
                </label>
              </div>
              <div className="btn-row">
                <button className="btn-primary" onClick={() => saveSetup(false)}>
                  <Icon name="check" size={17} />
                  Save
                </button>
                <button className="btn-secondary" onClick={() => saveSetup(true)}>
                  <Icon name="shield" size={17} />
                  Save &amp; test login
                </button>
                <button className="btn-danger" onClick={resetSetup}>
                  <Icon name="refresh" size={17} />
                  Reset setup
                </button>
                <button className="btn-ghost" onClick={() => setStage('welcome')}>
                  <Icon name="back" size={17} />
                  Back
                </button>
              </div>
            </div>
          </section>
        )}

        {stage === 'doctor' && (
          <section className="view">
            <div className="panel">
              <div className="panel-head">
                <h3><Icon name="diagnostics" size={19} /> Diagnostics</h3>
                <p className="panel-sub">Checks the runtime, browser, saved credentials and reachability.</p>
              </div>
              <div className="btn-row">
                <button className="btn-primary" onClick={() => runDoctor(false)}>
                  <Icon name="scan" size={17} />
                  Run checks
                </button>
                <button className="btn-secondary" onClick={() => runDoctor(true)}>
                  <Icon name="shield" size={17} />
                  Run + login test
                </button>
                <button className="btn-ghost" onClick={() => setStage('welcome')}>
                  <Icon name="back" size={17} />
                  Back
                </button>
              </div>
              {doctorRows.length > 0 ? (
                <ul className="checks">
                  {doctorRows.map((r, i) => (
                    <li key={`${r.message}-${i}`} className={`check check-${r.status}`}>
                      <span className="check-dot" aria-hidden="true">
                        <Icon name={r.status === 'pass' ? 'check' : r.status === 'warn' ? 'warning' : 'x'} size={13} />
                      </span>
                      <span className="check-msg">{r.message}</span>
                      {r.required === false && <span className="check-optional">optional</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="micro">No checks run yet. Press “Run checks” above.</p>
              )}
            </div>
          </section>
        )}

        {stage === 'agent' && (
          <section className="view">
            <div className="panel">
              <div className="panel-head">
                <h3><Icon name="agent" size={19} /> Agent export</h3>
                <p className="panel-sub">
                  Read-only export for agent tools. It fetches instructions, assignments, announcements and
                  attachments — but never submits work or changes Blackboard.
                </p>
              </div>
              <div className="chips">
                <span className="chip">Ready: {agentInfo?.configured ? 'yes' : 'configure credentials first'}</span>
                <span className="chip">Workflow: {agentInfo?.busy ? 'busy' : 'idle'}</span>
              </div>
              <div className="btn-row">
                <button
                  className="btn-primary"
                  onClick={syncAgent}
                  disabled={Boolean(agentInfo?.busy) || !agentInfo?.configured}
                >
                  <Icon name="cloud-download" size={17} />
                  Export instructions
                </button>
                <button className="btn-secondary" onClick={loadAgentStatus}>
                  <Icon name="refresh" size={17} />
                  Refresh
                </button>
                <button className="btn-ghost" onClick={() => setStage('welcome')}>
                  <Icon name="back" size={17} />
                  Back
                </button>
              </div>
              {agentOutput && (
                <div className="code-block">
                  <pre>{JSON.stringify(agentOutput, null, 2)}</pre>
                </div>
              )}
              <p className="micro">
                MCP command: <code>BlackboardChina Downloader.exe --mcp</code> (installed) or{' '}
                <code>npm run mcp</code> (dev).
              </p>
            </div>
          </section>
        )}

        {stage === 'updates' && (
          <section className="view">
            <div className="panel">
              <div className="panel-head">
                <h3><Icon name="updates" size={19} /> Updates</h3>
              </div>
              <div className="chips">
                <span className="chip">Current: {version}</span>
                <span className="chip">Status: {String(updateState.status || 'idle')}</span>
                {updateState.version != null && <span className="chip">Available: {String(updateState.version)}</span>}
              </div>
              {updateState.message != null && <p>{String(updateState.message)}</p>}
              {updateState.notes != null && <div className="code-block"><pre>{String(updateState.notes)}</pre></div>}
              {updateState.status === 'downloading' && (
                <div className="progress">
                  <div className="progress-fill" style={{ transform: `scaleX(${Number(updateState.percent || 0) / 100})` }} />
                </div>
              )}
              <div className="btn-row">
                <button
                  className="btn-primary"
                  onClick={checkUpdates}
                  disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
                >
                  <Icon name="refresh" size={17} />
                  Check now
                </button>
                {updateState.status === 'available' && (
                  <button className="btn-secondary" onClick={downloadAppUpdate}>
                    <Icon name="download" size={17} />
                    Download update
                  </button>
                )}
                {updateState.status === 'ready' && (
                  <button className="btn-secondary" onClick={() => window.whiteboardGui.installUpdate()}>
                    <Icon name="updates" size={17} />
                    Restart &amp; install
                  </button>
                )}
                <button className="btn-ghost" onClick={() => setStage('welcome')}>
                  <Icon name="back" size={17} />
                  Back
                </button>
              </div>
            </div>
          </section>
        )}

        {(stage === 'courses' || stage === 'files' || stage === 'download' || stage === 'summary') && (
          <section className="view">
            <Stepper current={wizardStepIndex(stage)} />
            {stage === 'courses' && (
              <div className="panel">
                <div className="panel-head">
                  <h3><Icon name="book" size={19} /> Course selection</h3>
                  <div className="count-pills">
                    <span className="chip"><Icon name="book" size={14} /> Discovered: {courses.length}</span>
                    <span className="chip"><Icon name="check-square" size={14} /> Selected: {selectedCourseIds.size}</span>
                  </div>
                </div>
                <div className="toolbar">
                  <label className="search-field">
                    <Icon name="search" size={17} />
                    <input
                      className="search"
                      placeholder="Search courses"
                      value={courseSearch}
                      onChange={e => setCourseSearch(e.target.value)}
                    />
                  </label>
                  <div className="btn-row btn-row-inline">
                    <button
                      className="btn-secondary"
                      disabled={isScanningCourses}
                      onClick={() => setSelectedCourseIds(new Set(courses.map(c => c.id)))}
                    >
                      <Icon name="check-square" size={17} />
                      Select all
                    </button>
                    <button
                      className="btn-ghost"
                      disabled={isScanningCourses}
                      onClick={() => setSelectedCourseIds(new Set())}
                    >
                      <Icon name="x" size={17} />
                      Clear
                    </button>
                    <button
                      className="btn-primary"
                      disabled={selectedCourses.length === 0 || isScanningCourses}
                      onClick={runScanFiles}
                    >
                      <Icon name="scan" size={17} className={isScanningCourses ? 'is-spinning' : ''} />
                      {isScanningCourses ? 'Scanning…' : 'Scan selected'}
                    </button>
                  </div>
                </div>
                <div className={`list ${isScanningCourses ? 'is-busy' : ''}`}>
                  {visibleCourses.map(course => (
                    <label key={course.id} className="list-row">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.has(course.id)}
                        disabled={isScanningCourses}
                        onChange={e => {
                          const next = new Set(selectedCourseIds);
                          if (e.target.checked) next.add(course.id);
                          else next.delete(course.id);
                          setSelectedCourseIds(next);
                        }}
                      />
                      <span className="list-row-icon"><Icon name="book" size={16} /></span>
                      <span className="list-name">{course.name}</span>
                    </label>
                  ))}
                  {visibleCourses.length === 0 && !isScanningCourses && (
                    <div className="empty-state">
                      <Icon name="search-x" size={24} />
                      <strong>No courses found</strong>
                      <span>{courses.length ? 'Try a different search.' : 'Start a download to discover your courses.'}</span>
                    </div>
                  )}
                  {isScanningCourses && (
                    <div className="list-overlay">
                      <span className="spinner" />
                      <span>Scanning selected courses…</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {stage === 'files' && (
              <div className="panel">
                <div className="panel-head">
                  <h3><Icon name="file" size={19} /> File selection</h3>
                  <div className="count-pills">
                    <span className="chip"><Icon name="file" size={14} /> Discovered: {files.length}</span>
                    <span className="chip"><Icon name="check-square" size={14} /> Selected: {selectedFileUrls.size}</span>
                  </div>
                </div>
                <div className="toolbar">
                  <label className="search-field">
                    <Icon name="search" size={17} />
                    <input
                      className="search"
                      placeholder="Search files"
                      value={fileSearch}
                      onChange={e => setFileSearch(e.target.value)}
                    />
                  </label>
                  <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    <option value="all">All file types</option>
                    {fileTypes.map(t => (
                      <option key={t} value={t}>
                        {t.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div className="btn-row btn-row-inline">
                    <button className="btn-secondary" onClick={() => setSelectedFileUrls(new Set(files.map(f => f.url)))}>
                      <Icon name="check-square" size={17} />
                      Select all
                    </button>
                    <button className="btn-ghost" onClick={() => setSelectedFileUrls(new Set())}>
                      <Icon name="x" size={17} />
                      Clear
                    </button>
                    <button className="btn-primary" disabled={selectedFiles.length === 0} onClick={startDownload}>
                      <Icon name="download" size={17} />
                      Download {selectedFiles.length || ''}
                    </button>
                  </div>
                </div>
                <div className="table">
                  <div className="table-head">
                    <span />
                    <span><Icon name="file" size={13} /> Name</span>
                    <span><Icon name="sliders" size={13} /> Type</span>
                    <span><Icon name="hard-drive" size={13} /> Size</span>
                    <span><Icon name="book" size={13} /> Course / Section</span>
                    <span><Icon name="check-circle" size={13} /> State</span>
                  </div>
                  {selectableFiles.map(file => {
                    const isSelected = selectedFileUrls.has(file.url);
                    return (
                      <div
                        className={`table-row selectable ${isSelected ? 'is-on' : ''}`}
                        key={file.url}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => toggleFileSelection(file.url)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleFileSelection(file.url);
                          }
                        }}
                      >
                        <span>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleFileSelection(file.url)}
                          />
                        </span>
                        <span className="file-name"><Icon name="file" size={16} /><span className="ellipsis">{file.name}</span></span>
                        <span>{(file.fileType || '?').toUpperCase()}</span>
                        <span>{file.size ? formatBytes(file.size) : '?'}</span>
                        <span className="ellipsis">
                          {file.courseName} / {file.sectionName}
                        </span>
                        <span className={`tag ${isSelected ? 'tag-on' : 'tag-off'}`}>
                          <Icon name={isSelected ? 'check' : 'x'} size={13} />
                          {isSelected ? 'selected' : 'ignored'}
                        </span>
                      </div>
                    );
                  })}
                  {selectableFiles.length === 0 && (
                    <div className="empty-state">
                      <Icon name="search-x" size={24} />
                      <strong>No files found</strong>
                      <span>{files.length ? 'Try a different search or file type.' : 'Scan selected courses to find files.'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {stage === 'download' && (
              <div className="panel download-panel">
                <div className="download-header">
                  <div className="download-visual" aria-hidden="true">
                    <div className="download-orbit"><AppIcon /></div>
                  </div>
                  <div className="download-heading">
                    <span className="eyebrow"><span className="live-dot" /> Live transfer</span>
                    <h3><Icon name="cloud-download" size={20} /> Downloading your files</h3>
                    <p className="panel-sub">Blackboard is being read in the background while files arrive in your chosen folder.</p>
                  </div>
                  <div className="download-queue">
                    <strong>{selectedRunFileCount}</strong>
                    <span>files queued</span>
                  </div>
                </div>
                <div className="progress-area">
                  <div className="progress-caption">
                    <span>Overall progress</span>
                    {downloadState.totalKnownBytes > 0 ? (
                      <span className="mono">
                        {formatBytes(downloadState.downloadedBytes)} / {formatBytes(downloadState.totalKnownBytes)}
                      </span>
                    ) : (
                      <span className="mono">{countProgress}/{selectedRunFileCount} files</span>
                    )}
                  </div>
                  <div className="progress progress-lg">
                    <div className="progress-fill" style={{ transform: `scaleX(${progressPercent / 100})` }} />
                  </div>
                  <div className="progress-readout">
                    <span className="big">{progressPercent.toFixed(1)}%</span>
                    <span className="progress-state">{downloadState.failed ? `${downloadState.failed} failed` : 'Transfer in progress'}</span>
                  </div>
                </div>
                <div className="download-stats">
                  <div className="download-stat">
                    <span className="download-stat-icon"><Icon name="gauge" size={18} /></span>
                    <span><small>Speed</small><strong>{downloadState.speed > 0 ? `${formatBytes(downloadState.speed)}/s` : '?'}</strong></span>
                  </div>
                  <div className="download-stat">
                    <span className="download-stat-icon"><Icon name="clock" size={18} /></span>
                    <span><small>Estimated time</small><strong>{downloadState.speed > 0 && downloadState.totalKnownBytes > 0 ? eta(remainingKnownBytes / downloadState.speed) : '?'}</strong></span>
                  </div>
                  <div className="download-stat">
                    <span className="download-stat-icon"><Icon name="file" size={18} /></span>
                    <span><small>Unknown size</small><strong>{downloadState.unknownCount}</strong></span>
                  </div>
                </div>
                <div className="current-file">
                  <span className="current-file-icon"><Icon name="file" size={18} /></span>
                  <span className="current-file-label">Currently saving</span>
                  <span className="download-wave" aria-hidden="true"><i /><i /><i /><i /></span>
                  <span className="current-file-now"><span className="micro">Now</span><strong className="current-file-name">{downloadState.currentFile || '…'}</strong></span>
                </div>
                <div className="tallies">
                  <span className="tally tally-ok"><Icon name="check-circle" size={15} /> {downloadState.completed} done</span>
                  <span className="tally tally-skip"><Icon name="clock" size={15} /> {downloadState.skipped} skipped</span>
                  <span className="tally tally-fail"><Icon name="x-circle" size={15} /> {downloadState.failed} failed</span>
                </div>
                <div className="btn-row download-footer">
                  <button className="btn-ghost" onClick={openDownloads}>
                    <Icon name="folder" size={17} />
                    Open downloads
                  </button>
                  <button className="btn-ghost" onClick={openLogs}>
                    <Icon name="terminal" size={17} />
                    Open logs
                  </button>
                </div>
              </div>
            )}

            {stage === 'summary' && summary && (
              <div className="panel">
                <div className="panel-head">
                  <h3><Icon name="check-circle" size={19} /> Summary</h3>
                </div>
                <div className="tallies tallies-grid">
                  <span className="tally"><Icon name="book" size={15} /> Scanned: {summary.coursesSelected}</span>
                  <span className="tally"><Icon name="file" size={15} /> Found: {summary.filesDiscovered}</span>
                  <span className="tally tally-ok"><Icon name="check-circle" size={15} /> Downloaded: {summary.filesDownloaded}</span>
                  <span className="tally tally-skip"><Icon name="clock" size={15} /> Skipped: {summary.filesSkipped}</span>
                  <span className="tally tally-fail"><Icon name="x-circle" size={15} /> Failed: {summary.filesFailed}</span>
                </div>
                {summary.failedFiles.length > 0 && (
                  <ul className="checks">
                    {summary.failedFiles.map(f => (
                      <li key={`${f.name}-${f.reason}`} className="check check-fail">
                        <span className="check-dot" aria-hidden="true"><Icon name="x" size={13} /></span>
                        <span className="check-msg">
                          {f.name}: {f.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="btn-row">
                  <button className="btn-primary" onClick={beginDownload}>
                    <Icon name="refresh" size={17} />
                    Run again
                  </button>
                  <button className="btn-ghost" onClick={openDownloads}>
                    <Icon name="folder" size={17} />
                    Open downloads
                  </button>
                  <button className="btn-ghost" onClick={openLogs}>
                    <Icon name="terminal" size={17} />
                    Open logs
                  </button>
                  <button className="btn-ghost" onClick={() => setStage('welcome')}>
                    <Icon name="home" size={17} />
                    Home
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="Download progress">
      {WIZARD_STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <li key={label} className={`step step-${state}`}>
            <span className="step-dot">{i < current ? <Icon name="check" size={15} /> : i + 1}</span>
            <span className="step-label"><Icon name={WIZARD_ICONS[i]} size={14} /> {label}</span>
            {i < WIZARD_STEPS.length - 1 && <span className="step-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
