# ZorHire ATS Redux + RTK Query Architecture

This is an enterprise SaaS architecture design for ZorHire ATS. It is intentionally focused on the correct Redux/RTK Query separation, multi-tenant isolation, RBAC, and server cache design.

> Redux slices govern only client-side application state.
> RTK Query handles all server-side data fetching, caching, invalidation, and external integration state.

---

## 1. High level Redux architecture diagram

```text
React Component
      ↓
  useAppSelector / useAppDispatch
      ↓
            Redux Store
                  ├─ authSlice
                  ├─ tenantSlice
                  ├─ permissionSlice
                  ├─ subscriptionSlice
                  ├─ featureSlice
                  ├─ uiSlice
                  └─ notificationSlice

React Component
      ↓
  RTK Query Hook
      ↓
    baseApi / api slice
      ↓
  attach JWT + tenant headers
      ↓
  Express API
      ↓
  PostgreSQL / Redis / external integrations
```

This separates client state from cached server state.

---

## 2. Redux store responsibility map

### `authSlice`

Responsibilities:

- authenticated user principal
- accessToken (store client-side for immediate auth headers). Refresh tokens MUST be stored as HTTP-only secure cookies managed by the backend (do not persist refresh tokens in Redux).
- login/logout state
- session status: `active`, `refreshing`, `expired`, `loggedOut`
- refresh flow metadata (timestamps, last refresh attempt)

Example state:

```ts
{
      user: AuthUser | null,
      accessToken: string | null,
      isAuthenticated: boolean,
      sessionStatus: "active" | "refreshing" | "expired" | "loggedOut",
      lastAuthError: string | null,
}
```

Notes:

- Store only the short-lived `accessToken` and principal in client memory / Redux.
- Do NOT persist `refreshToken` in Redux or localStorage — use HTTP-only, secure cookies to limit XSS exposure.
- Clear auth-related state on logout, tenant switch, or session expiry.
- Do not store domain API results in `authSlice`.

### `tenantSlice`

Responsibilities:

- current tenant / company context
- active workspace or team context
- tenant-level configuration and organization metadata

Example state:

```ts
{
  tenantId: string | null,
  tenantName: string | null,
  tenantSettings: TenantSettings | null,
  activeWorkspace: WorkspaceContext | null,
}
```

Notes:

- This is tenant metadata used across the app.
- Attach `tenantId` and workspace headers to all RTK Query requests.
- Reset sensitive information on logout or tenant switch.

### `permissionSlice`

Responsibilities:

- RBAC frontend authorization model
- current role and permission set
- allowed action map
- permission load status

Example state:

```ts
{
  role: string | null,
  permissions: string[],
  allowedActions: Record<string, boolean>,
  permissionLoadStatus: "idle" | "loading" | "loaded" | "failed",
}
```

Notes:

- Manage permissions such as `candidate.create`, `billing.manage`, `user.invite`.
- Use selectors to derive permission decisions.
- Do not store page-specific or sidebar-specific behavior here.

### `subscriptionSlice`

Responsibilities:

- current subscription plan and status
- active feature limits
- usage thresholds and context
- platform owner bypass flag for route gate

Example state:

```ts
{
  activePlan: string | null,
  status: "active" | "pastDue" | "trial" | "expired" | "canceled" | null,
  isPlatformOwner: boolean,   // REQUIRED — ZorTech's own account bypasses the subscription gate
  featureLimits: FeatureLimits | null,
  usage: UsageSummary | null,
}
```

**CRITICAL — initial state must be `null` at the slice level (not an empty object):**

```ts
const initialState: SubscriptionState | null = null;
```

The route gate in `ProtectedRoute` checks `subscription !== null` before evaluating `active` and `isPlatformOwner`. If the initial state is an object (even `{ active: false }`), the gate will fire during cold boot before `authApi.me` responds, redirecting every user to `/pricing`. Starting as `null` preserves the existing "fail open while loading" behavior.

`setSubscription` replaces the entire slice value. `clearSubscription` resets it to `null`.

Notes:

- Do not store billing history, invoices, or payments.
- Use this slice for feature gating and entitlement decisions.
- `isPlatformOwner` must be populated from the `/auth/me` and `/auth/login` responses alongside `active` and `status`.

### `featureSlice`

Responsibilities:

- runtime feature flags and experiment toggles
- enablement separate from subscription entitlements
- UI-level gating for opt-in/preview features (e.g. AI resume parsing)

Example state:

