# ZorHire design system

Brand: ZorTech orange `#F7911E` + navy `#1A4277` (from the company overview deck).
Logo files: `public/brand/` (`zortech-logo.png`, `zortech-logo-white.png`, `zortech-icon.svg`).

## Tokens (tailwind.config.js)

| Use | Class |
|---|---|
| Primary action, links, focus | `navy-600` (hover `navy-700`); Tailwind `blue-*` is aliased to navy |
| Accent / highlight (sparingly) | `brand-500` with **dark text** (`text-ink`); white on orange fails contrast |
| Body text / secondary text | `text-ink` / `text-muted` |
| Borders | `border-line` (stronger: `border-line-strong`) |
| Page background / cards | `bg-surface` / `bg-white` + `zh-card` |
| Status | `success-*`, `warning-*`, `danger-*` (50 bg, 600/700 text) |
| Fonts | `font-sans` = Inter (body), `font-display` = Poppins (h1-h3 automatically) |
| Radius | inputs/buttons `rounded-lg`, cards `rounded-xl`, modals `rounded-2xl`. Nothing larger. |

Don'ts: no arbitrary hex colours (`bg-[#…]`), no `font-black`, no 9–10px uppercase micro-labels
(use `text-xs font-medium text-muted`), no `alert()` / `window.confirm()`.

## Components (`import { … } from "../components/ui"`)

- `Button` — `variant`: primary | accent | secondary | ghost | danger | link; `size`: sm | md | lg;
  `loading`, `icon`. For `<Link>` styled as a button use `buttonClasses(variant, size)`.
- `PageHeader` — `title`, `subtitle`, `breadcrumbs`, `actions` (primary action last). Every in-app page.
- `Modal` — `open`, `onClose`, `title`, `footer`, `size`; Esc, focus trap, phone sheet built in.
  Forms: leave `closeOnBackdrop` false; pass `preventClose` while saving.
- `useConfirm()` — `if (!(await confirm({ title, message, danger: true, confirmText }))) return;`
- `useNotify()` (hooks) — success/error/info toasts. Never `alert()`.
- `DataTable` — columns + rows with loading / error / empty states and horizontal scroll.
- `EmptyState`, `ErrorState` (pass the RTK `error` + `onRetry`), `LoadingBlock`, `Skeleton`,
  `TableSkeleton`, `CardGridSkeleton`.
- `StatCard` — real numbers only; no invented trends.
- `Badge` (tones) and `StageBadge` (pipeline stage, from `lib/stages.ts`).
- Forms: `zh-label` + `zh-input` classes; show field errors under the input in `text-xs text-danger-600`.

## Page pattern

```tsx
<>
  <PageHeader title="Interviews" subtitle="…" actions={<Button icon={<Plus size={16} />}>Schedule</Button>} />
  <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    {isLoading ? <TableSkeleton /> : isError ? <ErrorState error={error} onRetry={refetch} /> : …}
  </div>
</>
```

Layout (`components/layout/Layout.tsx`) already provides the sidebar, top bar (notifications,
profile), page scrolling, a per-page error boundary and a loading skeleton for lazy pages.
