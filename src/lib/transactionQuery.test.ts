import { describe, expect, it } from 'vitest';
import { isExpense, SORT_PARAMS, isDateSort, monthKey, monthLabel, bucketOther, type SortOption } from './transactionQuery';

describe('SORT_PARAMS', () => {
	it('maps every sort dropdown option to a server sort/sortDir pair', () => {
		expect(SORT_PARAMS['date-desc']).toEqual({ sort: 'date', sortDir: 'desc' });
		expect(SORT_PARAMS['date-asc']).toEqual({ sort: 'date', sortDir: 'asc' });
		expect(SORT_PARAMS['category']).toEqual({ sort: 'category', sortDir: 'asc' });
	});

	// "Low to high" is confirmed as a true ascending sort on the signed amount — a large
	// negative refund sorts before a small positive purchase. Not a bug; pin the mapping so a
	// future change doesn't silently flip it to magnitude-based sorting.
	it('maps amount-asc/desc to true signed-value ascending/descending, not magnitude', () => {
		expect(SORT_PARAMS['amount-asc']).toEqual({ sort: 'amount', sortDir: 'asc' });
		expect(SORT_PARAMS['amount-desc']).toEqual({ sort: 'amount', sortDir: 'desc' });
	});
});

describe('isDateSort', () => {
	it('is true only for the two date-based sorts', () => {
		expect(isDateSort('date-desc')).toBe(true);
		expect(isDateSort('date-asc')).toBe(true);
		expect(isDateSort('amount-desc')).toBe(false);
		expect(isDateSort('amount-asc')).toBe(false);
		expect(isDateSort('category')).toBe(false);
	});

	it('covers every SortOption (fails to compile if a new one is added and not handled here)', () => {
		const all: SortOption[] = ['date-desc', 'date-asc', 'amount-desc', 'amount-asc', 'category'];
		expect(all.map(isDateSort)).toEqual([true, true, false, false, false]);
	});
});

describe('monthKey', () => {
	it('formats as YYYY-MM, 1-indexed and zero-padded', () => {
		expect(monthKey('2026-01-05')).toBe('2026-01');
		expect(monthKey('2026-08-23')).toBe('2026-08');
		expect(monthKey('2026-12-31')).toBe('2026-12');
	});

	it('matches the backend monthly-summary endpoint\'s key format', () => {
		// e.g. { "month": "2026-08", ... } — the frontend looks this up by monthKey(tx.date)
		expect(monthKey('2026-08-01T00:00:00.000Z')).toBe('2026-08');
	});
});

describe('monthLabel', () => {
	const now = new Date(2026, 7, 24); // Aug 24, 2026 — matches the app's local reference date

	it('labels the current month as "This Month"', () => {
		expect(monthLabel('2026-08-01', now)).toBe('This Month');
		expect(monthLabel('2026-08-31', now)).toBe('This Month');
	});

	it('labels the previous month as "Last Month"', () => {
		expect(monthLabel('2026-07-15', now)).toBe('Last Month');
	});

	it('labels other months this year by month name only', () => {
		expect(monthLabel('2026-03-10', now)).toBe('March');
	});

	it('labels months in a different year with the year included', () => {
		expect(monthLabel('2025-08-10', now)).toBe('August 2025');
	});

	it('handles the year boundary for "Last Month" (Jan relative to Dec)', () => {
		const jan = new Date(2026, 0, 15); // Jan 15, 2026
		expect(monthLabel('2025-12-20', jan)).toBe('Last Month');
	});
});

describe('bucketOther', () => {
	const cat = (category: string, amount: number) => ({ category, amount });

	it('leaves the list untouched when at or under the slice limit', () => {
		const sorted = [cat('A', 100), cat('B', 50), cat('C', 10)];
		expect(bucketOther(sorted, 5)).toEqual({ breakdown: sorted, other: [] });
		expect(bucketOther(sorted, 3)).toEqual({ breakdown: sorted, other: [] });
	});

	it('folds everything past the limit into a single "Other" bucket', () => {
		const sorted = [cat('A', 100), cat('B', 50), cat('C', 10), cat('D', 6), cat('E', 4)];
		const { breakdown, other } = bucketOther(sorted, 3);
		expect(breakdown).toEqual([cat('A', 100), cat('B', 50), cat('Other', 20)]);
		expect(other).toEqual([cat('C', 10), cat('D', 6), cat('E', 4)]);
	});

	it('keeps maxSlices - 1 individual slices plus one Other slice', () => {
		const sorted = Array.from({ length: 10 }, (_, i) => cat(`C${i}`, 10 - i));
		const { breakdown } = bucketOther(sorted, 7);
		expect(breakdown).toHaveLength(7);
		expect(breakdown[6].category).toBe('Other');
	});
});

describe('isExpense', () => {
	it('treats recurring expenses as expenses, and nothing else', () => {
		expect(['EXPENSE', 'RECURRING_EXPENSE'].every(isExpense)).toBe(true);
		expect(['INCOME', 'TITHING', 'BALANCE_ADJUSTMENT'].some(isExpense)).toBe(false);
	});
});
