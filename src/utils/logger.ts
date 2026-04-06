import winston from 'winston';
import path from 'path';
import fs from 'fs';

let logger: winston.Logger;

/**
 * Initialize logger with configuration
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
      // File transport
      new winston.transports.File({
        filename: logFile,
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
 * Get the logger instance
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
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
