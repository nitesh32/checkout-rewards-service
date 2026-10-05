# Decisions

This document explains how the service stays correct when requests are retried, when several
customers check out at the same time, and when two people try to use the same coupon. It also lists
what I chose not to build.

## 1. Things that must always be true (invariants)

| #   | Rule                                                                      | How it is guaranteed                                                                            |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Stock never goes below zero; we never sell more than we have              | Stock is only reduced with a condition "only if stock ≥ quantity", inside the order transaction |
| 2   | A cart becomes at most one order                                          | Checkout first marks the cart as checked out; a unique index on `orders.cartId` backs this up   |
| 3   | One idempotency key gives at most one order                               | Unique index on `orders.idempotencyKey`                                                         |
| 4   | A coupon is used at most once, and only by an order that succeeded        | The coupon is marked used inside the same transaction as the order                              |
| 5   | A failed checkout changes nothing                                         | Everything happens in one transaction; any error undoes all of it                               |
| 6   | At most one coupon per milestone, and only once the milestone is reached  | Unique index on `coupons.milestone`, plus a check against the order count                       |
| 7   | The discount is never more than the subtotal; total = subtotal − discount | One money function (`shared/money.ts`) calculates it                                            |
| 8   | An order never changes after it is placed                                 | The order stores its own copy of names, prices and quantities                                   |
| 9   | The report matches the orders and coupons, and reading it changes nothing | It reads everything from one consistent snapshot and writes nothing                             |

## 2. Unclear points in the brief, and what I decided

| Question                                          | My decision                                                                                                                                                                                                           |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The price changes after an item is added          | The cart does not store prices. It always shows today's price, and checkout charges today's price. The client can send the total it showed; if the real total differs, checkout stops with `PRICE_CHANGED`.           |
| Stock changes after an item is added              | Stock is not reserved. Adding to the cart checks stock for quick feedback, but checkout makes the final decision. The cart marks items that are no longer available.                                                  |
| The same product is added twice                   | The quantities are added together into one line.                                                                                                                                                                      |
| Removing an item                                  | `DELETE` removes it. Removing something that is not in the cart returns `404`.                                                                                                                                        |
| Which orders count towards a reward               | Every successful order, including ones that used a coupon. With n = 5, the 5th, 10th, 15th… orders each unlock one reward.                                                                                            |
| What "generate coupon" does                       | It creates the coupon for the oldest reached milestone that has no coupon yet. Missed milestones are never lost. If nothing is due, it returns `409 NO_ELIGIBLE_MILESTONE` and says how many orders are still needed. |
| Coupon rules                                      | One use only, any customer can use it (there are no accounts), no expiry, no minimum order, one coupon per order. Codes are not case-sensitive.                                                                       |
| The coupon percentage changes later               | Existing coupons keep the percentage they were created with.                                                                                                                                                          |
| A checkout fails and is retried with the same key | Failures are not remembered, so the retry is tried again (stock may be back). Only a successful order is replayed.                                                                                                    |
| The same key is sent with a different request     | Rejected with `422 IDEMPOTENCY_KEY_REUSED`.                                                                                                                                                                           |
| Currency and payment                              | Indian rupees, stored in paise. Payment is a fake that always succeeds (decision 8).                                                                                                                                  |

## 3. Main decisions

### Decision 1: Use MongoDB transactions and conditional updates

**Context:** When two people buy the last unit, or use the same coupon, exactly one must win, and the
loser must leave nothing half-done.

**Options considered:** a lock inside the app; PostgreSQL row locks; MongoDB transactions.

**Choice:** MongoDB transactions, with updates that only apply when a condition holds (for example
"reduce stock only if stock ≥ quantity", "mark coupon used only if it is still available").

**Why:** A lock inside the app stops working as soon as a second server runs. The database has to
be the referee. If two transactions touch the same record, MongoDB rejects one and the driver
retries it with fresh data, so the condition is checked again. PostgreSQL would also have worked; I
chose MongoDB because it was quicker to set up here.