```ts
{
      aiResumeParsing: boolean,
      vendorPortal: boolean,
}
```

Notes:

- Feature flags are orthogonal to subscription data. Keep them in a lightweight `featureSlice` that can be updated from server-provided flags or an admin UI.
- Do not store large rollout metadata in Redux; use a feature management service when necessary.

### `uiSlice`

Responsibilities:

- global UI preferences
- layout state and presentation controls
- modal and presentation-only state
- theme and command palette state

Example state:

```ts
{
      sidebarCollapsed: boolean,
      theme: "light" | "dark",
      globalModal: GlobalModalState | null,
      commandPaletteOpen: boolean,
}
```

Notes:

- Keep this focused on shared UI state only.
- Avoid storing fetched or domain-specific data here.

### `notificationSlice`

Responsibilities:

- global notification delivery and queue state (toasts, alerts, in-app messages)
- notification templates and last-seen markers
- rich notification types (system, integration, user-action)

Example state:

```ts
{
      queue: NotificationItem[],
      unreadCount: number,
      lastFetched: string | null,
}
```

Notes:

- Use `notificationSlice` for UI delivery state only; notification payloads referencing domain entities should be resolved via RTK Query when the user navigates to the entity.
- This makes it easy to surface system events (e.g., interview reminder) without duplicating domain caches.

// Integration connectors are not implemented in this repo; remove planned integration slices until connectors exist.

---

## 3. RTK Query API map

Use RTK Query for all API-driven server state. Create domain APIs aligned with backend resources, not UI pages.

### `authApi`

- `login`
- `refreshToken`
- `logout`
- `validateSession`

### `candidateApi`

- `getCandidates`
- `getCandidateById`
- `createCandidate`
- `updateCandidate`
- `deleteCandidate`

### `jobApi`

- `getJobs`
- `getJobById`
- `publishJob`
- `updateJob`
- `closeJob`

### `pipelineApi`

- `getPipelineStages`
- `moveCandidateStage`
- `updatePipelineStatus`

### `vendorApi`

- `getVendors`
- `getVendorById`
- `createVendor`
- `updateVendor`

### `companyApi`

- `getCompanies`
- `getCompanyById`
- `updateCompany`

### `analyticsApi`

- `getAnalyticsOverview`
- `getPerformanceMetrics`
- `getSourceReports`

### `billingApi`

- `getSubscriptionInfo`
- `getUsageLimits`
- `verifyPaymentStatus`

### `emailApi`

- `getEmailSettings`
- `sendTestEmail`
- `updateEmailConfig`

// Integration API endpoints (connectors) are not implemented in the current codebase; omit from immediate plan.

### `resumeApi`

- `parseResume`
- `getResumeById`
- `searchResumes`

// AI backend services are not present in the repository; AI analysis should be added only when a backend AI service exists.

// Dedicated audit API endpoints are not present as controllers in the repository; the DB contains audit tables but no audit controller was detected.

Notes:

- Domain APIs should align with backend business resources.
- Client state is only in Redux slices; server state is exclusively via RTK Query.
- Use shared `baseApi` configuration to attach tenant and auth headers.

---

## 4. Authentication flow

```text
User submits credentials
      ↓
React component calls authApi.login
      ↓
RTK Query receives JWT response
      ↓
authSlice updates user + accessToken + refreshToken
      ↓
permissionSlice loads RBAC metadata
      ↓
tenantSlice loads current tenant context
      ↓
RTK Query APIs become tenant-aware
```

Critical behavior:

- `authSlice` is the single source of truth for JWT state.
- After login, permission and tenant context must load before full app access.
- Token refresh and session expiration should be handled centrally in `baseApi`.
- Failed auth should clear sensitive state and reset tenant/permission state.

---

## 5. Tenant isolation flow

Tenant isolation is mandatory for a multi-tenant ATS.

### Tenant-aware request flow

```text
RTK Query hook
      ↓
baseApi middleware
  attach Authorization: Bearer <accessToken>
  attach X-Tenant-Id: <tenantId>
  attach X-Workspace-Id: <workspaceId>
      ↓
Express API
      ↓
Tenant-specific database and business logic
```

### Tenant switch / logout behavior

- On tenant switch:
  - reset `tenantSlice`
  - reset `permissionSlice`
  - clear RTK Query cache with `api.util.resetApiState()`
- On logout:
  - clear `authSlice`
  - clear `tenantSlice`
  - clear `permissionSlice`
  - purge tenant-sensitive persisted state
  - reset RTK Query cache

