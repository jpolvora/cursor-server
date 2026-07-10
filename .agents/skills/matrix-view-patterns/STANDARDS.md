# Deprecated — not used in cursor-server

> This file is legacy from a React SPA project. See [SKILL.md](SKILL.md). Do not load for API work.

# Matrix view patterns — project standards (legacy)

Living registry for UI/API conventions. **Append here** when the team locks a new repeated pattern; agents read this after [SKILL.md](SKILL.md). Detail: [BREADCRUMBS.md](BREADCRUMBS.md), [CHECKLISTS.md](CHECKLISTS.md).

## Reference implementations

| Feature | Route | Hash module | List | Form | API list |
|---------|-------|-------------|------|------|----------|
| Members | `/admin/members` | `admin/membersHash.ts` | `AdminMembersListView` | `AdminMemberFormView` | `GET /api/v1/members?q&cursor&limit` |
| Plans | `/admin/plans` | `admin/plansHash.ts` | `AdminPlansListView` | `AdminPlanFormView` | `GET /api/v1/plans` |
| Platform companies | `/platform/companies` | `platform/companiesHash.ts` | `PlatformCompaniesListView` | `PlatformCompanyFormView` | `GET /api/v1/platform/companies` |
| Platform users | `/platform/users` | `platform/usersHash.ts` | `PlatformUsersListView` | `PlatformUserFormView` | `GET /api/v1/platform/users` |
| Withdraw queue | `/admin/withdraw` | — (single page) | inline list | — | `GET /api/v1/admin/withdraw-requests` |
| Payment proofs | `/admin/payment-proofs` | — | page-level list | — | `GET /api/v1/admin/payment-proofs` |
| Ledger | `/admin/ledger` | — | filters + list | — | `GET /api/v1/admin/ledger` |

Use **members** or **plans** as the default template for new admin CRUD. Use **platform companies** for global-admin CRUD.

## Member slug (display identity)

| Concern | Convention |
|---------|------------|
| DB | `company_members.Slug`, unique per `(CompanyId, Slug)`; assigned on create via `MemberSlugAssignment` from email |
| API | DTO field `slug` / `memberSlug`; tree uses `patrocinadorSlug` / `posicaoPaiSlug`; `GET .../members/{memberKey}` accepts slug or GUID |
| UI | Show slug in tree grid/popup, admin lists, withdraw/ledger lines; tree URLs `/tree/{slug}` |
| Avoid | Member/user GUID in user-visible copy unless explicitly requested |

## UI components (reuse)

| Need | Component | Path |
|------|-----------|------|
| Surface | `Card` | `web/src/components/ui/Card.tsx` |
| Primary / secondary actions | `Button` | `web/src/components/ui/Button.tsx` |
| Icon row actions | `IconActionButton` + `icons` | `web/src/components/ui/` |
| Fields | `TextInput` | `web/src/components/ui/TextInput.tsx` |
| Cursor footer | `LoadMoreButton` | `web/src/components/ui/LoadMoreButton.tsx` |
| Cursor state | `useCursorList` | `web/src/hooks/useCursorList.ts` |
| Shell / impersonation | `useShellData` | `web/src/hooks/useShellData.ts` |

## API list contract

```json
{ "items": [ ... ], "nextCursor": "<opaque>|null" }
```

- C#: `CursorPageDto<T>`, `ListPaging.DefaultLimit` / `MaxLimit`
- Cursor payload: `Matrix.Core.Pagination.CursorCodec`

## i18n

- Namespaces: `admin`, `platform`, `common` under `web/src/i18n/locales/{pt-BR,en-US}/`
- Parity test: `web` Vitest locale key tests (run `npm test` when adding keys)

## Non-CRUD screens (out of hash split)

| Kind | Examples | Notes |
|------|----------|-------|
| Tree | `/tree/me`, matrix cards | `web/src/components/matrix/`, `DESIGN.md` tree colors |
| Dashboard / wallet | `/dashboard`, `/wallet` | Widgets + embedded lists OK |
| Auth / public | `/login`, `/c/:slug/register` | No hash CRUD pattern |

---

## Breadcrumb & back navigation

**Rule:** Breadcrumbs always render in the **current view** (page content), never in `AppHeader`.

| Concern | Location | Reference |
|---------|----------|-----------|
| Crumb logic | `web/src/components/layout/navConfig.ts` → `getBreadcrumbs` | members, plans, companies, users, tree routes |
| View render | `web/src/components/layout/PageView.tsx` → `Breadcrumb.tsx` | above page content inside `AdminLayout` `<main>`; not in `AppHeader` |
| Record names for edit crumbs | `web/src/components/layout/AdminLayoutContext.tsx` | set on load, clear on unmount |
| Form back link | top of `{Feature}FormView.tsx` | `AdminMemberFormView`, `AdminPlanFormView`, `PlatformCompanyFormView` |
| Tree back | `MatrixTree` / `TreeNavPanel` | `MemberTreePage`, `PlatformTreePage`; `getMemberTreeNavBack` |
| i18n — trail | `common.breadcrumb.*` | both locales |
| i18n — back | `{admin\|platform}.{feature}.backToList` | e.g. `members.backToList`, `companies.backToList` |

### New hash CRUD feature

1. Add `getBreadcrumbs` branch (list / `#new` / `#<guid>` via `parseResourceHashForBreadcrumb`).
2. Wire hash in `Breadcrumb.tsx` for that pathname.
3. Add `breadcrumb.create*` / `breadcrumb.edit*` to `common.json` (pt-BR + en-US).
4. Form view: layout name setter + standardized back link to `{feature}Hash` list path.
5. Verify: list → create → edit crumbs; parent links; back link target; no stale name after navigation away.

### New static or nested route

1. Add `STATIC_CRUMB_KEYS` entry **or** pathname `match` branch in `getBreadcrumbs`.
2. Add `common.breadcrumb.*` label(s) in both locales.
3. If full-width / tree: set `navBackHref` / `navBackLabelKey` (or document why no back control).
4. Verify trail from dashboard/platform root through to the new page.

---

## Custom standards (add below)

### Breadcrumb placement (view, not topbar)
- **Always** render the trail in the current view content area via `PageView` / `Breadcrumb` — above `<h1>` or primary content.
- **Never** put breadcrumbs in `AppHeader` or other sticky shell chrome.
- Full-width tree routes: `PageView fullWidth`; crumbs get horizontal padding via `breadcrumbBarFullWidth`.
- Single-segment trails (e.g. home only): omit with `minCrumbs={2}`.

<!-- Example entry — duplicate and edit when locking a new pattern:

### Status badge column
- Use `MemberStatus` for member lifecycle; add `{Feature}Status.tsx` for new enums.
-->
