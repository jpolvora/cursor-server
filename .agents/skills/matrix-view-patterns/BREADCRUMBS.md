# Matrix view patterns — breadcrumbs & back navigation

Load with [SKILL.md](SKILL.md) when wiring new routes. **Every new view must keep the trail accurate** for list, create, edit, and nested routes.

## Placement rule (mandatory)

**Always render breadcrumbs into the current view** — inside scrollable page content, above the page title or primary content. **Never** in the sticky topbar (`AppHeader`).

| Do | Don't |
|----|-------|
| `PageView` → `Breadcrumb` in `AdminLayout` `<main>` (default for all authed routes) | Crumbs in `AppHeader`, sidebar, or floating chrome |
| Full-width routes: `PageView fullWidth` + `breadcrumbBarFullWidth` padding | Second breadcrumb row in header to “save space” |
| Routes outside `AdminLayout`: embed `<Breadcrumb />` at top of the page component | Assume shell header will show the trail |

Implementation stack: `PageView.tsx` → `Breadcrumb.tsx` → `getBreadcrumbs` in `navConfig.ts`. Hide single-segment trails with `minCrumbs={2}` on home/dashboard.

## Breadcrumb wiring (required for new routes)

| Route kind | What to update |
|------------|----------------|
| Hash CRUD (`/admin/foo`, `#new`, `#<guid>`) | `getBreadcrumbs` branch for pathname; pass hash from `Breadcrumb.tsx` (wired in `PageView`); edit crumb uses `useAdminLayout` name setter |
| Static single page | `STATIC_CRUMB_KEYS` in `navConfig.ts` |
| Nested / param route (e.g. tree) | New `pathname.match(...)` branch in `getBreadcrumbs`; pass contextual names via layout context |
| All new crumb labels | `common.breadcrumb.*` in **pt-BR and en-US** |

## Hash CRUD pattern

Mirror members / plans / companies / users:

1. In `{Feature}Page.tsx`, hash parsing stays in the page — breadcrumbs do not parse hash inside form/list.
2. In `Breadcrumb.tsx`, pass `{feature}Hash: pathname === '/…' ? hash : undefined` into `getBreadcrumbs`.
3. In `getBreadcrumbs`, use `parseResourceHashForBreadcrumb` → list (no extra segment), create (`breadcrumb.create*`), edit (`breadcrumb.edit*` + optional `label` from layout context).
4. On edit load, call the matching `setAdmin*Name` / `setPlatform*Name`; **clear in effect cleanup** when leaving the form so stale names do not leak into the next view.

## Navigation correctness

- Parent breadcrumb segments **link to the list path with no hash** (e.g. `/admin/members`, not the current `#<id>`).
- Invalid hash → list view **and** list-only breadcrumb (no create/edit segment).
- Last crumb is never a link; intermediate crumbs are links when `to` is set.
- Breadcrumb trail and in-view back target must describe the **same parent** (see back link below).

## Standard back link (form & detail views)

Use one pattern for hash CRUD forms — do **not** use `navigate(-1)` or ad-hoc paths.

```tsx
<p style={{ margin: '0 0 16px' }}>
  <Link to={FEATURE_LIST_PATH}>{t('feature.backToList')}</Link>
</p>
```

- `FEATURE_LIST_PATH` — list path constant from `{feature}Hash.ts` (empty hash).
- `feature.backToList` — under `admin` or `platform` namespace (both locales); text matches the list the user returns to.
- Place **above** `<h1>`; same spacing as members/plans/companies form views.

**Tree / full-width views** use `MatrixTree` + `TreeNavPanel`: pass `navBackHref` and `navBackLabelKey`. Reuse helpers when they exist (`getMemberTreeNavBack` for member trees; platform company tree → `/platform/companies` + `nav.companies`). Do not duplicate back markup outside `TreeNavPanel` on tree routes.

## Ship checklist

- [ ] List, create, and edit (if applicable) each show the correct crumb count and labels
- [ ] Clicking parent crumbs navigates to list (no hash)
- [ ] Edit crumb shows record name after load; name cleared on leave
- [ ] Form back link `to` matches breadcrumb parent path
- [ ] New `common.breadcrumb.*` keys added in pt-BR and en-US
- [ ] Plan / PR names reference feature + lists this checklist under UI deliverables
