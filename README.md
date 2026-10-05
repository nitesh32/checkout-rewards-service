# Checkout & Rewards Service

Backend for an e-commerce store: carts, idempotent checkout, order snapshots, milestone coupons
and an admin sales report. Built to stay correct when requests are retried, checkouts overlap and
two operations compete for the same stock or coupon.

**Stack:** Node 20+, TypeScript (strict), Fastify 5, MongoDB 7 (replica set, official driver),
TypeBox schemas, Vitest.

The reasoning behind the design lives in **[DECISIONS.md](./DECISIONS.md)**.

## Run it

```bash
make up        # MongoDB + API (http://localhost:3000, docs at /docs) + client (http://localhost:5173)
make test      # backend tests, client tests, browser test
make reset     # stop everything and delete the database
```

Without `make`, `docker compose up --build` does the same as `make up`. The details:

```bash
docker compose up --build        # API on http://localhost:3000, Swagger UI on /docs
```

Or locally (Node 20+, and a MongoDB _replica set_, since transactions require one):

```bash
docker compose up -d mongo       # single-node replica set rs0 on localhost:27017
cp .env.example .env             # defaults work with the line above
npm install
npm run dev                      # seeds 6 products on start (idempotent)
```

| Variable                  | Default                                            | Meaning                          |
| ------------------------- | -------------------------------------------------- | -------------------------------- |
| `PORT`                    | `3000`                                             |                                  |
| `MONGO_URI`               | `mongodb://localhost:27017/?directConnection=true` |                                  |
| `REWARD_EVERY_N_ORDERS`   | `5` (Docker and `.env.example` set `1`)            | `n`: one coupon per n-th order   |
| `REWARD_DISCOUNT_PERCENT` | `10`                                               | `x`: percent off for each coupon |

Seed data: 6 premium-electronics products (speaker, earbuds, headphones, phone, smartwatch, camera), including `CAMERA-MIRRORLESS` with only **3** units in stock. Seeding only adds missing SKUs, so run `make reset` to replace an existing database.

## Try the rewards in two minutes

The Docker setup uses `n = 1`, so every order unlocks a reward. Rewards are created on request by
an administrator, as the assignment specifies; they are never generated automatically.

1. `make up`, open http://localhost:5173, add a product and place an order.
2. Open **Rewards** and press **Generate reward** (the admin operation `POST /admin/coupons`).
   Before any order is placed it explains how many orders are still needed.
3. Add a product again: checkout now suggests the reward with its exact saving. Apply it (or use
   **Use at checkout** on the Rewards page) and place the order.
4. `GET /admin/reports/sales` (Swagger at http://localhost:3000/docs) shows the discount and the
   coupon counts.

## Product photos

All six products have real photos from Burst (Shopify's free stock library), bundled from
`client/src/assets/products/<SKU>.webp`. Photographers and licence terms are in
[CREDITS.md](./client/src/assets/products/CREDITS.md).

## Test it

```bash
npm test            # first run downloads a mongod binary for mongodb-memory-server
npm run typecheck
npm run lint
```

Tests run against a real in-memory MongoDB replica set, so the concurrency tests exercise genuine
transaction conflicts rather than mocks: oversell race, same-cart race, same-coupon race, ten
parallel retries with one idempotency key, concurrent coupon generation, rollback on failed
payment, and report reconciliation.

## API

Interactive docs: `GET /docs` (OpenAPI JSON at `/docs/json`). Runnable examples: [api.http](./api.http).
Money is always an integer in minor units (paise), in fields ending `Minor`. Routes under
`/admin` are the administrative operations; authentication is out of scope.

| Method | Path                              | Success | Notable errors                                                                                                             |
| ------ | --------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/products`                       | 200     | 400 `INVALID_CURSOR`. Query: `limit`, `cursor`, `q`, `inStock`                                                             |
| GET    | `/products/:productId`            | 200     | 404 `PRODUCT_NOT_FOUND`                                                                                                    |
| POST   | `/carts`                          | 201     |                                                                                                                            |
| GET    | `/carts/:cartId`                  | 200     | 404 `CART_NOT_FOUND`. Live prices; each line has `isPurchasable`                                                           |
| POST   | `/carts/:cartId/items`            | 200     | 404 `PRODUCT_NOT_FOUND`, 409 `INSUFFICIENT_STOCK` / `CART_NOT_OPEN`, 422 `QUANTITY_LIMIT_EXCEEDED`, 400 `VALIDATION_ERROR` |
| PATCH  | `/carts/:cartId/items/:productId` | 200     | as above, plus 404 `CART_ITEM_NOT_FOUND`                                                                                   |
| DELETE | `/carts/:cartId/items/:productId` | 200     | 404 `CART_ITEM_NOT_FOUND`, 409 `CART_NOT_OPEN`                                                                             |
| GET    | `/carts/:cartId/quote`            | 200     | Read-only preview of totals; query `couponCode?`. 404 `COUPON_NOT_FOUND`, 409 `COUPON_ALREADY_REDEEMED` / `CART_NOT_OPEN`  |
| GET    | `/rewards`                        | 200     | Public list of available rewards `[{ code, percentOff }]`, best first                                                      |
| POST   | `/carts/:cartId/checkout`         | 201/200 | Header `Idempotency-Key` required. Body `{ couponCode?, expectedTotalMinor? }`. See below                                  |
| GET    | `/orders/:orderId`                | 200     | 404 `ORDER_NOT_FOUND`                                                                                                      |
| POST   | `/admin/coupons`                  | 201     | 409 `NO_ELIGIBLE_MILESTONE` (details: `placedOrders`, `nextMilestoneAt`)                                                   |
| GET    | `/admin/coupons`                  | 200     | Paginated; filter `status`                                                                                                 |
| GET    | `/admin/orders`                   | 200     | Paginated, newest first; filters `from`, `to`, `couponCode`                                                                |
| GET    | `/admin/reports/sales`            | 200     | Read-only snapshot                                                                                                         |

**Checkout outcomes**

| Status | Code                                   | Meaning                                                                          |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------- |
| 201    |                                        | Order placed                                                                     |
| 200    |                                        | Same key and body as an earlier success: same order, `Idempotent-Replayed: true` |
| 400    | `VALIDATION_ERROR`                     | Missing/short `Idempotency-Key`, malformed body                                  |
| 402    | `PAYMENT_DECLINED`                     | Payment provider declined; nothing was changed                                   |
| 404    | `CART_NOT_FOUND`, `COUPON_NOT_FOUND`   |                                                                                  |
| 409    | `CART_ALREADY_CHECKED_OUT`             | Details contain the existing `orderId`                                           |
| 409    | `INSUFFICIENT_STOCK`                   | Details list `{ productId, sku, requested, available }` per short item           |
| 409    | `PRICE_CHANGED`                        | `expectedTotalMinor` differs from the computed total (details has both)          |
| 409    | `COUPON_ALREADY_REDEEMED`              |                                                                                  |
| 422    | `CART_EMPTY`, `IDEMPOTENCY_KEY_REUSED` | Key reused with a different cart/coupon/expected total                           |

Every error has one shape: `{ "error": { "code", "message", "details"? } }`.

## Layout

```
src/
  app.ts, server.ts, config.ts, context.ts   composition and startup
  db/            typed collections, indexes (the invariants), seed, transaction helper
  shared/        AppError + handler, money (the only place money maths happens), pagination
  modules/       products | carts | checkout | orders | coupons | reports
                 routes.ts (HTTP only) · service.ts (rules + DB) · schemas.ts (validation + types)
tests/           concurrency, idempotency, coupons, carts, reports, money
```
