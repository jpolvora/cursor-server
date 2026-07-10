# Matrix view patterns — list, form, API checklists

Load with [SKILL.md](SKILL.md) when implementing list/form screens or list endpoints.

## List view

- **Data:** `useCursorList` + `apiFetch<CursorPage<T>>`; `PAGE_SIZE = 25` (match API default)
- **Search/filter:** `TextInput` above card; include filter values in `resetKey` so list refetches; pass `q` / status / date params to API
- **Rows:** CSS grid rows inside `Card` — `borderBottom: var(--color-hairline-on-dark)`, flex wrap, primary text + **action column** (`IconActionButton` / `Button`) for edit, view, tree, impersonate, etc.
- **States:** loading (`common:actions.loading`), error (trading-down color), empty (muted)
- **Footer:** `LoadMoreButton` when `hasMore`; wire `loadingMore` / `loadMore`
- **Navigation:** `navigate(editPath(id))` or `<Link to={editPath(id)}>`; create button → `#new`
- **i18n:** keys under `admin` or `platform` + `common`; add **pt-BR and en-US**; run `cd web && npm test` if keys added

## Form view

- Props: `memberId` / `planId` / `mode: 'create' | 'edit'` — no hash parsing inside form
- Load record in `useEffect` / `useCallback`; show loading/error; `key={id}` on page wrapper when switching records
- Actions: `Button`, `TextInput`, `Card`; confirm destructive actions inline (existing pages use simple confirm state)
- Breadcrumb: in-view only (`PageView` / `Breadcrumb`) — never `AppHeader`; see [BREADCRUMBS.md](BREADCRUMBS.md) § Placement rule
- Back: standardized back link — [BREADCRUMBS.md](BREADCRUMBS.md); list path from hash module
- Admin context: matching `useAdminLayout` name setter for edit breadcrumbs; clear on unmount

## API list endpoint

- Return `CursorPageDto<T>` with `Items` + `NextCursor` (JSON: `items`, `nextCursor`)
- Query: `cursor`, `limit` (default 25, max 100 via `ListPaging`), plus domain filters (`q`, `status`, `from`/`to`, `memberId`)
- Invalid cursor → `400` ProblemDetails (`ParamName == "cursor"`)
- Encode/decode cursors with `CursorCodec` in Infrastructure; stable sort (typically `CreatedAt` desc, tie-break `Id`)
- Company-scoped services use `ITenantContext`; platform routes use global admin policy
- Integration tests: first page, `load more` / cursor chain, filter behavior, tenant isolation where applicable
