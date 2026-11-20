# LinkedIn agent and free job boards

Both features run through the **ZorHire Assistant** Chrome extension (`extension/`), inside the
recruiter's own Chrome where they are already signed in to LinkedIn and the job boards.
ZorHire never asks for, sees or stores LinkedIn or job-board passwords.

## Why an extension

LinkedIn has no public API for people search or connection requests, and Recruiter Lite has
no API at all. Logging in from a server with stored passwords gets accounts flagged (new
device, data-centre IP) and would make ZorHire hold other companies' LinkedIn passwords. The
extension works in the recruiter's real browser session instead, at a human pace.

## Setup (per recruiter)

1. **LinkedIn agent → Download ZorHire Assistant**, unzip, `chrome://extensions` → Developer
   mode → **Load unpacked** → pick the `zorhire-assistant` folder. (Chrome Web Store listing later.)
2. **Create connection code** in ZorHire, paste it into the extension popup. Only a SHA-256
   hash of the code is stored; codes can be revoked per browser.
3. Stay signed in to LinkedIn in that Chrome. The extension reports the account name,
   Premium, and whether Recruiter Lite is available (the user can override detection).

## LinkedIn campaigns

1. **New campaign** (or **Source on LinkedIn** on a job). With a job, Claude
   (`linkedin_search_builder`) writes the LinkedIn filters: keywords (boolean), title,
   locations, current/past companies, industries, schools, connection degree, languages,
   exclusions, plus a Recruiter Lite boolean + filter checklist. Without Claude a
   rule-based search is built from the job's skills and location.
2. **Start campaign.** The extension (every 30 s, in a pinned background tab):
   - looks up LinkedIn's ids for locations/companies/industries/schools via LinkedIn's
     typeahead, so the search uses LinkedIn's real filters;
   - runs the search (up to `max_pages` pages, 8–15 s apart) and imports the results;
   - running campaigns top themselves up once a day when the queue runs low.
   - Any LinkedIn filter not in the form: open the search in LinkedIn, refine it there and
     click **Add to ZorHire** on the results page (also works on Recruiter Lite pages).
3. Claude (`linkedin_prospect_scorer`) scores each person 0–100 from headline/location/snippet
   and writes a connection note (≤300 chars Premium, ≤200 free) and an InMail subject.
   Fallback without Claude: keyword-overlap score + template note.
4. The recruiter reviews: approve/skip, edit or rewrite notes, bulk-approve above a score.
   **Autopilot** (per campaign, off by default) approves everyone at or above the minimum score.
5. The extension sends approved invites through `/preload/search-custom-invite/?vanityName=`
   (Add a note → type → Send, only after checking the dialog is for that person), 2–5 minutes
   apart, Mon–Sat in working hours (set in the popup).
6. Once a day it checks recently added connections; accepted people become **Candidates**
   (source `linkedin`, `linkedin_url` set) and join the job's pipeline as **Sourced**.

### Safety rails

| Rail | Value |
|---|---|
| Per campaign | `daily_invite_limit` (1–40, default 15) |
| Per recruiter | 40 a day, 100 per rolling 7 days (below LinkedIn's own weekly limit) |
| Same person twice | Never: anyone already invited/queued from any campaign of the company is skipped |
| 1st-degree connections | Marked "already connected", never invited |
| LinkedIn "search paused" / security check | Recruiter's agent pauses 24 h, desktop notification |
| Weekly invitation limit hit | Pauses 72 h |
| Restriction warning | Pauses 7 days |
| Free-account note quota used up | Campaign continues without notes |
| "Enter their email to connect" | Marked "needs email", skipped |

Recruiter Lite campaigns don't send InMails automatically: the AI drafts subject + message
per person and the recruiter sends them in Recruiter Lite (30 InMails/month on Lite).

## Free job boards

On a job: **Post free** → tick boards → **Open in Chrome**. The extension opens each board's
post-a-job page in a "ZorHire job posts" tab group and shows a panel:
log in / create a free account (the recruiter does this), open the form, **Fill form**
(fills title, company, location, experience, salary, openings, skills, description, apply
email; never passwords; never clicks Post), copy buttons for anything not filled, then
**I've posted it** (saves the page link in ZorHire) or **Skip board**.

Boards (URLs checked 20 Nov 2026, `backend/src/modules/linkedin-agent/freeBoards.ts`):
LinkedIn Jobs, Indeed, Naukri free job posting, Unstop, HireMee, Internshala, apna, Cutshort,
Wellfound. Fresher boards aren't pre-selected for jobs needing more experience.
Paid API posting (existing **Publish to boards**) is unchanged.

## API

Recruiter (JWT): `/v1/linkedin-agent/*` (account, connect, campaigns, prospects, summary),
`/v1/free-job-boards/*`. Extension (connection code): `/v1/extension/*` (hello, work,
resolved, prospects import, next-invite, result, warning, acceptances, job-posts).
Tables: migrations `021_linkedin_agent.sql`, `022_job_board_assist.sql`.

## Limits of what was tested

The API was tested end to end on Postgres 17 (60 checks). The extension's LinkedIn page
scripts follow methods that worked by hand in Nov 2026, but LinkedIn and the job boards change
their pages without notice; the first real run should be watched, starting with one campaign
at a low daily limit. Using automation on LinkedIn is against LinkedIn's User Agreement even
at human pace; the rails above reduce, not remove, the risk of account restrictions.
