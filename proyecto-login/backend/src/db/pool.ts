import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria');

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Do not log connection details or query parameters.
pool.on('error', () => console.error('Error de conexión PostgreSQL inactiva'));

export async function closePool(): Promise<void> {
  await pool.end();
}
