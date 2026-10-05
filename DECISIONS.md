# Decisions

How the service stays correct under retries, overlapping checkouts and competing coupon use, and
what was deliberately left out. Where something is enforced is named so it can be found quickly.

## 1. System invariants

| #   | Invariant                                                                         | Enforced by                                                                                                                       |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `stock` never goes negative; units sold never exceed stock                        | Conditional update `{ _id, stock: { $gte: qty } }` inside the checkout transaction (`reserveStock`)                               |
| 2   | A cart produces at most one order                                                 | Claiming the cart (`OPEN` → `CHECKED_OUT`) is the first write of the transaction; unique index `orders.cartId` as a backstop      |
| 3   | One idempotency key maps to at most one order                                     | Unique index `orders.idempotencyKey`; stored `requestHash` detects reuse for a different request                                  |
| 4   | A coupon is redeemed at most once, and only by an order that was actually placed  | Conditional update `{ code, status: 'AVAILABLE' }` in the checkout transaction; commits only together with the order              |
| 5   | A failed checkout changes nothing (stock, coupon, counter, cart, order)           | One transaction: any thrown error aborts all writes                                                                               |
| 6   | At most one coupon per milestone, and only once `placedOrders >= milestone × n`   | Unique index `coupons.milestone`; eligibility check against `counters.orders`                                                     |
| 7   | `0 ≤ discount ≤ subtotal` and `total = subtotal − discount`                       | `calculateDiscountMinor` (floor, clamped) in `shared/money.ts`; total derived, never stored independently                         |
| 8   | Orders are immutable snapshots of what was bought and how the total was computed  | Order lines copy sku, name, unit price, quantity and line total; later product edits cannot reach them                            |
| 9   | The report reconciles with orders and coupons, and reading it never mutates state | Single snapshot transaction of read-only aggregations; test compares it to `/admin/orders` and asserts repeat calls are identical |

Products are never deleted by this service (there is no delete endpoint); a cart referencing a
missing product is treated as a data error.

## 2. Ambiguities and the semantics chosen

| Question                                     | Decision                                                                                                                                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Price changes after an item was added        | The cart stores **no price**. Viewing shows current prices; checkout charges current prices. Clients may send `expectedTotalMinor`; if the computed total differs the checkout fails with `409 PRICE_CHANGED` (both totals in `details`). |
| Stock changes after an item was added        | No reservation. Add/update validates against current stock for fast feedback; **checkout is authoritative**. A cart view flags lines that are no longer purchasable (`isPurchasable: false`).                                             |
| Adding a product that is already in the cart | Merges into the existing line (quantities add) and re-checks stock and the per-line limit (100).                                                                                                                                          |
| PATCH vs DELETE                              | PATCH sets an absolute quantity ≥ 1; removing is DELETE. DELETE of an item not in the cart is `404 CART_ITEM_NOT_FOUND`, not a silent success.                                                                                            |
| Which orders count towards a milestone       | Every successfully placed order, including discounted ones. Milestone _k_ is reached when `placedOrders ≥ k × n`.                                                                                                                         |
| What admin "generate" does                   | Creates the coupon for the **earliest reached, unrewarded milestone**, one per call. If none: `409 NO_ELIGIBLE_MILESTONE` (with `placedOrders`, `nextMilestoneAt`). Missed milestones are not lost; they can be generated later.          |
| Is the coupon percent fixed at generation?   | Yes. `percentOff` is copied onto the coupon, so changing `x` later does not alter existing coupons.                                                                                                                                       |
| Coupon scope                                 | Single-use, usable by any customer (there is no auth), no expiry, no minimum order, one coupon per order. Codes are case-insensitive (normalised to upper case).                                                                          |
| Discount base                                | Applied to the subtotal; `floor(subtotal × percent / 100)`, clamped to the subtotal. A 100% coupon yields a total of exactly 0.                                                                                                           |
| Retrying a checkout that failed              | Failures are **not** remembered; a retry with the same key re-evaluates (stock may have been replenished). Only a success is replayed.                                                                                                    |
| Same key, different request                  | `422 IDEMPOTENCY_KEY_REUSED`. "Same request" = same cart, coupon (normalised) and `expectedTotalMinor`.                                                                                                                                   |
| Currency and payment                         | Single currency (INR, paise). Payment is a `PaymentProvider` interface with a fake that always succeeds (see decision 9).                                                                                                                 |

## 3. Material decisions

### Decision 1: MongoDB transactions with conditional updates for inventory and coupons

**Context:** Two customers buying the last unit, or redeeming the same coupon, must produce one
winner and one clean failure, and a failure must leave no half-applied writes.

