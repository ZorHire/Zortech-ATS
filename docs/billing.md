# Billing: per-user plans, renewal and blocking

ZorHire is sold per user per month through Razorpay. This page covers how a company is
charged, what happens at renewal, and what happens when a plan isn't renewed.

## How much a company pays

- **Seats** = active staff users (super_admin, accounts_manager, recruiter,
  vendor_manager), but at least the plan's minimum. Vendor and client portal users are free.
- **Price** = per-user price × seats × months (1 for monthly, 12 for yearly).

| Plan | Users | Monthly (₹ per user) | Yearly (₹ per user per month) |
|---|---|---|---|
| Starter | 5–25 | 4,333 | 3,683 |
| Growth | 26–150 | 5,416 | 4,604 |
| Enterprise | 150+ | Contact sales (list 6,189) | Contact sales (list 4,951) |

Prices live in `PLANS` in `backend/src/modules/billing/billing.controller.ts`.

- A company with more staff than a plan allows can't buy it ("choose a bigger plan").
- Enterprise can't be bought online. `subscribe` returns 400 `CONTACT_SALES`.
- The pricing page shows "N users × ₹X" and the total. Before Razorpay opens, a
  confirmation dialog shows the breakdown.
- If the total changed since the page loaded (someone was added), checkout returns 409
  `QUOTE_CHANGED` and the page refreshes the price. Nothing is sent to Razorpay.

Code: `backend/src/modules/billing/seats.ts` (`buildQuote`, `countStaffUsers`), endpoints
`GET /v1/billing/quote`, `POST /v1/billing/subscribe`.

## Paying and activating

1. `subscribe` creates a Razorpay order and stores a pending `payment_transactions` row
   with the plan, cycle, seats and per-user price.
2. After payment, the browser calls `verify-payment` with Razorpay's signature.
3. As a backup, Razorpay's **webhook** (`payment.captured` / `order.paid`) does the same,
   for customers who close the browser before step 2 finishes.

Both go through one function, `activateOrder`:
- The plan, cycle and seats come from the stored order, never from the request body.
- It is idempotent: an order that is already captured changes nothing. A webhook retry,
  or a webhook followed by the browser, never extends the plan twice.
- Renewing before the end date adds the new period on top of the days left.
- It records `subscriptions.seats`, which also sets the company's AI allowances
  (see [ai-allowances.md](ai-allowances.md)).

**Users added mid-period** aren't charged until the next renewal or plan change, which
re-counts. The subscription page warns the admin when more staff are in use than were paid for.

## Renewal reminder and blocking

- In the last **7 days**, a renewal popup opens on its own once a day. Admins get
  "Renew now" / "Remind me tomorrow"; other staff are asked to tell their admin.
- The moment the end date passes (no grace period), staff are blocked:
  - The app shows "Your company's ZorHire plan has ended". Admins can still open
    `/subscription` and `/pricing` to pay, and paying unlocks the team at once.
  - The API returns 402 `SUBSCRIPTION_EXPIRED` for staff, except for `/auth`, `/billing`,
    `/onboarding`, `/profile` and `/notifications`. It can take up to a minute to start.
  - AI actions and Autopilot stop for that company.
- A cancelled plan keeps working until the paid period ends.
- Not blocked: vendor and client portal users, and ZorTech's own company.
- A nightly job (00:05) marks lapsed plans `expired`.

Code: `modules/billing/subscriptionAccess.ts`, `middleware/subscription.ts`,
`components/subscription/RenewalReminder.tsx`, `PlanEndedScreen.tsx`.

## Refunds

Only ZorTech (super_admin or accounts_manager of the platform-owner company) can refund:
`POST /v1/billing/refund` with `{ payment_id, amount? (₹; omit for full), notes? }`.
Customers ask ZorTech. A full refund marks the payment `refunded`; a partial refund is
noted on the payment. A refund doesn't end the plan by itself. Cancel it separately if needed.

## Setup (server `.env`)

```bash
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

In the Razorpay dashboard → Webhooks, add
`https://zorhire.zortechs.in/v1/billing/razorpay-webhook` with the events
`payment.captured` and `order.paid`, using the same webhook secret.

## Existing customers

Plans bought before seat billing have no seat count. They keep working, and the
UI falls back to the old display. At their next renewal they're charged per seat, which is
a big jump from the single-user price they paid before, so tell them before then.

## Not tested yet

The real Razorpay checkout hasn't been run end to end (no test keys yet). Before taking
live payments, do one payment with Razorpay test keys, and confirm the account's
per-payment limit covers a large Growth yearly order.
