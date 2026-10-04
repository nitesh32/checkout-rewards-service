import { randomInt } from 'node:crypto';
import type { Filter } from 'mongodb';
import type { AppContext } from '../../context.js';
import type { CouponDoc } from '../../db/collections.js';
import { isDuplicateKeyError } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { findPage, type Page } from '../../shared/pagination.js';
import type { CouponDto, ListCouponsQuery } from './schemas.js';

/** No 0/O/1/I so codes can be read aloud or typed without ambiguity. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCouponCode(): string {
  const characters = Array.from({ length: CODE_LENGTH }, () =>
    CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length)),
  );
  return `SAVE-${characters.join('')}`;
}

function toCouponDto(coupon: CouponDoc): CouponDto {
  return {
    id: coupon._id.toHexString(),
    code: coupon.code,
    percentOff: coupon.percentOff,
    milestone: coupon.milestone,
    status: coupon.status,
    redeemedByOrderId: coupon.redeemedByOrderId?.toHexString() ?? null,
    generatedAt: coupon.generatedAt.toISOString(),
    redeemedAt: coupon.redeemedAt?.toISOString() ?? null,
  };
}

/**
 * Generates the coupon for the earliest milestone that has been reached but not yet rewarded.
 * Milestone k is reached once `placedOrders >= k * n`. The unique index on `milestone` makes
 * concurrent generation safe: the loser re-reads and either takes the next milestone or is told
 * none is eligible. Reading a slightly stale order count only ever under-grants.
 */
export async function generateCoupon({ collections, rewards }: AppContext): Promise<CouponDto> {
  // Terminates: each duplicate-key failure means another request created a coupon, so the
  // latest milestone strictly advances on every retry.
  for (;;) {
    const counter = await collections.counters.findOne({ _id: 'orders' });
    const latest = await collections.coupons.findOne({}, { sort: { milestone: -1 } });
    const placedOrders = counter?.seq ?? 0;
    const milestone = (latest?.milestone ?? 0) + 1;
    const nextMilestoneAt = milestone * rewards.everyNOrders;

    if (placedOrders < nextMilestoneAt) {
      throw new AppError(
        'NO_ELIGIBLE_MILESTONE',
        'No unrewarded order milestone has been reached',
        {
          placedOrders,
          nextMilestoneAt,
        },
      );
    }

    const coupon: Omit<CouponDoc, '_id'> = {
      code: generateCouponCode(),
      percentOff: rewards.discountPercent,
      milestone,
      status: 'AVAILABLE',
      generatedAt: new Date(),
    };
    try {
      const { insertedId } = await collections.coupons.insertOne(coupon as CouponDoc);
      return toCouponDto({ ...coupon, _id: insertedId });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
}

/** Newest first. */
export async function listCoupons(
  { collections }: AppContext,
  { status, limit, cursor }: ListCouponsQuery,
): Promise<Page<CouponDto>> {
  const filter: Filter<CouponDoc> = status ? { status } : {};
  const page = await findPage(collections.coupons, filter, { limit, cursor }, 'desc');
  return { data: page.data.map(toCouponDto), nextCursor: page.nextCursor };
}