### Cache isolation strategy

- Tag caches with tenant-aware keys where appropriate.
- Invalidate all tenant-scoped queries when tenant changes.
- Prevent tenant A data from being visible to tenant B.

Example:

```ts
if (tenantIdChanged) {
  dispatch(tenantActions.clearTenant());
  dispatch(permissionActions.reset());
  dispatch(api.util.resetApiState());
}
```

---

## 6. Permission / RBAC flow

### Permission lifecycle

1. Auth success updates `authSlice`.
2. `permissionSlice` fetches roles and permissions.
3. Derived selectors compute allowed actions.
4. UI and route guards consume these selectors.

### Example permission keys

- `candidate.create`
- `candidate.delete`
- `job.publish`
- `billing.manage`
  -- `user.invite`

---

## 7. Detailed implementation map (repo-aligned)

This section gives concrete, implementable guidance tailored to this repository (backend routes and frontend callers found during repo exploration). It avoids proposing features the codebase doesn't contain.

High-level rules:

- Keep domain data in RTK Query; keep UI/ephemeral metadata in slices.
- Use `createEntityAdapter` for large collections (candidates, jobs, vendors) to simplify updates and selectors.
- Use tenant-aware tags and `api.util.invalidateTags()` to coordinate cache updates after mutations.

  7.1 Frontend folder & naming conventions

- `frontend/src/store/slices/` — UI-only slices (`authSlice`, `tenantSlice`, `uiSlice`, `featureSlice`, `notificationSlice`, `permissionSlice`).
- `frontend/src/store/api/` — RTK Query `baseApi.ts` and domain APIs (e.g., `candidateApi.ts`, `jobApi.ts`, `vendorApi.ts`, `emailApi.ts`, `resumeApi.ts`, `billingApi.ts`).
- `frontend/src/features/<domain>/` — domain-specific components that import the RTK Query hooks.

  7.2 baseApi configuration

- Use `fetchBaseQuery` with a `prepareHeaders` that attaches `Authorization` and `X-Tenant-Id` / `X-Workspace-Id` headers from `authSlice` and `tenantSlice` selectors.
- Centralize retry logic, 401 -> token refresh handling, and global error transform in `baseApi`.

Example behavior (pseudocode):

```
prepareHeaders = (headers, { getState }) => {
      const token = selectAccessToken(getState());
      const tenant = selectTenantId(getState());
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (tenant) headers.set('X-Tenant-Id', tenant);
      return headers;
}
```

7.3 Entity adapters (recommended)

- `candidatesAdapter = createEntityAdapter<Candidate>({ selectId: (c) => c.id })`
- Use `getSelectors()` from adapters for component-friendly selectors: - `selectAllCandidates`, `selectCandidateById`
- Store minimal UI flags per-entity in `uiSlice` (selected rows, temporary selections) rather than in normalized entities.

  7.4 RTK Query API → backend route mapping (concrete)
  Note: routes shown are the repository's existing endpoints discovered in backend code and CODEBASE_GUIDE.

- `resumeApi` - `parseResume(file: FormData)` → POST `/v1/parse/resume` (multipart/form-data) — returns parsed resume JSON. - `parseVendor(file: FormData)` → POST `/v1/parse/vendor` - `parseJobDescription(file: FormData)` → POST `/v1/parse/job` or `/v1/parse/jd` (check `parse.routes.ts`)

- `candidateApi` - `getCandidates({ page, q, filters })` → GET `/v1/candidates` - `getCandidateById(id)` → GET `/v1/candidates/:id` - `createCandidate(form)` → POST `/v1/candidates` - `updateCandidate(id, patch)` → PATCH `/v1/candidates/:id` - `deleteCandidate(id)` → DELETE `/v1/candidates/:id`

- `jobApi` - `getJobs()` → GET `/v1/jobs` - `getJobById(id)` → GET `/v1/jobs/:id` - `createJob(form)` → POST `/v1/jobs` - `updateJob(id, patch)` → PATCH `/v1/jobs/:id` - `publishJob(id)` → POST `/v1/jobs/:id/publish` (or PATCH `status`)

- `vendorApi` / `companyApi` - `getVendors()` → GET `/v1/vendors` - `getVendorById(id)` → GET `/v1/vendors/:id` - `createVendor` / `updateVendor`

