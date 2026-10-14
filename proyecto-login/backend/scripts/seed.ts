import 'dotenv/config';
import { seedUser } from '../src/db/seed.js';
import { closePool } from '../src/db/pool.js';

try {
  if (!process.env.SEED_PASSWORD) throw new Error('SEED_PASSWORD es obligatoria');
  const inserted = await seedUser(process.env.SEED_EMAIL ?? 'demo@example.com', process.env.SEED_PASSWORD, process.env.SEED_NAME ?? 'Usuario Demo');
  console.log(inserted ? 'Cuenta local creada' : 'Cuenta existente conservada');
} catch {
  console.error('No se pudo sembrar la cuenta local; revise configuración y migraciones');
  process.exitCode = 1;
} finally {
  await closePool();
}