**Consequences:** MongoDB must run as a replica set, even locally (Docker handles this). A very
popular product causes retries under heavy load.

### Decision 2: Store the idempotency key on the order itself

**Context:** A client may time out and send the same checkout again. That must not create a second
order or take stock twice, and the client should get the original order back.

**Options considered:** a separate table of keys and responses; using the cart as the key; saving
the key (and a fingerprint of the request) on the order.

**Choice:** Save the key and a fingerprint of the request on the order, with a unique index on the
key.

**Why:** The key and the order are saved together, so one can never exist without the other. A
separate table would need its own cleanup and would duplicate the order. The fingerprint lets us
reject a key reused for a different request.

**Consequences:** If ten identical requests arrive at once, one creates the order and the other nine
get the same order back. A test checks exactly this. Keys never expire yet (see section 10).

### Decision 3: Charge today's price, and let the client confirm the total

**Context:** A price can change between adding to the cart and checking out.

**Options considered:** lock the price when the item is added; silently charge the new price; charge
the new price but let the client say what total it expected.

**Choice:** The last one. The client may send `expectedTotalMinor`; if the total has changed,
checkout stops with `PRICE_CHANGED` and shows both amounts.

**Why:** Locked prices go out of date and force the store to honour old prices. Silently charging a
different amount surprises the customer.

**Consequences:** The order stores the price that was actually charged.

### Decision 4: Do not reserve stock when adding to the cart

**Context:** Stock can run out between adding to the cart and checking out.

**Options considered:** reserve stock with a timeout; check on add, decide at checkout.

**Choice:** Check on add, decide at checkout.

**Why:** Reservations need timeouts, a clean-up job and rules for abandoned carts, and they lock up
stock for people who never buy.

**Consequences:** Checkout can fail with `INSUFFICIENT_STOCK`, which lists each item that is short.
The cart warns about such items before checkout.

### Decision 5: An admin creates coupons, one milestone at a time

**Context:** The brief says an administrator asks for a coupon, and it is only created if a
milestone has been reached and not yet rewarded.

**Options considered:** create the coupon automatically during the order; let the admin create one
for the latest milestone; let the admin create one for the oldest unrewarded milestone.

**Choice:** The admin creates the coupon for the oldest unrewarded milestone.

**Why:** Automatic creation goes against the brief. Rewarding only the latest milestone would lose
any milestones that were skipped. With a unique index on the milestone, two admins clicking at the
same time can never create two coupons for the same milestone.

**Consequences:** If several milestones have built up, the admin has to create them one by one.

**Added later for demos:** setting `REWARD_AUTO_GENERATE=true` makes the service create the coupon
right after an order reaches a milestone, using the same admin logic. It is off by default, so the
brief's behaviour is unchanged (`make demo` turns it on). It runs after the order is saved, so it
can never undo a successful order.

### Decision 6: Store money as whole paise and round discounts down

**Context:** Money must never suffer from floating-point errors, and discounts must be predictable
and never make a total negative.

**Options considered:** normal JavaScript numbers with decimals; a decimal library; whole paise.

**Choice:** Whole paise (integers) everywhere, calculated in one file (`shared/money.ts`).
Discounts are rounded down to the paisa.

**Why:** Adding and multiplying whole numbers is exact. Rounding down means a customer never gets
more than the advertised percentage, and the result is always the same.

**Consequences:** Coupon percentages must be whole numbers. Amounts too large to store safely cause
an error instead of being silently wrong.

### Decision 7: Change the cart inside a short transaction

**Context:** Two changes to the same cart at the same time (or a change during checkout) must not
overwrite each other.

**Options considered:** special single-step database updates for each kind of change; a version
number with retries; read the cart, change it, write it back, inside a transaction.

**Choice:** The transaction, through one helper used by add, update and remove.