**Options considered:** (a) In-process mutex or in-memory store; (b) PostgreSQL `SELECT … FOR UPDATE`
or `UPDATE … WHERE stock >= $qty`; (c) MongoDB multi-document transactions with conditional updates.

**Choice:** (c), on a single-node replica set, using the official driver (no ODM) so every
transaction and filter is visible in the code.

**Why:** A mutex only works for one process and breaks as soon as a second instance starts.
Database-level atomicity is what carries over to several instances. Conditional updates make each
guard a single atomic step (`stock >= qty`, `status = AVAILABLE`), and the transaction makes the set
of writes all-or-nothing. When two transactions touch the same document MongoDB raises a write
conflict and the driver re-runs the loser against fresh data, which re-checks the condition.
PostgreSQL would be equally valid; Mongo was chosen for speed of setup here.

**Consequences:** A replica set is required (even locally), which costs a little setup. Hot
documents cause retries under load (see "Weaknesses").

### Decision 2: Idempotency via a unique key on the order, plus a request hash

**Context:** A client may time out and retry. A retry must not create a second order or take stock
twice, and must get the original answer.

**Options considered:** (a) A separate `idempotency_keys` collection storing responses; (b) use the
cart as the key; (c) store the key and a hash of the request on the order itself.

**Choice:** (c). `orders.idempotencyKey` is unique; `requestHash = sha256(cartId, coupon, expectedTotalMinor)`.

**Why:** The order is the only thing worth replaying, and writing it atomically with the key means
there is no window where an order exists without its key (or the reverse). (b) alone cannot tell a
legitimate retry from a different client hitting an already-ordered cart, and cannot detect a
key reused for a different request. A separate collection would need its own transaction and
cleanup, and would duplicate data already on the order.

**Consequences:** Only successes are cached, which is the semantics wanted. Keys never expire
(deferred). A parallel retry that loses the race fails on the cart claim or the unique index, and
`placeOrder` then loads the winner's order and, if key and hash match, returns it as a replay. This
branch is what makes ten simultaneous retries produce one 201 and nine 200s instead of nine 409s;
a test breaks if it is removed.

### Decision 3: Live prices with an optional `expectedTotalMinor`, not a price snapshot at add-to-cart

**Context:** The product price can change between add-to-cart and checkout.

**Options considered:** (a) Snapshot the price when the item is added; (b) always charge the current
price silently; (c) charge the current price and let the client assert what it expects.

**Choice:** (c).

**Why:** A snapshot goes stale and obliges the store to honour old prices indefinitely; silently
charging a different price surprises customers. (c) keeps the cart simple, charges the true price,
and gives a client that displayed a total a way to refuse a different one (`PRICE_CHANGED`).

**Consequences:** Clients that do not send the guard get the current price. The order records the
price actually charged.

### Decision 4: No stock reservation when adding to a cart

**Context:** Stock can run out between add-to-cart and checkout.

**Options considered:** (a) Reserve stock on add with a TTL; (b) validate on add, decide at checkout.

**Choice:** (b).

**Why:** Reservations need expiry, a sweeper and a policy for abandoned carts, and they let carts
that will never convert hold inventory. Validating on add gives quick feedback; the conditional
decrement at checkout is the real guarantee.

**Consequences:** A cart can be accepted and then fail at checkout with `INSUFFICIENT_STOCK` (with
per-item detail), and the cart view marks such lines. A reservation design is a candidate for the
next iteration.

### Decision 5: Coupon generation is "earliest unrewarded milestone per call", not auto-generation on the n-th order

**Context:** Spec: an admin requests generation, and it only succeeds if a milestone was reached and
not already rewarded.

**Options considered:** (a) Generate automatically inside the order transaction; (b) admin call that
generates for the latest reached milestone; (c) admin call that generates the earliest reached,
unrewarded milestone.

**Choice:** (c).

**Why:** (a) contradicts the requirement that an administrator requests generation. (b) would lose
the milestones it skips. (c) never loses one, and uniqueness on `milestone` makes concurrent calls
safe: the loser sees a duplicate-key error, re-reads, and takes the next milestone or gets `409`.
The order count is read outside a transaction; since it only grows, a stale read can under-grant but
never over-grant.

**Consequences:** If five milestones accumulate, five calls are needed. `placedOrders` comes from a
single counter document incremented in the order transaction.

### Decision 6: Integer minor units and floor rounding

**Context:** Money must not suffer floating-point errors, and discounts must be deterministic and
never negative.

**Options considered:** (a) JS floats; (b) a decimal library; (c) integer paise with explicit rounding.

