# Monthly AI allowances

Claude-powered actions cost real money per use, while customers pay a fixed monthly
price. Each plan therefore includes a number of AI actions per user per month,
shared by the whole company. Customers see actions, not tokens or dollars.

## What is counted

| Allowance | One action is | Re-runs |
|---|---|---|
| AI shortlisting | one candidate assessed for one job (Autopilot or "Run now") | same application this month: free |
| AI screening interviews | one screening interview sent, including all its chat turns and the evaluation | an interview a candidate has started always finishes |
| AI client profiles | one profile written for a client ("Create with AI") | rewriting the same one this month: free |
| LinkedIn agent | one LinkedIn person scored with a personal note | over the limit, people get the keyword score and template note instead |

Gemini features (resume and JD parsing, summaries, the pipeline's "Run AI
shortlisting" scorer, outreach drafts, interview kits, search) cost very little
and are not counted.

## Allowances

Set in `backend/src/services/aiAllowance.ts` (`PLAN_ALLOWANCES`, `TRIAL_ALLOWANCE`):

| Per user per month | Starter | Growth | Enterprise |
|---|---|---|---|
| AI shortlisting | 0 | 150 | 200 |
| AI screening interviews | 0 | 30 | 40 |
| AI client profiles | 10 | 20 | 30 |
| LinkedIn agent | 100 | 300 | 400 |

- **Company total:** the per-user number × the **seats the company paid for**
  (`subscriptions.seats`, see [billing.md](billing.md)). Users added during the period
  don't raise the allowance until they're paid for at the next renewal. Plans bought
  before seat billing have no seat count yet; for those, users = active staff accounts
  (not vendor or client portal users), but at least the plan's minimum (5 / 26 / 150).
- **Plan ended:** no AI actions once the plan's end date passes (the same moment staff
  are blocked). A cancelled plan keeps its allowance until the paid period ends.
- **Free trial:** a fixed pool for the company: 50 / 10 / 10 / 100.
- **Unlimited:** ZorTech's own company (`tenants.is_platform_owner`).
- **Reset:** the 1st of each month, India time.

At today's Claude Opus 5.5 rates, a Growth user who uses every allowance in full costs
about ₹1,600 a month in AI (about 30% of the plan price). Typical use is much lower.
Moving shortlisting and screening chats to a cheaper model lowers this a lot; then
these numbers can go up.

## When an allowance runs out

- **Autopilot:** stops picking up new candidates for that step. They're picked up
  again after a top-up or on the 1st. A task that hits the limit is put back, not failed.
- **Recruiter buttons:** "Run now", "Send screening invite" and "Create with AI" get a
  402 with `code: "ai_allowance_exceeded"` and a message the app shows as is.
- **Admin alerts:** super admins and accounts managers get an in-app alert at 80% and
  at 100% of each allowance (once per month each). The Windows app shows these as
  desktop alerts.
- **Usage page:** everyone on the team can see usage under Settings → AI usage, and
  the AI agents and LinkedIn agent pages show a banner from 80%.

## Top-ups

A super admin of ZorTech's own company can add actions to a customer's allowance for
the current month (for example after the customer buys an add-on pack):

```
POST /v1/ai-usage/topups
{ "tenant_id": "<company id>", "meter": "screenings", "units": 100, "note": "Add-on pack, invoice 123" }
```

There is no screen for this yet, and no self-serve purchase.

## Dollar safety caps

The per-agent monthly dollar caps in `modelRouter.ts` still apply as a safety net. For
the agents above they now grow with the company's allowance (allowance × the highest
expected cost of one action, `MAX_USD_PER_ACTION`), so a large customer is limited by
its allowance, not by a cap sized for a small one.
