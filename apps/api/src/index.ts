import { env } from './config/env.js';
import { buildServer } from './server.js';

async function start() {
  const ctx = await buildServer({ env });
  await ctx.app.listen({ host: env.API_HOST, port: env.API_PORT });
  ctx.app.log.info(`Hexa Maps API listening on http://${env.API_HOST}:${env.API_PORT}`);

  const shutdown = async (signal: string) => {
    ctx.app.log.info(`Received ${signal}, shutting down Hexa Maps API...`);
    await ctx.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('Failed to start Hexa Maps API:', err);
  process.exit(1);
});
