import React, { useEffect, useMemo, useState } from 'react';

type Stage = 'welcome' | 'setup' | 'doctor' | 'courses' | 'files' | 'download' | 'summary';
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

export function App() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [config, setConfig] = useState({
    username: '',
    password: '',
    downloadDir: './downloads',
    headless: true,
    includeNonSubjectCourses: true,
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
  const [knownByUrl, setKnownByUrl] = useState<Map<string, number>>(new Map());
  const [perUrlDownloaded, setPerUrlDownloaded] = useState<Map<string, number>>(new Map());
  const [speedWindow, setSpeedWindow] = useState({ lastTs: Date.now(), bytes: 0 });

  useEffect(() => {
    (async () => {
      setVersion(await window.whiteboardGui.getVersion());
      const cfg = (await window.whiteboardGui.loadConfig()) as Record<string, unknown>;
      setConfig(prev => ({
        ...prev,
        username: String(cfg.username || ''),
        downloadDir: String(cfg.downloadDir || './downloads'),
        headless: Boolean(cfg.headless ?? true),
        includeNonSubjectCourses: Boolean(cfg.includeNonSubjectCourses ?? true),
      }));
      setPaths(await window.whiteboardGui.getPaths());
    })();
  }, []);

  useEffect(() => {
    const unsub = window.whiteboardGui.onWorkflowEvent(evt => {
      if (evt.type === 'download:start') {
        const payload = evt.payload as { name: string; url: string };
        setDownloadState(s => ({ ...s, currentFile: payload.name }));
      }
      if (evt.type === 'download:progress') {
        const payload = evt.payload as { url: string; downloaded: number };
        setPerUrlDownloaded(prev => {
          const next = new Map(prev);
          const old = next.get(payload.url) || 0;
          if (payload.downloaded > old) {
            const delta = payload.downloaded - old;
            setDownloadState(s => ({ ...s, downloadedBytes: s.downloadedBytes + delta }));
            setSpeedWindow(w => ({ ...w, bytes: w.bytes + delta }));
            next.set(payload.url, payload.downloaded);
          }
          return next;
        });
      }
      if (evt.type === 'download:complete') {
        setDownloadState(s => ({ ...s, completed: s.completed + 1 }));
      }
      if (evt.type === 'download:error') {
        setDownloadState(s => ({ ...s, failed: s.failed + 1 }));
      }
      if (evt.type === 'download:skip') {
        setDownloadState(s => ({ ...s, skipped: s.skipped + 1 }));
      }
      if (evt.type === 'summary:ready') {
        setSummary(evt.payload as Summary);
      }
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
      : selectedFiles.length > 0
        ? ((downloadState.completed + downloadState.skipped) / selectedFiles.length) * 100
        : 0;

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

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
    await runWithUiError(async () => {
      setStatus('Logging in and discovering courses...');
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
  }

  async function runScanFiles() {
    await runWithUiError(async () => {
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
      const totalKnownBytes = Array.from(known.values()).reduce((a, b) => a + b, 0);
      setDownloadState({
        completed: 0,
        failed: 0,
        skipped: result.skippedOnDisk || 0,
        downloadedBytes: 0,
        totalKnownBytes,
        unknownCount: result.files.length - known.size,
        speed: 0,
        currentFile: '',
      });
      setPerUrlDownloaded(new Map());
      setStage('files');
      setStatus('');
    });
  }

  async function startDownload() {
    await runWithUiError(async () => {
      setStatus('Downloading selected files...');
      setStage('download');
      const result = (await window.whiteboardGui.downloadFiles(selectedFiles)) as Summary;
      setSummary(result);
      setStatus('');
      setStage('summary');
    });
  }

  async function saveSetup(testLogin: boolean) {
    await runWithUiError(async () => {
      setStatus(testLogin ? 'Saving setup and testing login...' : 'Saving setup...');
      await window.whiteboardGui.saveSetup({ ...config, testLogin });
      setStatus('Setup saved.');
      setStage('welcome');
    });
  }

  async function resetSetup() {
    await runWithUiError(async () => {
      await window.whiteboardGui.resetSetup();
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

  const fileTypes = Array.from(new Set(files.map(f => (f.fileType || '').toLowerCase()).filter(Boolean)));

  return (
    <div className="app">
      <header className="hero">
        <h1>WhiteBoard Downloader</h1>
        <div>Version {version}</div>
      </header>
      {status && <div className="status">{status}</div>}
      {errorMessage && <div className="status" style={{ borderLeftColor: '#d9534f' }}>{errorMessage}</div>}

      {stage === 'welcome' && (
        <section className="card">
          <p>Download Blackboard course files with full course and file selection.</p>
          <div className="row">
            <button onClick={startFlow}>Start</button>
            <button onClick={() => setStage('setup')}>Setup / Change Credentials</button>
            <button onClick={() => setStage('doctor')}>Doctor / Check Environment</button>
          </div>
          <div className="row">
            <button onClick={openDownloads}>Open Downloads Folder</button>
            <button onClick={openLogs}>Open Logs Folder</button>
          </div>
          <small>Downloads: {paths.downloads}</small>
          <small>Logs: {paths.logs}</small>
        </section>
      )}

      {stage === 'setup' && (
        <section className="card">
          <h2>Setup</h2>
          <label>
            Blackboard username / G-number
            <input value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })} />
          </label>
          <label>
            Blackboard password (leave blank to keep saved password)
            <input
              type="password"
              value={config.password}
              onChange={e => setConfig({ ...config, password: e.target.value })}
            />
          </label>
          <label>
            Download directory
            <input
              value={config.downloadDir}
              onChange={e => setConfig({ ...config, downloadDir: e.target.value })}
            />
          </label>
          <label>
            Browser mode
            <select
              value={config.headless ? 'headless' : 'visible'}
              onChange={e => setConfig({ ...config, headless: e.target.value === 'headless' })}
            >
              <option value="headless">Headless</option>
              <option value="visible">Visible</option>
            </select>
          </label>
          <label className="inline">
            <input
              type="checkbox"
              checked={config.includeNonSubjectCourses}
              onChange={e => setConfig({ ...config, includeNonSubjectCourses: e.target.checked })}
            />
            Include organization/non-subject courses in advanced CLI filtering
          </label>
          <div className="row">
            <button onClick={() => saveSetup(false)}>Save</button>
            <button onClick={() => saveSetup(true)}>Save and Test Login</button>
            <button onClick={resetSetup}>Reset Setup</button>
            <button onClick={() => setStage('welcome')}>Back</button>
          </div>
        </section>
      )}

      {stage === 'doctor' && (
        <section className="card">
          <h2>Doctor</h2>
          <div className="row">
            <button onClick={() => runDoctor(false)}>Run Checks</button>
            <button onClick={() => runDoctor(true)}>Run Checks + Login Test</button>
            <button onClick={() => setStage('welcome')}>Back</button>
          </div>
          <ul className="doctor-list">
            {doctorRows.map((r, i) => (
              <li key={`${r.message}-${i}`} className={`doctor-${r.status}`}>
                <strong>{r.status.toUpperCase()}</strong> {r.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {stage === 'courses' && (
        <section className="card">
          <h2>Course Selection</h2>
          <div>Discovered: {courses.length} | Selected: {selectedCourseIds.size}</div>
          <input
            placeholder="Search courses (display-only)"
            value={courseSearch}
            onChange={e => setCourseSearch(e.target.value)}
          />
          <div className="row">
            <button onClick={() => setSelectedCourseIds(new Set(courses.map(c => c.id)))}>Select all</button>
            <button onClick={() => setSelectedCourseIds(new Set())}>Clear all</button>
            <button disabled={selectedCourses.length === 0} onClick={runScanFiles}>
              Scan selected courses
            </button>
            <button onClick={() => setStage('welcome')}>Back</button>
          </div>
          <div className="list">
            {visibleCourses.map(course => (
              <label key={course.id} className="item">
                <input
                  type="checkbox"
                  checked={selectedCourseIds.has(course.id)}
                  onChange={e => {
                    const next = new Set(selectedCourseIds);
                    if (e.target.checked) next.add(course.id);
                    else next.delete(course.id);
                    setSelectedCourseIds(next);
                  }}
                />
                {course.name}
              </label>
            ))}
          </div>
        </section>
      )}

      {stage === 'files' && (
        <section className="card">
          <h2>File Selection</h2>
          <div>Discovered: {files.length} | Selected: {selectedFileUrls.size}</div>
          <div className="row">
            <input placeholder="Search files" value={fileSearch} onChange={e => setFileSearch(e.target.value)} />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All file types</option>
              {fileTypes.map(t => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <button onClick={() => setSelectedFileUrls(new Set(files.map(f => f.url)))}>Select all</button>
            <button onClick={() => setSelectedFileUrls(new Set())}>Clear all</button>
            <button disabled={selectedFiles.length === 0} onClick={startDownload}>
              Download selected files
            </button>
            <button onClick={() => setStage('courses')}>Back</button>
          </div>
          <div className="table">
            <div className="table-head">
              <span />
              <span>Name</span>
              <span>Type</span>
              <span>Size</span>
              <span>Course / Section</span>
              <span>Status</span>
            </div>
            {selectableFiles.map(file => (
              <div className="table-row" key={file.url}>
                <span>
                  <input
                    type="checkbox"
                    checked={selectedFileUrls.has(file.url)}
                    onChange={e => {
                      const next = new Set(selectedFileUrls);
                      if (e.target.checked) next.add(file.url);
                      else next.delete(file.url);
                      setSelectedFileUrls(next);
                    }}
                  />
                </span>
                <span>{file.name}</span>
                <span>{(file.fileType || '?').toUpperCase()}</span>
                <span>{file.size ? formatBytes(file.size) : '?'}</span>
                <span>
                  {file.courseName} / {file.sectionName}
                </span>
                <span>new</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stage === 'download' && (
        <section className="card">
          <h2>Download Progress</h2>
          <div className="progress-wrap">
            <div className="progress" style={{ width: `${progressPercent}%` }} />
          </div>
          <div>{progressPercent.toFixed(1)}%</div>
          <div>
            {formatBytes(downloadState.downloadedBytes)} /{' '}
            {downloadState.totalKnownBytes > 0 ? formatBytes(downloadState.totalKnownBytes) : 'file-count'}
          </div>
          <div>
            Completed: {downloadState.completed}/{selectedFiles.length} | Failed: {downloadState.failed} | Skipped:{' '}
            {downloadState.skipped}
          </div>
          <div>Unknown-size file count: {downloadState.unknownCount}</div>
          <div>Speed: {downloadState.speed > 0 ? `${formatBytes(downloadState.speed)}/s` : '?'}</div>
          <div>
            ETA:{' '}
            {downloadState.speed > 0 && downloadState.totalKnownBytes > 0
              ? eta((downloadState.totalKnownBytes - downloadState.downloadedBytes) / downloadState.speed)
              : '?'}
          </div>
          <div>Current file: {downloadState.currentFile || '...'}</div>
          <div className="row">
            <button onClick={openDownloads}>Open downloads folder</button>
            <button onClick={openLogs}>Open logs folder</button>
          </div>
        </section>
      )}

      {stage === 'summary' && summary && (
        <section className="card">
          <h2>Summary</h2>
          <div>Courses scanned: {summary.coursesSelected}</div>
          <div>Files discovered: {summary.filesDiscovered}</div>
          <div>Files downloaded: {summary.filesDownloaded}</div>
          <div>Files skipped: {summary.filesSkipped}</div>
          <div>Files failed: {summary.filesFailed}</div>
          {summary.failedFiles.length > 0 && (
            <ul>
              {summary.failedFiles.map(f => (
                <li key={`${f.name}-${f.reason}`}>
                  {f.name}: {f.reason}
                </li>
              ))}
            </ul>
          )}
          <small>Latest summary: {paths.summary}</small>
          <small>Downloads: {paths.downloads}</small>
          <div className="row">
            <button onClick={startFlow}>Run again</button>
            <button onClick={openDownloads}>Open downloads</button>
            <button onClick={openLogs}>Open logs</button>
            <button onClick={() => setStage('welcome')}>Back to welcome</button>
          </div>
        </section>
      )}
    </div>
  );
}
