import { MongoServerError, type ClientSession, type MongoClient } from 'mongodb';

const DUPLICATE_KEY_ERROR_CODE = 11000;

export function isDuplicateKeyError(error: unknown): error is MongoServerError {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE;
}

/**
 * Runs `work` in a snapshot transaction. The driver re-runs the callback on transient errors
 * (including write conflicts between concurrent transactions), so `work` must be free of
 * side effects outside the session.
 */
export function withTransaction<T>(
  client: MongoClient,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  return client.withSession((session) =>
    session.withTransaction(() => work(session), {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    }),
  );
}
