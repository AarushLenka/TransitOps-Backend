// Entry point. Loads + validates env FIRST, then starts the HTTP server.
import './config/env.js';
import app from './app.js';
import { config } from './config/env.js';
import { disconnectPrisma } from './lib/prisma.js';

const server = app.listen(config.port, () => {
  console.log(`\n  TransitOps API listening on http://localhost:${config.port}  [${config.nodeEnv}]\n`);
});

const shutdown = async (signal) => {
  console.log(`\n${signal} received — shutting down...`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  // Force exit if the server won't close within 10s.
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
