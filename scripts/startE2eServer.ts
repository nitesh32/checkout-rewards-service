import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildApp } from '../src/app.js';
import { createAppContext } from '../src/context.js';
import { seedProducts } from '../src/db/seed.js';

/** A throwaway backend (in-memory MongoDB, seeded, a coupon after every order) for browser tests. */
const port = Number(process.env['PORT'] ?? 3100);

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const context = await createAppContext({
  mongoUri: replSet.getUri(),
  dbName: 'e2e',
  rewards: { everyNOrders: 1, discountPercent: 10 },
});
await seedProducts(context.collections.products);

const app = await buildApp(context, { level: 'warn' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app
      .close()
      .then(() => context.client.close())
      .then(() => replSet.stop())
      .then(() => process.exit(0));
  });
}
await app.listen({ port, host: '127.0.0.1' });
console.log(`E2E backend listening on ${port}`);
