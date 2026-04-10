/**
 * Child-process launcher that prevents double-timestamping in log output.
 *
 * Fix 5: When an external tool (e.g. an AI document-processing pipeline)
 * writes pre-formatted log lines to its stdout/stderr — lines that already
 * contain their own timestamp and level, e.g.:
 *
 *   2026-04-10 16:06:24 [WARNING] Discovery attempt 1 failed …
 *
 * — and those lines are then captured and re-logged through this project's
 * Winston logger, the result is the double-timestamp seen in the reported
 * errors:
 *
 *   2026-04-10 16:06:24 16:06:24 [WARNING] Discovery attempt 1 failed …
 *
 * This module provides `spawnWithLogging()` as a drop-in replacement for
 * `child_process.spawn` that:
 *   1. Pipes stdout/stderr of the child process line-by-line.
 *   2. Strips any embedded timestamp prefix from each line before forwarding.
 *   3. Prefixes every line with `[AI-PROCESSOR]` so the origin is visible.
 *   4. Maps common child-process log levels (WARNING, ERROR, INFO, DEBUG) to
 *      the corresponding Winston log level so severity is preserved.
 */

import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import { log } from './logger';

/**
 * Regex that matches the leading timestamp patterns emitted by common logging
 * frameworks, e.g.:
 *   "2026-04-10 16:06:24 [WARNING] …"
 *   "16:06:24 [WARNING] …"
 *   "2026-04-10T16:06:24.123Z [WARNING] …"
 */
const EMBEDDED_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?Z?\s*/;

/**
 * Regex that matches an embedded log level token (case-insensitive).
 * Used to pick the right Winston method for the forwarded line.
 */
const LOG_LEVEL_RE = /\[\s*(DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL)\s*\]/i;

/**
 * Strip leading timestamp from a single log line.
 */
export function stripTimestampPrefix(line: string): string {
  return line.replace(EMBEDDED_TIMESTAMP_RE, '');
}

/**
 * Map a child-process log-level string to a Winston log method name.
 */
function mapLevel(raw: string): 'debug' | 'info' | 'warn' | 'error' {
  switch (raw.toUpperCase()) {
    case 'DEBUG':
      return 'debug';
    case 'WARNING':
    case 'WARN':
      return 'warn';
    case 'ERROR':
    case 'CRITICAL':
      return 'error';
    default:
      return 'info';
  }
}

/**
 * Convert a stream of incoming bytes into individual text lines, invoking
 * `onLine` for each complete line.  Handles partial chunks across calls.
 */
function makeLineBuffer(onLine: (line: string) => void): (chunk: Buffer | string) => void {
  let pending = '';
  return (chunk: Buffer | string) => {
    pending += chunk.toString();
    const parts = pending.split('\n');
    // Last element is an incomplete line — keep it in the buffer.
    pending = parts.pop() ?? '';
    for (const line of parts) {
      if (line.trim()) onLine(line);
    }
  };
}

/**
 * Spawn a child process and forward its stdout/stderr through Winston,
 * stripping any embedded timestamp so the parent logger adds its own.
 *
 * @param command  Executable to run.
 * @param args     Argument list.
 * @param options  Standard `SpawnOptions` (stdio defaults to `['inherit', 'pipe', 'pipe']`).
 * @returns        The `ChildProcess` handle.
 */
export function spawnWithLogging(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): ChildProcess {
  const mergedOptions: SpawnOptions = {
    ...options,
    stdio: ['inherit', 'pipe', 'pipe'],
  };

  log.debug(`[AI-PROCESSOR] Spawning: ${command} ${args.join(' ')}`);

  const child = spawn(command, args, mergedOptions);

  const forwardLine = (line: string) => {
    const stripped = stripTimestampPrefix(line).trim();
    if (!stripped) return;

    const levelMatch = stripped.match(LOG_LEVEL_RE);
    const level = levelMatch ? mapLevel(levelMatch[1]) : 'info';
    const message = `[AI-PROCESSOR] ${stripped}`;

    log[level](message);
  };

  const stdoutBuffer = makeLineBuffer(forwardLine);
  const stderrBuffer = makeLineBuffer(forwardLine);

  child.stdout?.on('data', stdoutBuffer);
  child.stderr?.on('data', stderrBuffer);

  child.on('error', (err: Error) => {
    log.error(`[AI-PROCESSOR] Child process error: ${err.message}`);
  });

  child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
    if (code === 0) {
      log.debug(`[AI-PROCESSOR] Process exited cleanly (code 0)`);
    } else {
      log.warn(
        `[AI-PROCESSOR] Process exited with code ${code ?? 'null'}` +
          (signal ? `, signal ${signal}` : '')
      );
    }
  });

  return child;
}