**Choice:** (c). Every money field ends in `Minor`; `shared/money.ts` is the only place that
performs arithmetic and asserts every value is a safe integer.

**Why:** Integers are exact for addition and multiplication, and the single rounding step is explicit.
`floor` means the discount never exceeds the promised percentage (banker's or half-up rounding can
exceed it by one paisa) and is the same on every run.

**Consequences:** Percentages must be integers (0–100). Amounts that would overflow 2^53 throw
instead of silently losing precision.

### Decision 7: Cart edits are read-modify-write inside a transaction

**Context:** Add, patch and delete must not lose updates when two edits (or an edit and a checkout)
hit the same cart.

**Options considered:** (a) Hand-built atomic array updates (`$inc` with `arrayFilters`, conditional
`$push`); (b) a version field with optimistic retry; (c) a short transaction: read the cart, compute
the new items, write them.

**Choice:** (c), via one shared `editCartItems` helper used by add, patch and delete.

**Why:** (a) needs a different multi-branch update for each operation and a second query to explain
why one failed. In (c) the rules (merge, stock, limit) are ordinary code, and Mongo detects a
concurrent change to the cart document as a write conflict and re-runs the edit. A checkout that
claims the cart conflicts with an in-flight edit the same way, so an edit can never slip into an
already checked-out cart.

**Consequences:** Slightly more overhead per edit than a single update; fine at this scale.

### Decision 8: Keyset (cursor) pagination on `_id`

**Context:** Lists (products, orders, coupons) need paging that is stable while rows are inserted.

**Options considered:** Offset/limit vs cursor on `_id`.

**Choice:** Cursor: opaque base64url of the last `_id`, `limit` default 20, max 100.

**Why:** Offset pagination skips or repeats rows when data changes between pages and gets slower
with depth. ObjectIds are time-ordered, so `_id` ordering is stable and indexed.

**Consequences:** No jump-to-page and no arbitrary sort order; admin lists are newest first.

### Decision 9: A payment abstraction with a fake provider

**Context:** No real payment is required, but checkout must say what happens if one fails.

**Choice:** `PaymentProvider` interface with a `FakePaymentProvider` that always succeeds. A
`DECLINED` result aborts the transaction (`402 PAYMENT_DECLINED`); a test proves nothing is left
behind.

**Why:** It makes "payment failure rolls everything back" concrete and testable without
integrating anything.

**Consequences:** Charging inside a transaction that the driver may re-run is only safe for a fake.
A real provider needs the order created as `PENDING`, a charge keyed by the order id, and an outbox
or saga to finalise (deferred).

### Decision 10: Product search runs in the browser, not per keystroke on the server

**Context:** The shop should feel instant while the shopper types. The API supports a `q` filter
(case-insensitive regex on the name), but each keystroke then costs a request, a possible flash of
the loading state, and an unindexed regex scan.

**Options considered:** (a) Server search per keystroke, debounced; (b) server search with
`keepPreviousData`, request cancellation and an indexed lower-case prefix field (or Atlas Search for
typo tolerance); (c) filter the already-loaded catalogue in the browser.

**Choice:** (c). The shop loads the whole catalogue (the API's page maximum of 100) and filters,
categorises and sorts it locally in one pure function (`filterProducts.ts`, unit-tested). No request
is made while typing. The URL is updated after a 200 ms pause, only so a search can be bookmarked and
the back button works; 200 ms is the debounce Algolia recommends, and delays above 300 ms feel slow.

**Why:** For a catalogue of this size it is the fastest option and the simplest to reason about.
Research on MongoDB search also showed that case-insensitive regex cannot use an index well and text
indexes do not match prefixes, so fixing the server path properly means new indexed fields or Atlas
Search, which is not justified here.

**Consequences:** Past 100 products the browser no longer holds everything, so search must move
to the server: use `q` with cursor pagination, keep the previous results visible while a new query
loads (`placeholderData: keepPreviousData`), cancel superseded requests (the query function already
passes its `AbortSignal` to the API client), and add an indexed lower-case prefix field or Atlas Search.

### Decision 11: A read-only quote endpoint, so a reward code is confirmed before ordering

**Context:** Production checkouts check a promo code when it is applied and show the exact saving
and new total before the customer pays. The API only applied a code while placing the order, so
the storefront could not show the discount, could not explain a bad code until ordering, and had to
switch off the price-change guard whenever a code was entered.

**Options considered:** (a) Keep applying codes only at order time; (b) compute the discount in the
browser from the coupon's percentage; (c) a read-only `GET /carts/:cartId/quote?couponCode=` that
validates the code and returns subtotal, discount and total.

**Choice:** (c), plus a public `GET /rewards` (code and percentage only), so shoppers no longer read
`/admin/coupons`.

**Why:** The quote and the order share one pure `calculateTotals`, so money is computed in one
place (option (b) would have duplicated the rounding rule in the client). The quote redeems nothing,
so applying a code is free and repeatable. The storefront can now send the quoted total as
`expectedTotalMinor`, so the price-change guard covers discounted orders too.

**Consequences:** A quote is advisory. If another order uses the code between Apply and Place order,
the order still fails safely with `COUPON_ALREADY_REDEEMED` (redemption happens inside the order
transaction); the storefront then removes the code and explains why. Following Baymard and
Voucherify's coupon UX guidance, checkout suggests the best reward with its exact saving (one tap,
never applied silently), keeps manual entry behind "Have a code?", shows specific inline errors, and
replaces the field with "applied, you save ₹X" and a Remove link.

