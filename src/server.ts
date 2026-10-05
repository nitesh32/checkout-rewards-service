import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createAppContext } from './context.js';
import { seedProducts } from './db/seed.js';

const config = loadConfig();
const context = await createAppContext(config);
await seedProducts(context.collections.products);

const app = await buildApp(context, { level: 'info' });
app.addHook('onClose', () => context.client.close());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close());
}

await app.listen({ port: config.port, host: '0.0.0.0' });