- `emailApi` - `getEmailConfig()` → GET `/v1/email/config` - `saveEmailConfig(payload)` → POST `/v1/email/config` - `removeEmailConfig()` → DELETE `/v1/email/config` - `testEmailConfig()` → POST `/v1/email/config/test` - `sendSingleEmail(payload)` → POST `/v1/email/send-single` - `listCampaigns()` → GET `/v1/email-campaigns` - `createCampaign()` → POST `/v1/email-campaigns` - `sendCampaignById(id)` → POST `/v1/email-campaigns/:id/send`

- `billingApi` - `getSubscriptionInfo()` → GET `/v1/billing/subscription` (or `/v1/billing`) - `getUsageLimits()` → GET `/v1/billing/usage`

  7.5 RTK Query tags & invalidation strategy

- Use tags per-entity: `['Candidates', 'Candidate', 'Jobs', 'Job', 'Vendors', 'Vendor', 'Resumes', 'EmailCampaigns', 'Billing']`.
- Query endpoints should `providesTags: (result) => [{ type: 'Candidates', id: 'LIST' }, ...result.map(c=>({ type:'Candidate', id:c.id }))]`.
- Mutations should `invalidatesTags: ['Candidates']` or specific entity tags for targeted invalidation.

Examples:

- After `createCandidate` — invalidate `['Candidates']` so `getCandidates` refetches.
- After `updateCandidate(id)` — invalidate `[{ type: 'Candidate', id }]`.

  7.6 Pagination, search, and cache keys

- For paginated lists include `page` and `filters` in the cache key (RTK Query handles this automatically when args are used).
- For search (resume search) use a `search` endpoint that returns `{ results, page, totalPages }` and provide a `providesTags` mapping to the returned ids.

  7.7 Optimistic updates and error rollback

- Use optimistic updates sparingly for user actions with instant UI feedback (e.g., marking a candidate as favorite, moving a pipeline stage). Pattern: 1. In mutation hook, `onQueryStarted` apply `updateQueryData` to modify cached list. 2. Capture undo via `patchResult.undo()` in catch to rollback on error.

  7.8 File uploads (resume / JD / vendor parse)

- Use `FormData` and `fetchBaseQuery` with `body: formData` for `parseResume` mutation. Do NOT JSON.stringify file contents.
- Because parsing returns derived structured data, the flow should be: 1. User uploads file via `AddCandidateModal` → call `resumeApi.parseResume(formData)`. 2. On success, open candidate create form prefilled with parsed response. 3. Do not cache raw file bytes in Redux; store parsed JSON only if user saves the candidate.

  7.9 Email campaigns: background send & polling

- Campaigns may take time to send. Use a `getEmailCampaignById` query and poll it (`refetchOnReconnect` / `refetchOnMountOrArgChange`) or implement a small polling loop in the UI.
- Use `providesTags: ['EmailCampaigns']` so status changes can be reflected after server-side send completes.

  7.10 Resume search & large result sets

- Resume search is heavy; RTK Query endpoints should support server-side pagination and filters (source, experience, location, skills).
- Use cursor or page-based pagination and avoid storing full result sets in Redux; rely on RTK Query cached pages.

  7.11 Error handling and retry

- Implement global error transformation in `baseApi` to normalize backend errors to `{ status, message, code }`.
- For transient network errors use exponential backoff with limited retries for non-destructive GETs.

  7.12 Security and data hygiene (practical)

- Never store refresh tokens in Redux or localStorage.
- On tenant switch or logout, call `dispatch(api.util.resetApiState())` and clear all sensitive slices.
- For exported CSVs or downloads, stream from the backend using authenticated presigned URLs rather than embedding binary data in Redux.

  7.13 Mapping to repo artifacts (where to look)