**Why:** The cart rules (merging, stock checks, limits) stay as normal, readable code. If someone
else changes the cart at the same moment, MongoDB detects it and the change is retried.

**Consequences:** Slightly slower than a single update, which does not matter at this size.

### Decision 8: A fake payment provider behind an interface

**Context:** No real payment is needed, but it should be clear what happens if a payment fails.

**Choice:** A small `PaymentProvider` interface with a fake that always succeeds. A declined payment
undoes the whole order; a test proves this.

**Why:** It shows the failure path without integrating a real payment service.

**Consequences:** A real provider would need a two-step flow (order created as "pending", then
confirmed), because a payment cannot be undone by a database rollback.

### Decision 9: A read-only "quote" so customers see their discount before paying

**Context:** Real checkouts check a coupon code as soon as it is entered and show the new total.
Originally the code was only checked when the order was placed.

**Options considered:** keep checking only at order time; calculate the discount in the browser; add
a read-only quote endpoint.

**Choice:** `GET /carts/:cartId/quote?couponCode=` returns the subtotal, discount and total without
using the coupon. `GET /rewards` lists available coupons for shoppers.

**Why:** The quote and the real order use the same money function, so the discount is calculated in
one place only. Checking a code is free and can be repeated.

**Consequences:** A quote is a preview. If someone else uses the coupon before you place the order,
the order still fails safely, and the website removes the coupon and tells the customer why.

### Decision 10: Search products in the browser

**Context:** Search should feel instant while typing.

**Options considered:** ask the server on every keystroke; filter the products the page has already
loaded.

**Choice:** The shop loads the whole catalogue (up to 100 products) and filters it in the browser.
The address bar is updated after a short pause so searches can be bookmarked.

**Why:** For a small catalogue this is the fastest and simplest option, with no request per key.

**Consequences:** With more than 100 products, search would have to move to the server (the API
already supports a `q` filter).

## 4. Transactions, concurrency and retries

**Checkout happens in one transaction, in this order:**

1. Mark the cart as checked out. Whoever does this first owns the cart.
2. Price every item at today's price.
3. If there is a coupon, mark it as used (only if it is still available).
4. Work out the discount and total, and compare with the total the client expected.
5. Reduce stock for each item, only if enough is left.
6. Charge the (fake) payment.
7. Save the order with its order number and idempotency key.

If anything fails, all of these steps are undone: the cart is open again, the coupon is unused and
the stock is unchanged.

**Example: two people buy the last unit.** Both see stock = 1. The first one's update saves. When
the second one tries, MongoDB sees the record has changed and retries it with fresh data. Now stock
is 0, so the second checkout fails with `INSUFFICIENT_STOCK`. One order, stock 0.

| What happens at the same time           | Result                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| The same checkout is retried many times | One new order (201); the others get the same order back (200)                   |
| Different checkouts of the same cart    | One succeeds; the others get `CART_ALREADY_CHECKED_OUT`                         |
| Different carts use the same coupon     | One succeeds; the others get `COUPON_ALREADY_REDEEMED` and nothing else changes |
| Many carts buy the last few units       | Exactly as many succeed as there are units; the rest get `INSUFFICIENT_STOCK`   |
| Two admins create coupons at once       | Never two coupons for the same milestone                                        |
| A cart is edited during its checkout    | One goes first; a late edit gets `CART_NOT_OPEN`                                |

All of these have tests that run against a real MongoDB replica set.

## 5. Money and rounding

- All amounts are whole paise; fields that hold money end in `Minor`.
- Line total = price × quantity. Subtotal = sum of lines.
- Discount = subtotal × percentage ÷ 100, rounded down, and never more than the subtotal.
- Total = subtotal − discount. Example: ₹299.85 with 10% off gives a discount of ₹29.98 (not
  ₹29.99), and a 100% coupon gives a total of exactly ₹0.

