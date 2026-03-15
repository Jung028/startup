import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../config/logger';

export let db: Pool;

export async function connectDatabase(): Promise<void> {
  db = new Pool({ connectionString: config.db.url });
  
  try {
    await db.query('SELECT 1');
    logger.info('✅ PostgreSQL connected');
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const res = await db.query(text, params);
  const duration = Date.now() - start;
  logger.debug({ text, duration, rows: res.rowCount }, 'DB query executed');
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