- Parse controllers: [backend/src/modules/parse/parse.controller.ts](backend/src/modules/parse/parse.controller.ts) — routes: `/v1/parse/resume`, `/v1/parse/vendor`, `/v1/parse/job`.
- Email controller: [backend/src/modules/email/email.controller.ts](backend/src/modules/email/email.controller.ts) — configs, send, campaigns.
- DB schema for candidate `source` values (linkedin/indeed/naukri/etc.): [backend/src/db/schema.sql](backend/src/db/schema.sql#L179).
- Frontend resume search store (current Zustand): [frontend/src/store/resumeSearchStore.ts](frontend/src/store/resumeSearchStore.ts#L1)

  7.14 Backwards-compatibility with existing Zustand store

- Migrate incrementally: keep `resumeSearchStore.ts` in place, add `resumeApi` and switch pages to use the RTK Query hooks one-by-one (feature flag the switch if needed).

---

## 8. Next steps (implementation checklist)

- Create `frontend/src/store/api/baseApi.ts` with tenant-aware headers and centralized error handling.
- Implement `frontend/src/store/api/resumeApi.ts` and `emailApi.ts` first (they map to well-defined backend controllers).
- Replace `resumeSearchStore` usage in `ResumeSearchPage.tsx` incrementally with `resumeApi.search`.
- Add `createEntityAdapter` for `candidates` and `jobs` and wire selectors into pages.

If you'd like, I can now:

- implement `baseApi.ts` and `resumeApi.ts` (create TS files), or
- just update the MD further with sample `baseApi` and `resumeApi` code snippets (no files created).

### Client-side authorization rules

- derive `canCreateCandidate`, `canViewBilling`, `canManageUsers`
- hide or disable UI elements based on permissions
- protect routes using permission selectors

Notes:

- Sidebar labels are presentation, not authorization boundaries.
- Permission slice should not store UI route status or page-specific behavior.

---

## 7. API caching flow

RTK Query is responsible for caching and invalidation.

### Recommended tag model

- `Candidate`, `CandidateList`
- `Job`, `JobPipeline`
- `PipelineStage`
- `Vendor`, `VendorList`
- `Company`
- `Analytics`
- `Subscription`
- `EmailSettings`
- `Tenant`

### Invalidation patterns

- `createCandidate` invalidates `CandidateList`
- `updateCandidate` invalidates `Candidate` and `CandidateList`
- `deleteCandidate` invalidates `CandidateList`
- `publishJob` invalidates `Job` and `JobPipeline`
- `moveCandidateStage` invalidates `JobPipeline` and stage queries
  // Integration connectors (publish/sync) are not implemented in the codebase; omit integration invalidation patterns until connectors exist.

### Tenant-sensitive cache handling

- Use `providesTags` and `invalidatesTags` consistently.
- When tenant context changes, call `api.util.resetApiState()`.
- Avoid cross-tenant caching by including tenant identifiers in request meta where necessary.

### Cache refresh example

```text
candidate added
      ↓
invalidate CandidateList
      ↓
RTK Query automatically refetches candidate list
```

---

// External connector guidance removed — repository contains UI references to sources and DB fields but no connector controllers.

---

## 8a. Route Gate Preservation (MUST NOT be dropped during migration)

`App.tsx` contains three layered gates inside `ProtectedRoute`. All three must survive the Redux migration intact. This section documents what each gate does, where its data comes from in the current codebase, and what it must read from Redux after migration.

### Current gate code (App.tsx lines 34–76 — do not change the logic, only the data sources)

```tsx
// Gate 1: force password change
if (user.must_change_password) {
  return <ChangePasswordPage />;
}

// Gate 2: vendor_user path restriction
const VENDOR_ALLOWED_PREFIXES = ["/jobs", "/pipeline"];
if (user.role === "vendor_user" && path) {
  const allowed = VENDOR_ALLOWED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/")
  );
  if (!allowed) return <Navigate to="/jobs" replace />;
}

// Gate 3: subscription gate
const SUBSCRIPTION_EXEMPT_PATHS = ["/pricing", "/subscription", "/onboarding"];
const isSubscriptionExempt = path
  ? SUBSCRIPTION_EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + "/"))
  : false;

if (
  !isSubscriptionExempt &&
  subscription !== null &&        // fail open while loading
  !subscription.active &&
  !subscription.isPlatformOwner  // ZorTech account always passes
) {
  return <Navigate to="/pricing" replace />;
}
```

### Data source mapping: before → after Redux

| Gate | Current source | Redux source after migration |
|---|---|---|
| `user.must_change_password` | `useAuth().user` | `useAppSelector(selectCurrentUser)?.must_change_password` |
| `user.role === "vendor_user"` | `useAuth().user` | `useAppSelector(selectUserRole) === "vendor_user"` |
| `subscription !== null` | `useAuth().subscription` | `useAppSelector(selectSubscription) !== null` |
| `subscription.active` | `useAuth().subscription` | `useAppSelector(selectSubscription)?.active` |
| `subscription.isPlatformOwner` | `useAuth().subscription` | `useAppSelector(selectSubscription)?.isPlatformOwner` |
| `loading` (gate suspended) | `useAuth().loading` | `useAppSelector(selectSessionStatus) === "idle"` |

### `isPlatformOwner` must be in the login and me responses

The backend `/auth/login` and `/auth/me` both return a `subscription` object. That object must include `isPlatformOwner: boolean`. When `authApi.login` and `authApi.me` dispatch `setSubscription`, they must pass the full object including `isPlatformOwner`. Do not drop this field during the RTK Query endpoint definition.

### Sequencing in `authApi.me` on cold boot

The correct `onQueryStarted` dispatch order on a successful `me` response:

```ts
// 1. Populate subscription FIRST (gate reads it)
dispatch(setSubscription(data.subscription ?? null));
// 2. Populate user
dispatch(setCredentials({ user: data, token: existing }));
// 3. Only then mark session active (unblocks loading spinner)
dispatch(setSessionStatus("active"));
```

If step 3 fires before step 1, `ProtectedRoute` unmounts the loading spinner with `subscription` still `null`. Since `null` means fail-open, the user briefly sees the app, then the subscription populates and potentially redirects them. For clean UX, all slice data must be populated before session status becomes `"active"`.

### Phase 2 checklist for App.tsx migration

When Phase 2 rewires `ProtectedRoute` to read from Redux, tick all of these before shipping:

- [ ] `loading` reads `sessionStatus === "idle"` — not any other status value
- [ ] Gate 1 (`must_change_password`) preserved, reads from `selectCurrentUser`
- [ ] Gate 2 (`vendor_user` restriction) preserved, reads from `selectUserRole`
- [ ] Gate 3 (`subscription !== null && !active && !isPlatformOwner`) preserved verbatim
- [ ] `SUBSCRIPTION_EXEMPT_PATHS` array (`/pricing`, `/subscription`, `/onboarding`) unchanged
- [ ] `VENDOR_ALLOWED_PREFIXES` array (`/jobs`, `/pipeline`) unchanged
- [ ] `subscriptionSlice` initial state is `null`, not `{ active: false }` or any object
- [ ] `setSubscription` called before `setSessionStatus("active")` in `authApi.me`
- [ ] `isPlatformOwner` field present in `subscriptionSlice` state type

### What breaks if the gate is dropped

- **Gate 3 dropped entirely:** Companies that signed up but have not subscribed (or whose subscription expired) get full platform access — no paywall.
- **`isPlatformOwner` missing:** ZorTech's own admin account gets redirected to `/pricing` on every page load since its subscription state may be configured differently.
- **Initial state `{ active: false }` instead of `null`:** Every authenticated user sees a `/pricing` redirect flash on page refresh until `me` resolves. On slow connections this could be a permanent redirect loop.
- **`setSessionStatus("active")` fires before `setSubscription`:** Same flash/redirect issue as above.

---

## 9. Recommended migration approach

1. Establish the client state foundation with `authSlice`, `tenantSlice`, `permissionSlice`, `subscriptionSlice`, and `uiSlice`.
2. Implement `baseApi` with JWT and tenant headers.
3. Add RTK Query domain APIs for server resources.
4. Migrate API-driven state from local stores/Zustand to RTK Query.
5. Keep Redux slices minimal and focused on metadata and UI state.
6. Persist only safe metadata:
   - `authSlice` (token context)
   - tenant preferences from `tenantSlice`
   - `uiSlice` settings such as theme and sidebar collapse
7. Do not persist domain query caches or fetched server data.
8. On logout or tenant switch, clear sensitive client state and reset RTK Query.

---

## 10. Things NOT to put in Redux

- candidates, jobs, pipelines, analytics, reports from server fetches
- page-based or route-based slices
- billing history, invoices, payment details
- large server query results
- external sync payloads beyond integration status
- RTK Query cached entities
- sidebar item state used only for navigation
- tenant-specific cached domain data across sessions

---

## Additional enterprise considerations

- Treat sidebar navigation as presentation, not slice ownership.
  -- Model slices around application state, auth, tenant context, permissions, and UI.
- All domain data should live in RTK Query, not Redux slices.
- Real-time WebSocket support is not implemented in this repository; omit socket middleware until server support is added.

// WebSocket real-time guidance removed — no socket implementation found in the repository.

### Error handling

Use a central `baseApi` error handler for:

- `401 Unauthorized`
- `403 Permission denied`
- `429 Rate limit`
- `500 Server error`
- `Subscription expired`
- `Tenant disabled`

Handle globally with:

- token refresh for 401s when possible
- redirect to login or tenant issue screens
- global notifications for rate limits and errors
- cache reset on tenant disable
