# Transactions API — pagination, filtering, sorting

Spec for the backend team. Describes what `GET /transactions` needs to support
so the cash flow tracker (`src/lib/CashFlow.svelte`) can move its filtering,
sorting, and pagination from the client to the server.

## Current state

`GET /transactions?start={YYYY-MM-DD}&end={YYYY-MM-DD}&owner={owner}` returns
every transaction in the date range (optionally scoped to one owner) as a
flat JSON array. The frontend fetches the whole range in one call, then does
everything else — type/category/location filtering, free-text search,
sorting, and a "load 15 more on scroll" reveal — in memory. That's fine at
today's data volume but won't scale, and it means every filter change re-runs
client-side over the full fetched set.

This doc describes the target request/response contract so that work can move
server-side. It does not require the frontend to change again once
implemented — see "Rollout" below for how the two can land independently.

## Transaction shape (unchanged)

```ts
interface Transaction {
  id: number;
  date: string;         // YYYY-MM-DD
  type: 'INCOME' | 'EXPENSE' | 'TITHING';
  category: string;
  location: string;
  owner: string;
  amount: number;
  net: number;
  recurring?: boolean;
}
```

## Proposed request

`GET /transactions`

| Param      | Type                                              | Notes |
|------------|----------------------------------------------------|-------|
| `start`    | `YYYY-MM-DD`                                        | existing, required |
| `end`      | `YYYY-MM-DD`                                        | existing, required |
| `owner`    | `string`                                            | existing, optional — omit or `All` for every owner |
| `type`     | `INCOME` \| `EXPENSE` \| `TITHING`, repeatable        | optional, omit = all types. Repeat the param for multiple (`type=INCOME&type=EXPENSE`) |
| `category` | `string`, repeatable                                | optional, exact match, OR'd across repeats (same convention as `type`) — omit = all categories |
| `location` | `string`, repeatable                                | optional, exact match, OR'd across repeats (same convention as `type`) — omit = all locations |
| `search`   | `string`                                            | optional, free text — case-insensitive substring match against `category`, `location`, and `owner` (mirrors today's client-side `matchesSearch`) |
| `sort`     | `date` \| `amount` \| `category`                     | optional, default `date` |
| `sortDir`  | `asc` \| `desc`                                     | optional, default `desc` for `date`/`amount`, `asc` for `category` |
| `limit`    | `integer`                                           | optional, default 15 — page size, matches the frontend's current `PAGE_SIZE` |
| `cursor`   | `string`                                            | optional, opaque pagination cursor from the previous response's `nextCursor` |

Cursor-based pagination is preferred over `offset`/`page` since the list is
filtered and sorted per-request and offsets drift if new transactions land
between page loads. If offset-based pagination is significantly easier on
the current backend, that's an acceptable fallback — the frontend only needs
"give me the next page" and "is there more," not stable page numbers.

## Proposed response

```ts
interface TransactionPage {
  items: Transaction[];
  total: number;        // total matching count across all pages, for "Showing X of Y"
  nextCursor: string | null; // null when this is the last page
}
```

## Supporting endpoints (for filter dropdowns)

The category and location filters need their *option lists*, not just
filtering. Fetching the full date range just to derive distinct values
defeats the point of paginating it. Two small endpoints cover this:

- `GET /transactions/categories?start=&end=&owner=&type=` → `string[]`, distinct `category` values for the given scope, sorted.
- `GET /transactions/locations?start=&end=&owner=&type=` → `string[]`, distinct `location` values for the given scope, sorted.

Both accept the same `start`/`end`/`owner`/`type` params as the main
endpoint (repeatable `type`) so the option lists narrow the same way the
prototype does today — i.e. picking "Expense" only should narrow the
category list to expense categories.

## Sorting details

- `date`: existing `date` field, ties broken by `id` descending (stable order for same-day transactions).
- `amount`: existing `amount` field.
- `category`: case-insensitive alphabetical on `category`.

## Rollout

This can land independently of any frontend change:

1. Backend adds the new params as **additive and optional**. Omitting all of
   them should return exactly today's behavior (full range, no
   filter/sort/pagination) so nothing currently depends on this breaks.
2. Frontend switches `CashFlow.svelte` from client-side filtering over one
   big fetch to passing `type`/`category`/`location`/`search`/`sort`/`limit`/`cursor`
   and appending each page's `items` as the user scrolls, and calls the two
   new endpoints to populate the category/location `<select>`s instead of
   deriving them from the already-fetched set.
3. Not in scope: the gas tracker (`Gas.svelte`, `GasSummary.svelte`) and its
   `/gas` endpoints are untouched by this — they're a separate page with
   their own data shape.

## Out of scope

- Auth/authorization is unchanged (existing Basic auth).
- No change to `/tithing/owed`.
- No change to how `owner` values are enumerated — still `All` / `Travis` / `Dorothy` today.

---

**Status: implemented.** Everything above this line shipped — `GET /transactions`
supports all the params/response shape described, and `/transactions/categories`
and `/transactions/locations` are live. The frontend is wired to all three.

## Amendment: category/location need to be repeatable (multi-select)

The category and location filters are becoming multi-select in the UI, so
`category`/`location` need the same repeatable-param, OR'd-together
convention `type` already has — `category=Groceries&category=Gas` should
match either, not require both (confirmed by testing: right now it returns
zero results, which looks like AND semantics, or possibly only the last
value winning). Single-value usage (today's behavior) should keep working
unchanged — this is additive, same as everything else in this doc.

Same treatment applies to `/transactions/monthly-summary` and the two
`/categories` / `/locations` endpoints below, since they already document
`category`/`location` as accepted params — they should pick up repeatability
for free if they're built on the same filter-parsing code as `/transactions`,
but flagging in case they parse those params independently.

## New: monthly summary endpoint (for collapsible month headers)

The transaction list now groups rows under collapsible month headers ("This
Month", "Last Month", "June", …), each showing a transaction count and
Income/Expense/Tithing totals for that month. Right now those per-month
totals are computed client-side from whatever page of the list has been
scrolled into view, which means a header's totals are **wrong** (undercounted)
until every transaction in that month has been paginated in. That defeats the
point of paginating: showing an accurate monthly overview shouldn't require
fetching every transaction in the month.

Requesting a small aggregate endpoint, same shape/param convention as
`/transactions/categories` and `/transactions/locations`:

`GET /transactions/monthly-summary?start=&end=&owner=&type=&category=&location=&search=`

Same params as the main `GET /transactions` endpoint (repeatable `type`),
minus `sort`/`sortDir`/`limit`/`cursor` — this isn't paginated, it's one row
per month in the range.

### Response

```ts
type MonthlySummary = {
  month: string;    // "YYYY-MM"
  count: number;
  income: number;   // sum of amount where type = INCOME
  expense: number;  // sum of amount where type = EXPENSE
  tithing: number;  // sum of amount where type = TITHING
}[];
```

One entry per month that has at least one matching transaction, sorted
ascending by `month`. Months with zero matches in range can be omitted
(frontend only renders headers for months it actually has rows for).

### Rollout

Additive/optional, same as before — no other endpoint changes. Frontend
already computes the client-side fallback today, so nothing breaks while
this is being built; once live, the frontend swaps the header totals to come
from this endpoint instead of the loaded page.
