import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}

/** One real single-node replica set for the whole run, so tests exercise real transactions. */
export default async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide('mongoUri', replSet.getUri());
  return () => replSet.stop();
}