## 6. Errors

Every error has the same shape: `{ "error": { "code", "message", "details" } }`. The `code` is
stable, so a client can react to it, and `details` carries useful data (for example which items are
out of stock). The HTTP status tells the client who can fix it:

- **400** the request is malformed
- **402** the payment was declined
- **404** something does not exist
- **409** the request is fine but the current state does not allow it (out of stock, price changed,
  coupon already used, cart already ordered, no reward due)
- **422** the request makes no sense (empty cart, key reused for a different request)
- **500** an unexpected error; details are logged, never shown to the client

## 7. What is built and what is left out

**Backend:** products with seed data; carts; idempotent checkout in one transaction; coupons with
milestones, admin generation and an optional automatic mode; checkout quote and public rewards
list; order snapshots; admin order list; sales report; paginated lists; OpenAPI docs; Docker setup;
tests for concurrency, retries, coupons, quotes, the report, carts and money.

**Client (optional in the brief):** a small shop that shows the backend working: search and
filters, cart with quantity controls, checkout with coupons and a confirmed discount, order
receipt, and a Rewards page with an admin "Generate reward" button. Tested with unit tests and
Playwright browser tests.

**Left out on purpose:** login and permissions (admin routes are only separated by their path);
coupon expiry and minimum order values; stock reservations; real payments; expiry of idempotency
keys; rate limiting; multiple currencies; returns and cancellations; product management.

## 8. Running on several servers and at scale

- **Several servers:** nothing is kept in the app's memory; all coordination happens in MongoDB, so
  more servers can be added without code changes.
- **Popular products:** many buyers of one product all update the same record, which causes
  retries. At scale, split that product's stock into several counters.
- **The order counter:** every order updates one shared counter. At scale, count orders in a way
  that does not depend on one record.
- **Idempotency keys:** make them expire after a day, and mark keys that are still being processed.
- **Real payments and emails:** create the order as "pending", then confirm it, and send events
  through an outbox.
- **Reports:** with many orders, keep running totals instead of recalculating everything.

**Biggest weaknesses today:** the shared order counter and very popular products, which both cause
retries under heavy load.

## 9. AI usage

How I worked with AI (Claude Code):

1. **Requirements first.** I went through the brief myself and listed the functional and
   non-functional requirements before asking the AI for anything.
2. **Then a plan.** I wrote a build plan from those requirements.
3. **I changed the stack in that plan:** Fastify for the backend API, Vite + React for the
   frontend, and a single Makefile to run and test the whole stack.
4. **The AI worked from my plan.** I gave the plan to Claude Code to implement.
5. **I verified each commit** before moving on.
6. **Docs and tests.** I updated the docs and made Claude Code write tests for each feature,
   including concurrency and retry cases, rather than accepting code without them.
7. **UX review.** I reviewed the UX of every feature in the browser and asked for improvements.

Examples where I redirected the AI's output:

- One revised plan switched the project to plain JavaScript; I rejected it and kept TypeScript for
  type safety.
- A UI spec I used asked for a "points" system the backend does not have. When the AI flagged
  this, I chose to show rewards as the real coupons the backend issues, so the UI never promises a
  discount the API would not give.
- After testing, I found that orders did not create rewards by themselves. That led to the
  "Generate reward" admin button and the optional `REWARD_AUTO_GENERATE` setting (decision 5).
- From my UX review: the Add to cart button moved off the product photo, the quantity stepper
  became compact, minus on the last unit now removes the item, and reward codes are confirmed
  (with the exact saving) before the order is placed.

## 10. What I would look at next with two more hours

1. **A load test on one popular product**, to see how slow checkouts get when many people buy it
   at once.
2. **Expiring idempotency keys**, and telling apart "still processing" from "lost".
3. **Stock reservations** that expire, so an item cannot sell out while it sits in a cart.
4. **Random-input tests for money**, checking that the discount is never more than the subtotal.
