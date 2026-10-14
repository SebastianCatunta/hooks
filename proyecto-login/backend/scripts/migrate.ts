import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pool, closePool } from '../src/db/pool.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(731642019)");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(file => /^\d+.*\.sql$/.test(file)).sort();
  for (const file of files) {
    const sql = await readFile(new URL(file, directory), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE version = $1', [file]);
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) throw new Error('Una migración aplicada fue modificada');
      continue;
    }
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
    console.log(`Migración aplicada: ${file}`);
  }
  await client.query('COMMIT');
  console.log('Migraciones verificadas');
} catch {
  await client.query('ROLLBACK');
  console.error('No se pudieron aplicar las migraciones; transacción revertida');
  process.exitCode = 1;
} finally {
  client.release();
  await closePool();
}
