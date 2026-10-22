import { env } from '../config/env.js';
import { createDatabaseContext } from './client.js';

async function main() {
  const ctx = await createDatabaseContext({ env });
  console.log(
    JSON.stringify({
      status: 'migrated',
      engine: ctx.engine,
      hasPostgis: ctx.hasPostgis,
    }),
  );
  await ctx.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
