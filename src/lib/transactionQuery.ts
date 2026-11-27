export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'category';

// Maps the list's sort dropdown to the server's `sort`/`sortDir` query params.
export const SORT_PARAMS: Record<SortOption, { sort: string, sortDir: string }> = {
	'date-desc':   { sort: 'date', sortDir: 'desc' },
	'date-asc':    { sort: 'date', sortDir: 'asc' },
	'amount-desc': { sort: 'amount', sortDir: 'desc' },
	'amount-asc':  { sort: 'amount', sortDir: 'asc' },
	'category':    { sort: 'category', sortDir: 'asc' }
};

// Only date-based sorts leave the list in a chronological order that month grouping/headers
// make sense against — amount/category sorts scatter a given month's rows throughout the list.
export const isDateSort = (sort: SortOption): boolean => sort === 'date-desc' || sort === 'date-asc';

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

// Transaction dates always start "YYYY-MM-DD…" (date-only or a full ISO timestamp). Reading the
// year/month straight off the string — rather than through `new Date(dateStr)` — avoids a real
// bug: `new Date('2026-08-01T00:00:00.000+00:00')` parses as a UTC instant, and `.getMonth()`
// then reads it back in the *local* timezone, so anyone west of UTC (all of the US) sees that
// row bucketed into July. Slicing the literal digits sidesteps timezone conversion entirely.
const parseYearMonth = (dateStr: string): { year: number, month: number } => ({
	year:  Number(dateStr.slice(0, 4)),
	month: Number(dateStr.slice(5, 7)) // 1-indexed
});

// "YYYY-MM", 1-indexed and zero-padded — matches the backend's /transactions/monthly-summary
// month key format, so results from that endpoint can be looked up directly by this key.
export const monthKey = (dateStr: string): string => {
	const { year, month } = parseYearMonth(dateStr);
	return `${year}-${String(month).padStart(2, '0')}`;
};

// `now` is injectable so this stays deterministic under test rather than depending on the
// wall clock at call time. Only `now` goes through `Date` — it's a real local instant, not a
// parsed string, so it isn't subject to the timezone pitfall above.
export const monthLabel = (dateStr: string, now: Date = new Date()): string => {
	const { year, month } = parseYearMonth(dateStr);
	const nowMonth1 = now.getMonth() + 1;
	const diffMonths = (now.getFullYear() - year) * 12 + (nowMonth1 - month);
	if (diffMonths === 0) return 'This Month';
	if (diffMonths === 1) return 'Last Month';
	const name = MONTH_NAMES[month - 1];
	return year === now.getFullYear() ? name : `${name} ${year}`;
};

export type CategoryAmount = { category: string, amount: number };

// Keeps the biggest categories as their own slices and lumps the long tail into a single
// "Other" bucket, so a donut/pie chart doesn't get cluttered with slivers. `other` carries what
// was folded in, for a tooltip/detail view to break back out on demand.
export const bucketOther = (
	sorted: CategoryAmount[],
	maxSlices: number
): { breakdown: CategoryAmount[], other: CategoryAmount[] } => {
	if (sorted.length <= maxSlices) {
		return { breakdown: sorted, other: [] };
	}
	const top  = sorted.slice(0, maxSlices - 1);
	const rest = sorted.slice(maxSlices - 1);
	return {
		breakdown: [...top, { category: 'Other', amount: rest.reduce((a, c) => a + c.amount, 0) }],
		other:     rest
	};
};

// A recurring expense is an expense everywhere in the UI: same chip, colour and totals.
export const isExpense = (type: string): boolean => type === 'EXPENSE' || type === 'RECURRING_EXPENSE';
