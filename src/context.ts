import { MongoClient } from 'mongodb';
import type { RewardsConfig } from './config.js';
import { getCollections, type Collections } from './db/collections.js';
import { setupDatabase } from './db/setup.js';
import { FakePaymentProvider, type PaymentProvider } from './modules/checkout/payment.js';

/** Everything the services need; passed explicitly so tests can build isolated instances. */
export interface AppContext {
  client: MongoClient;
  collections: Collections;
  rewards: RewardsConfig;
  paymentProvider: PaymentProvider;
}

export interface AppContextOptions {
  mongoUri: string;
  dbName: string;
  rewards: RewardsConfig;
  paymentProvider?: PaymentProvider;
}

export async function createAppContext(options: AppContextOptions): Promise<AppContext> {
  const client = await MongoClient.connect(options.mongoUri);
  const db = client.db(options.dbName);
  const collections = getCollections(db);
  await setupDatabase(db, collections);
  return {
    client,
    collections,
    rewards: options.rewards,
    paymentProvider: options.paymentProvider ?? new FakePaymentProvider(),
  };
}