## 4. Transaction, concurrency and idempotency strategy

**Checkout, in one transaction** (`modules/checkout/service.ts`):

1. Claim the cart: `findOneAndUpdate({ _id, status: 'OPEN' }, → CHECKED_OUT)`. Whoever does this first owns the cart.
2. Reject an empty cart; price the lines at current prices; sum with integers.
3. If a coupon was supplied, redeem it: `{ code, status: 'AVAILABLE' } → REDEEMED`, recording the order id. Distinguish "not found" from "already redeemed" with a second read.
4. Compute the discount and total; compare with `expectedTotalMinor` if given.
5. For each line (sorted by product id), `updateOne({ _id, stock: { $gte: qty } }, { $inc: { stock: -qty } })`. Collect every shortage and throw one `INSUFFICIENT_STOCK`.
6. Charge the payment provider; abort on decline.
7. Increment the order counter and insert the order (with its idempotency key, request hash and snapshot).

Any exception rolls back every write above, so a failed checkout leaves the cart `OPEN`, the coupon
`AVAILABLE` and the stock untouched.

**Two concurrent checkouts for the last unit** (A and B, different carts):
both read stock = 1 in their snapshots; A's decrement commits first; B's conditional update then
hits a document modified after B's snapshot, so MongoDB reports a write conflict; the driver
re-runs B's callback with a fresh snapshot, where `stock >= 1` is false; B throws
`INSUFFICIENT_STOCK` and its transaction aborts. Stock ends at 0 with exactly one order.

**Races and how each one resolves**

| Race                                     | Outcome                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| Same key, same request, in parallel      | One 201; the others replay the winner (200)                                                 |
| Different keys, same cart                | One 201; the rest `409 CART_ALREADY_CHECKED_OUT` with the existing `orderId`                |
| Different carts, same coupon             | One 201; the rest `409 COUPON_ALREADY_REDEEMED`, fully rolled back                          |
| Different carts, last units of a product | Exactly `stock` successes; the rest `409 INSUFFICIENT_STOCK`                                |
| Parallel admin coupon generation         | One coupon per milestone; the rest get the next milestone or `409 NO_ELIGIBLE_MILESTONE`    |
| Cart edit vs checkout of the same cart   | Serialised by the write conflict on the cart document; a late edit gets `409 CART_NOT_OPEN` |

The order counter and the collections are created at startup, not lazily, so concurrent
transactions never race to create a collection or upsert the counter.

## 5. Money and rounding rules

- Integer minor units (paise) everywhere; field names end in `Minor`; currency is `INR`.
- `line = unitPrice × quantity`; `subtotal = Σ lines`; `discount = min(floor(subtotal × percent / 100), subtotal)`; `total = subtotal − discount`.
- Floor rounding: deterministic, never over-discounts. Example: 29,985 paise at 10% → discount 2,998 (not 2,999); a 100% coupon → total 0.
- Any non-integer or unsafe (> 2^53) amount throws rather than being rounded silently.

## 6. Error model

One body shape: `{ "error": { "code", "message", "details"? } }`; `code` is stable and machine
readable. The HTTP status says who can fix it:

