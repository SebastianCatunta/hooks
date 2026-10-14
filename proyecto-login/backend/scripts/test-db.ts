import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { compare, getRounds } from 'bcryptjs';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria');
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const schema = `db_test_${randomUUID().replaceAll('-', '')}`;
await admin.query(`CREATE SCHEMA ${schema}`);
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool, closePool } = await import('../src/db/pool.js');
const repository = await import('../src/db/repository.js');
const { seedUser } = await import('../src/db/seed.js');
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(new URL('../migrations/001_auth.sql', import.meta.url), 'utf8'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  const password = randomBytes(24).toString('base64url');
  assert.equal(await seedUser(' TEST@example.com ', password, 'Test'), true);
  assert.equal(await seedUser('test@example.com', randomBytes(24).toString('hex'), 'Changed'), false);
  const user = await repository.findUserByEmail(' TEST@example.com ');
  assert.ok(user);
  assert.equal(user.name, 'Test');
  assert.equal(getRounds(user.passwordHash), 12);
  assert.equal(await compare(password, user.passwordHash), true);
  assert.deepEqual(await repository.findUserById(user.id), user);
  assert.equal(await repository.findUserById(randomUUID()), null);
  await assert.rejects(pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)', [user.email, 'Test', user.passwordHash]), { code: '23505' });
  await assert.rejects(pool.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)', [' Upper@example.com ', 'Test', user.passwordHash]), { code: '23514' });
  await assert.rejects(repository.createSession('raw-token', user.id, new Date(Date.now() + 3600000)), { code: '23514' });
  const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
  await assert.rejects(repository.createSession(tokenHash, randomUUID(), new Date(Date.now() + 3600000)), { code: '23503' });
  await repository.createSession(tokenHash, user.id, new Date(Date.now() + 8 * 3600000));
  const session = await repository.findSession(tokenHash);
  assert.ok(session);
  assert.deepEqual(Object.keys(session.user).sort(), ['email', 'id', 'name']);
  await assert.rejects(repository.createSession(tokenHash, user.id, new Date(Date.now() + 3600000)), { code: '23505' });
  await repository.deleteSession(tokenHash);
  await repository.deleteSession(tokenHash);
  assert.equal(await repository.findSession(tokenHash), null);
  await pool.query(`INSERT INTO sessions(token_hash,user_id,created_at,expires_at)
    VALUES($1,$2,CURRENT_TIMESTAMP - INTERVAL '9 hours',CURRENT_TIMESTAMP - INTERVAL '1 hour')`, [tokenHash, user.id]);
  assert.equal(await repository.findSession(tokenHash), null);
  await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
  assert.equal((await pool.query('SELECT * FROM sessions')).rowCount, 0);
  console.log('BD: migración transaccional, semilla idempotente, bcrypt12, restricciones, repositorio, expiración, revocación y cascada OK');
} finally {
  await closePool();
  // Only remove the uniquely named schema created by this test, never existing data.
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
