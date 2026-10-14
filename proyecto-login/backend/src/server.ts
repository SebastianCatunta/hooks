import { createApp } from './app.js';
import { config } from './config.js';
import * as repository from './db/repository.js';
import { closePool } from './db/pool.js';

const server = createApp(repository).listen(config.PORT, () => {
  console.info(`Backend listening on port ${config.PORT}`);
});

// Drain HTTP requests before closing the shared PostgreSQL pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => { void closePool().then(() => process.exit(0), () => process.exit(1)); });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
