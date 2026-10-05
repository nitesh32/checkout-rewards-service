import { randomInt } from 'node:crypto';
import type { ClientSession, Filter } from 'mongodb';
import type { AppContext } from '../../context.js';
import type { CouponDoc } from '../../db/collections.js';
import { isDuplicateKeyError } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';
import { findPage, type Page } from '../../shared/pagination.js';
import type { CouponDto, ListCouponsQuery, RewardDto, RewardProgressDto } from './schemas.js';

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

interface MilestoneStatus {
  placedOrders: number;
  /** Milestones that already have a coupon. */
  rewardedMilestones: number;
  /** The order count at which the next milestone is reached. */
  nextMilestoneAt: number;
}

/** How far the store is towards the next reward; shared by generation and the progress view. */
async function readMilestoneStatus({ collections, rewards }: AppContext): Promise<MilestoneStatus> {
  const counter = await collections.counters.findOne({ _id: 'orders' });
  const latest = await collections.coupons.findOne({}, { sort: { milestone: -1 } });
  const rewardedMilestones = latest?.milestone ?? 0;
  return {
    placedOrders: counter?.seq ?? 0,
    rewardedMilestones,
    nextMilestoneAt: (rewardedMilestones + 1) * rewards.everyNOrders,
  };
}

function newCoupon(milestone: number, percentOff: number): Omit<CouponDoc, '_id'> {
  return {
    code: generateCouponCode(),
    percentOff,
    milestone,
    status: 'AVAILABLE',
    generatedAt: new Date(),
  };
}

/**
 * Runs inside checkout's transaction: the order that reaches milestone k (order number k * n)
 * creates that milestone's coupon, so the reward exists exactly when the order does and a failed
 * checkout creates nothing. The upsert keeps one coupon per milestone even if an administrator
 * generated it first.
 */
export async function unlockMilestoneReward(
  { collections, rewards }: AppContext,
  orderNumber: number,
  session: ClientSession,
): Promise<CouponDoc | null> {
  if (orderNumber % rewards.everyNOrders !== 0) return null;
  const { milestone, ...fields } = newCoupon(
    orderNumber / rewards.everyNOrders,
    rewards.discountPercent,
  );
  return collections.coupons.findOneAndUpdate(
    { milestone },
    { $setOnInsert: fields },
    { upsert: true, returnDocument: 'after', session },
  );
}

/**
 * The administrator operation: generates the coupon for the earliest milestone that has been
 * reached but has no coupon. Checkout normally creates it already, so this only catches up, for
 * example orders placed before rewards were automatic. The unique index on `milestone` makes
 * concurrent generation safe: the loser re-reads and either takes the next milestone or is told
 * none is eligible.
 */
export async function generateCoupon(context: AppContext): Promise<CouponDto> {
  const { collections, rewards } = context;
  // Terminates: each duplicate-key failure means another request created a coupon, so the
  // latest milestone strictly advances on every retry.
  for (;;) {
    const { placedOrders, rewardedMilestones, nextMilestoneAt } =
      await readMilestoneStatus(context);

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

    const coupon = newCoupon(rewardedMilestones + 1, rewards.discountPercent);
    try {
      const { insertedId } = await collections.coupons.insertOne(coupon as CouponDoc);
      return toCouponDto({ ...coupon, _id: insertedId });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
}

/**
 * Progress towards the next reward, for a "3 orders left" tracker. It counts orders since the last
 * rewarded milestone, so it starts again from zero when that milestone's coupon is created.
 */
export async function getRewardProgress(context: AppContext): Promise<RewardProgressDto> {
  const { placedOrders, rewardedMilestones, nextMilestoneAt } = await readMilestoneStatus(context);
  const { everyNOrders, discountPercent } = context.rewards;
  const ordersLeft = Math.max(0, nextMilestoneAt - placedOrders);
  return {
    everyNOrders,
    percentOff: discountPercent,
    placedOrders,
    rewardedMilestones,
    // Clamped so a change of n on an existing database never shows a negative count.
    ordersTowardNext: Math.min(everyNOrders, Math.max(0, everyNOrders - ordersLeft)),
    ordersLeft,
    isRewardDue: ordersLeft === 0,
  };
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

const MAX_LISTED_REWARDS = 100;

/** Rewards anyone may use right now (there are no customer accounts), best first. */
export async function listAvailableRewards({ collections }: AppContext): Promise<RewardDto[]> {
  const coupons = await collections.coupons
    .find({ status: 'AVAILABLE' })
    .sort({ percentOff: -1, milestone: 1 })
    .limit(MAX_LISTED_REWARDS)
    .toArray();
  return coupons.map(({ code, percentOff }) => ({ code, percentOff }));
}
