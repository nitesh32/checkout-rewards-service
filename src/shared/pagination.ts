import { ObjectId, type Collection, type Filter, type WithId } from 'mongodb';
import { AppError } from './errors.js';

export interface PageRequest {
  limit: number;
  cursor?: string | undefined;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

function encodeCursor(id: ObjectId): string {
  return Buffer.from(id.toHexString()).toString('base64url');
}

function decodeCursor(cursor: string): ObjectId {
  const hex = Buffer.from(cursor, 'base64url').toString();
  if (!ObjectId.isValid(hex) || hex.length !== 24) {
    throw new AppError('INVALID_CURSOR', 'The pagination cursor is not valid');
  }
  return new ObjectId(hex);
}

/**
 * Keyset pagination on `_id`. ObjectIds are time-ordered, so pages stay stable while rows are
 * inserted concurrently (offset pagination would skip or repeat rows).
 */
export async function findPage<T extends { _id: ObjectId }>(
  collection: Collection<T>,
  filter: Filter<T>,
  { limit, cursor }: PageRequest,
  direction: 'asc' | 'desc' = 'asc',
): Promise<Page<WithId<T>>> {
  const operator = direction === 'asc' ? '$gt' : '$lt';
  const cursorFilter = cursor ? { _id: { [operator]: decodeCursor(cursor) } } : {};
  const docs = await collection
    .find({ $and: [filter, cursorFilter] } as Filter<T>)
    .sort({ _id: direction === 'asc' ? 1 : -1 })
    .limit(limit + 1)
    .toArray();

  const data = docs.slice(0, limit);
  const lastDoc = data.at(-1);
  const nextCursor = docs.length > limit && lastDoc ? encodeCursor(lastDoc._id) : null;
  return { data, nextCursor };
}
