import { writeFile } from 'node:fs/promises';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildApp } from '../src/app.js';
import { createAppContext } from '../src/context.js';

/** Writes the live OpenAPI document that the web client's types are generated from. */
const outputPath = process.argv[2] ?? 'client/openapi.json';

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const context = await createAppContext({
  mongoUri: replSet.getUri(),
  dbName: 'openapi_export',
  rewards: { everyNOrders: 5, discountPercent: 10 },
});
const app = await buildApp(context);
await app.ready();

await writeFile(outputPath, `${JSON.stringify(app.swagger(), null, 2)}\n`);
console.log(`OpenAPI document written to ${outputPath}`);

await app.close();
await context.client.close();
await replSet.stop();
