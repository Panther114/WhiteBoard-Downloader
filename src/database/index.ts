import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DatabaseRecord } from '../types';
import { log } from '../utils/logger';

export class DownloadDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    // WAL mode gives better concurrent-read performance (many parallel downloads)
    this.db.pragma('journal_mode = WAL');
    this.initTables();
    log.info(`Database initialized at ${dbPath}`);
  }

  /**
   * Initialize database tables
   */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        path TEXT NOT NULL,
        filename TEXT NOT NULL,
        status TEXT NOT NULL,
        size INTEGER,
        downloaded_at DATETIME,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_url ON downloads(url);
      CREATE INDEX IF NOT EXISTS idx_status ON downloads(status);
    `);
  }

  /**
   * Check if URL has been downloaded
   */
  isDownloaded(url: string): boolean {
    const stmt = this.db.prepare('SELECT status FROM downloads WHERE url = ? AND status = ?');
    const result = stmt.get(url, 'completed');
    return !!result;
  }

  /**
   * Add or update download record
   */
  upsertDownload(record: DatabaseRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO downloads (url, path, filename, status, size, downloaded_at, error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        path = excluded.path,
        filename = excluded.filename,
        status = excluded.status,
        size = excluded.size,
        downloaded_at = excluded.downloaded_at,
        error = excluded.error,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      record.url,
      record.path,
      record.filename,
      record.status,
      record.size || null,
      record.downloadedAt ? record.downloadedAt.toISOString() : null,
      record.error || null
    );
  }

  /**
   * Get download record by URL
   */
  getDownload(url: string): DatabaseRecord | null {
    const stmt = this.db.prepare('SELECT * FROM downloads WHERE url = ?');
    const row: any = stmt.get(url);

    if (!row) return null;

    return {
      id: row.id,
      url: row.url,
      path: row.path,
      filename: row.filename,
      status: row.status,
      size: row.size,
      downloadedAt: row.downloaded_at ? new Date(row.downloaded_at) : undefined,
      error: row.error,
    };
  }

  /**
   * Get all downloads with specific status
   */
  getDownloadsByStatus(status: string): DatabaseRecord[] {
    const stmt = this.db.prepare('SELECT * FROM downloads WHERE status = ?');
    const rows: any[] = stmt.all(status);

    return rows.map(row => ({
      id: row.id,
      url: row.url,
      path: row.path,
      filename: row.filename,
      status: row.status,
      size: row.size,
      downloadedAt: row.downloaded_at ? new Date(row.downloaded_at) : undefined,
      error: row.error,
    }));
  }

  /**
   * Get download statistics
   */
  getStats(): { total: number; completed: number; failed: number; pending: number } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM downloads
    `);

    const result: any = stmt.get();
    return {
      total: result.total || 0,
      completed: result.completed || 0,
      failed: result.failed || 0,
      pending: result.pending || 0,
    };
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.db.exec('DELETE FROM downloads');
    log.info('Database cleared');
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    log.info('Database connection closed');
  }
}
