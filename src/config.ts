export interface RewardsConfig {
  /** Every Nth successfully placed order unlocks one coupon. */
  everyNOrders: number;
  /** Percentage taken off the subtotal by a generated coupon. */
  discountPercent: number;
  /**
   * When true, an order that reaches a milestone creates the reward straight away. When false
   * (the default) rewards are only created when an administrator requests them.
   */
  autoGenerate?: boolean;
}

export interface Config {
  port: number;
  mongoUri: string;
  dbName: string;
  rewards: RewardsConfig;
}

const DB_NAME = 'checkout_rewards';

function readInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, received "${raw}"`);
  }
  return value;
}

function readBoolean(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be "true" or "false", received "${raw}"`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: readInteger(env, 'PORT', 3000, { min: 1, max: 65535 }),
    mongoUri: env['MONGO_URI'] ?? 'mongodb://localhost:27017/?directConnection=true',
    dbName: DB_NAME,
    rewards: {
      everyNOrders: readInteger(env, 'REWARD_EVERY_N_ORDERS', 5, { min: 1, max: 1_000_000 }),
      discountPercent: readInteger(env, 'REWARD_DISCOUNT_PERCENT', 10, { min: 1, max: 100 }),
      autoGenerate: readBoolean(env, 'REWARD_AUTO_GENERATE', false),
    },
  };
}