- **400** malformed input (`VALIDATION_ERROR`, `BAD_REQUEST`, `INVALID_CURSOR`)
- **402** `PAYMENT_DECLINED`
- **404** resource missing (`*_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `ROUTE_NOT_FOUND`)
- **409** valid request, conflicting state; the client can retry after changing something (`INSUFFICIENT_STOCK`, `PRICE_CHANGED`, `CART_ALREADY_CHECKED_OUT`, `CART_NOT_OPEN`, `COUPON_ALREADY_REDEEMED`, `NO_ELIGIBLE_MILESTONE`)
- **422** well-formed but semantically unacceptable (`CART_EMPTY`, `QUANTITY_LIMIT_EXCEEDED`, `IDEMPOTENCY_KEY_REUSED`)
- **500** `INTERNAL_ERROR`: logged server-side, no internals leaked

Codes and statuses are declared once in `shared/errors.ts`. A missing `Idempotency-Key` is reported
as `VALIDATION_ERROR` (the header is declared required in the schema, so the OpenAPI document is accurate).

## 7. Implemented vs deferred

**Implemented:** products with seed data; carts (create, view with live totals, add, patch,
remove); idempotent transactional checkout; optional coupon and price guard; order snapshots;
admin coupon generation and listing; admin order listing; consistent sales report; cursor
pagination; OpenAPI docs; Docker setup; concurrency, idempotency, coupon, report, cart and money tests.

**Deferred on purpose:** authentication and authorisation (admin routes are only separated by
path); coupon expiry and minimum order value; stock reservations; real payments (outbox/saga,
`PENDING` orders); idempotency-key expiry (TTL index); rate limiting; multiple currencies;
returns, cancellations and restocking endpoints; product management endpoints.

## 8. Scaling to several instances and production

- **Instances:** the service keeps no state in memory; all coordination (transactions, conditional
  updates, unique indexes) lives in MongoDB, so running several instances needs no code change.
- **Hot products:** every checkout for the same product writes one document, so a flash sale causes
  write conflicts and retries. Mitigations: shard stock into N counters per product, or move to a
  reservation queue so contention is absorbed before the transaction.
- **Order counter:** one document incremented by every order serialises all checkouts. At scale,
  derive milestones from a count of orders (or per-shard counters) and accept eventual eligibility.
- **Idempotency:** add a TTL (e.g. 24h) on keys, and return `409` for a key that is still in flight
  rather than relying on the conflict retry.
- **Payments and notifications:** create orders as `PENDING`, charge with the order id as the
  provider's idempotency key, and publish events through an outbox.
- **Reports:** the report aggregates every order; use pre-aggregated counters or a read replica
  with a materialised view once order volume grows.
- **Operations:** structured logs with request ids (Fastify/pino are in place); add a health
  endpoint and metrics on transaction retries and 409 rates. Transactions already use snapshot
  reads and `majority` write concern.

**Weaknesses I would name first:** the hot order counter and hot product documents (above); the
driver retries transient conflicts for up to 120 s, so extreme contention shows up as latency
before it shows up as errors; replay is by key only for successful checkouts.

## 9. AI usage

The first build plan was drafted with a chat assistant; the code was written with Claude Code, and I
reviewed the plan before any code existed and checked the result with tests meant to break it.

Where I changed what the AI proposed:

- **Idempotency bug in the plan.** The plan returned a replay only if a pre-check by key found an
  order, and relied on the unique index for the parallel case. Reasoning through ten parallel
  retries showed the losers would not hit that index: they would conflict on the cart claim, retry,
  see a checked-out cart and return `409 CART_ALREADY_CHECKED_OUT` instead of the original order.
  I added the "load the winner by key and replay" branch, then proved the test is meaningful by
  removing that branch: the ten-parallel-retries test fails. Likewise, deleting the stock guard
  fails four tests and deleting the `AVAILABLE` coupon condition fails two.
- **Cart edits.** The plan suggested atomic array updates with a `version` field that nothing used.
  I replaced this with one transactional read-modify-write helper (decision 7).
- **Scope.** The plan estimated about 7.5 hours against a 4–6 hour cap and included swagger
  generation, zod and extra filters. I trimmed it to fit the timebox.
- **A bug that passing tests did not reveal.** The in-process tests used Fastify's `inject`, which
  hides how real clients behave. A smoke test over real HTTP showed that `POST /carts` with
  `content-type: application/json` and an empty body returned 400 (Fastify rejects empty JSON
  bodies). I added `tolerateEmptyJsonBodies` and a regression test.

I did not accept generated code without running it: the suite uses a real replica set so the
transaction behaviour is exercised for real.

## 10. What I would examine first with two more hours

1. A k6 load test on one hot product to measure transaction retries and p99 latency, then decide
   whether stock sharding is needed.
2. Idempotency-key TTL and an in-flight state, so a slow first request is distinguishable from a lost one.
3. A stock-reservation design (with expiry) and its interaction with the cart view.
4. A property-based test for money (random subtotals and percentages: `0 ≤ discount ≤ subtotal`,
   `total + discount = subtotal`).
5. Removing the single order counter as a contention point.
