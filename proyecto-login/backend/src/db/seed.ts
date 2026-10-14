import { hash } from 'bcryptjs';
import { pool } from './pool.js';

export async function seedUser(email: string, password: string, name: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@') || normalized.length > 254 || !name.trim() || !password || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Configuración de semilla inválida');
  }
  const passwordHash = await hash(password, 12);
  const result = await pool.query(`INSERT INTO users (email, name, password_hash)
    VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`, [normalized, name.trim(), passwordHash]);
  return result.rowCount === 1;
}
