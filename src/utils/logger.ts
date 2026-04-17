import winston from 'winston';
import path from 'path';
import fs from 'fs';

/** Maximum size per log file before rotating. */
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
/** Number of rotated log files to keep. */
const MAX_LOG_FILES = 3;

/**
 * Minimal console-only logger used before `initLogger()` is called.
 * This prevents a hard throw if any module emits a log at import time or
 * before the `WhiteboardDownloader` constructor runs.
 */
let logger: winston.Logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}]: ${message}`)
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Initialize logger with configuration.
 * The file transport uses built-in size-based rotation so that
 * `whiteboard.log` doesn't grow indefinitely.
 */
export function initLogger(logLevel: string, logFile: string): winston.Logger {
  // Ensure log directory exists
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    transports: [
      // Console transport with colorization
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
          })
        ),
      }),
      // File transport with size-based rotation
      new winston.transports.File({
        filename: logFile,
        maxsize: MAX_LOG_SIZE_BYTES,
        maxFiles: MAX_LOG_FILES,
        tailable: true,
        format: winston.format.combine(
          winston.format.uncolorize(),
          winston.format.json()
        ),
      }),
    ],
  });

  return logger;
}

/**
 * Get the logger instance.
 * Always returns a valid logger — a minimal console logger is used until
 * `initLogger()` replaces it with the fully configured one.
 */
export function getLogger(): winston.Logger {
  return logger;
}

/**
 * Utility functions for common logging patterns
 */
export const log = {
  debug: (message: string, meta?: any) => getLogger().debug(message, meta),
  info: (message: string, meta?: any) => getLogger().info(message, meta),
  warn: (message: string, meta?: any) => getLogger().warn(message, meta),
  error: (message: string, meta?: any) => getLogger().error(message, meta),
};
