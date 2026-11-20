# Help section and help assistant

Everyone signed in to ZorHire can open **Help**:

- **Staff:** the **Help** menu item and the **Help** button in the top bar.
- **Vendor and client portals:** a **Help** item in the portal menu.

## What users get

- **Help topics** (`/help`, `/help/:slug`): short guides grouped by area, with search. Staff, vendor-portal and client-portal users each see only their own topics.
- **Aruna, the help assistant:** a chat panel that opens from the top bar on any page, and also appears on the Help page. Aruna is a female persona, set in the system prompt; she introduces herself by name, uses feminine first-person forms in Hindi, and says she is an AI if asked.
  - It answers "how do I…" questions from the help topics only, in the user's language.
  - It names the exact buttons and links to the right page and guide.
  - It says when it doesn't know, and shows the support email if `HELP_SUPPORT_EMAIL` is set.
  - It can't see company data or change anything.
- **Feedback:** each answer has thumbs up/down.

## How it works

| Piece | Where |
|---|---|
| Help articles (Markdown with a small header: title, category, audience, summary, keywords, order) | `backend/src/modules/help/articles/*.md` |
| Loader, keyword search, allowed in-app links | `backend/src/modules/help/articles.ts` |
| Assistant (Claude Haiku 5.5, effort `low`, structured output) | `backend/src/modules/help/assistant.ts` |
| API: `GET /v1/help/articles[?q=]`, `GET /v1/help/articles/:slug`, `POST /v1/help/ask`, `POST /v1/help/questions/:id/feedback` | `backend/src/modules/help/help.routes.ts` |
| Question log (rate limit, feedback, gaps in the docs) | `help_questions`, migration `026_help_assistant.sql` |
| UI | `frontend/src/pages/HelpPage.tsx`, `frontend/src/components/help/*` |

- **Prompt and caching:** the rules plus every article for the user's audience form the system prompt. It is cached, so each question pays only for its own text. The staff prompt is about 10k tokens. The user's role, plan and current page go in the question.
- **Checking the answer:** articles and links in the answer are checked against the real lists, and anything else is dropped. Links can only point to ZorHire pages.
- **Limits:** 60 questions per user per day. A question can be up to 1,000 characters, with the last 10 messages sent as history.
- **Cost:** the agent is `help_assistant` in `modelRouter.ts` and runs on **Claude Haiku 5.5**. A question costs about $0.001 (₹0.05–0.15), or about ₹3 per user a month at 2 questions a day. A hard cap of **$2 a month per company** (about 3,000 questions) keeps it near zero; once the cap is reached, the company gets the keyword-search answers until the 1st. It isn't counted in the AI allowances.
- **Upgrading later:** change the model in `modelRouter.ts` (for example `claude-sonnet-5-5` or `claude-opus-5-5`) and raise the cap. Haiku has no server-side refusal fallback, so `claudeClient.ts` doesn't send `fallbacks` for Haiku models; a declined question gets the keyword-search answer.
- **Without Claude:** with no key, or when the cap is reached, the assistant answers with the closest articles by keyword search.

## Keeping it accurate

The articles are the assistant's only source of truth. When a feature changes, update its article: the Help page and the assistant both change with it, after a redeploy.

To see what users struggle with, look at:

```sql
SELECT question, answered, helpful FROM help_questions
WHERE unanswered OR helpful = false ORDER BY created_at DESC;
```

The Docker build copies the `.md` files next to the compiled code, alongside the SQL migrations.

## Known gaps the articles avoid promising

- **Campaigns:** "Schedule for later" sends immediately.
- **Client users:** no screen to create client portal users.
- **Editing records:** no editing of jobs, clients or candidate details after creation.
- **Interview questions:** no interview question generator.
- **Report export:** CSV export may need the user's sign-in token.
