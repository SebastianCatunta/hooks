import { pool } from './pool.js';

export interface PublicUser { id: string; email: string; name: string }
export interface User extends PublicUser { passwordHash: string; createdAt: Date }
export interface Session {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  user: PublicUser;
}

const userColumns = 'id, email, name, password_hash AS "passwordHash", created_at AS "createdAt"';

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<User>(`SELECT ${userColumns} FROM users WHERE email = $1`, [email.trim().toLowerCase()]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<User>(`SELECT ${userColumns} FROM users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function createSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
}

export async function findSession(tokenHash: string): Promise<Session | null> {
  const result = await pool.query<Session>(`
    SELECT s.token_hash AS "tokenHash", s.user_id AS "userId", s.expires_at AS "expiresAt",
      s.created_at AS "createdAt", json_build_object('id', u.id, 'email', u.email, 'name', u.name) AS "user"
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`, [tokenHash]);
  return result.rows[0] ?? null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}
