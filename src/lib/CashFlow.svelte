<script lang="ts">
	import type { Transaction }                        from '$lib/transaction';
	import { Chart, type Point, type TooltipItem }     from 'chart.js/auto';
	import moment                                      from 'moment/moment';
	import { onDestroy, onMount, tick, untrack }        from 'svelte';
	import { backendUrl, formatCurrency, formatMonth } from '$lib/lib';
	import CashSummary                                 from '$lib/CashSummary.svelte';
	import { offRefresh, onRefresh }                   from '$lib/date-service';
	import TransactionWidget                           from '$lib/ui/TransactionWidget.svelte';
	import { owner }                                   from './stores';
	import { get, type Unsubscriber }                  from 'svelte/store';
	import { basicAuth }                               from '$lib/credential';
	import Chip                                        from '$lib/ui/Chip.svelte';
	import { SORT_PARAMS, isDateSort, monthKey, monthLabel, bucketOther, type SortOption } from '$lib/transactionQuery';

	interface Props {
		startDate?: string;
		endDate?: string;
	}

	let {
				startDate = $bindable(new Date().toISOString().split('T')[0]),
				endDate   = $bindable(new Date().toISOString().split('T')[0])
			}: Props = $props();

	const PAGE_SIZE = 15;
	const TYPE_COLOR = { INCOME: '#1a8f2e', EXPENSE: '#d32f2f', TITHING: '#b8790a' };
	const DONUT_PALETTE = ['#4C6EF5', '#F76707', '#12B886', '#E64980', '#7048E8', '#FAB005', '#1098AD', '#495057'];

	// Full date range, owner-scoped only — feeds CashSummary + the line/bar chart, which
	// always compare all three types regardless of the list's filters.
	let transaction: Transaction[] = $state([]);
	let tithingOwed: number        = $state(0);

	let myCanvas: HTMLCanvasElement = $state()!;
	let labels: string[]            = $state([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let chart: Chart<any, any, any> | undefined;
	let chartInstanceType: 'line' | 'bar' | 'doughnut' | undefined;

	// ---- income/expense breakdown donuts (shown side by side, each with its own center total) ----
	type DonutData = { breakdown: { category: string, amount: number }[], other: { category: string, amount: number }[], total: number };
	const EMPTY_DONUT: DonutData = { breakdown: [], other: [], total: 0 };
	let incomeDonut: DonutData        = $state(EMPTY_DONUT);
	let expenseDonut: DonutData       = $state(EMPTY_DONUT);
	let incomeCanvas: HTMLCanvasElement = $state()!;
	let expenseCanvas: HTMLCanvasElement = $state()!;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let incomeChart: Chart<any, any, any> | undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let expenseChart: Chart<any, any, any> | undefined;
	const DONUT_MAX_SLICES = 7;

	let mounted = $state(false);

	// Surfaced when a fetch fails outright (network error, non-2xx that throws on .json(), etc.)
	// so a broken request doesn't just leave stale/incomplete data on screen with no explanation.
	let fetchError: string | null = $state(null);
	const handleFetchError = (err: unknown) => {
		console.error(err);
		fetchError = 'Something went wrong loading data. Try refreshing.';
	};

	// ---- chart type ----
	let chartType: 'line' | 'bar' | 'doughnut' = $state('line');

	// ---- filters / sort (drive server-side query params) ----
	let search: string                                                             = $state('');
	let typeFilter: Record<Transaction['type'], boolean>                           = $state({ INCOME: true, EXPENSE: true, TITHING: true });
	let categoryFilter: string                                                     = $state('All');
	let locationFilter: string                                                     = $state('All');
	let sort: SortOption = $state('date-desc');

	let categoryOptions: string[] = $state([]);
	let locationOptions: string[] = $state([]);

	// ---- server-paginated list ----
	let listItems: Transaction[]      = $state([]);
	let listTotal: number             = $state(0);
	let listCursor: string | null     = $state(null);
	let listLoaded                    = $state(false);
	let listLoading                   = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;

	const authHeaders = () => ({ 'Authorization': 'Basic ' + get(basicAuth) });

	const appendScopeParams = (params: URLSearchParams) => {
		params.set('start', startDate);
		params.set('end', endDate);
		if (get(owner) !== 'All') params.set('owner', get(owner));
		(Object.keys(typeFilter) as Transaction['type'][]).forEach(t => {
			if (typeFilter[t]) params.append('type', t);
		});
	};

	const appendFilterParams = (params: URLSearchParams) => {
		if (categoryFilter !== 'All') params.set('category', categoryFilter);
		if (locationFilter !== 'All') params.set('location', locationFilter);
		if (search) params.set('search', search);
	};

	const noTypesSelected = () => !typeFilter.INCOME && !typeFilter.EXPENSE && !typeFilter.TITHING;

	const fetchChartData = () => {
		if (!mounted) return;
		fetchError = null;

		const params = new URLSearchParams({ start: startDate, end: endDate });
		if (get(owner) !== 'All') params.set('owner', get(owner));

		fetch(`${backendUrl}/transactions?${params}`, { headers: authHeaders() })
			.then(res => res.json())
			.then((data: { items: Transaction[] }) => {
				transaction = data.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				createChart();
			})
			.catch(handleFetchError);

		fetch(`${backendUrl}/tithing/owed`, { headers: authHeaders() })
			.then(res => res.json())
			.then(data => tithingOwed = data)
			.catch(handleFetchError);
	};

	const fetchFilterOptions = () => {
		if (!mounted) return;
		if (noTypesSelected()) {
			categoryOptions = [];
			locationOptions = [];
			return;
		}

		const params = new URLSearchParams();
		appendScopeParams(params);

		fetch(`${backendUrl}/transactions/categories?${params}`, { headers: authHeaders() })
			.then(res => res.json())
			.then((data: string[]) => categoryOptions = data)
			.catch(handleFetchError);

		fetch(`${backendUrl}/transactions/locations?${params}`, { headers: authHeaders() })
			.then(res => res.json())
			.then((data: string[]) => locationOptions = data)
			.catch(handleFetchError);
	};

	const fetchDonutFor = (type: 'INCOME' | 'EXPENSE') => {
		if (!mounted) return;
		const setResult = (result: DonutData) => {
			if (type === 'INCOME') incomeDonut = result;
			else expenseDonut = result;
			if (chartType === 'doughnut') updateChart();
		};

		if (!typeFilter[type]) {
			setResult({ breakdown: [], other: [], total: 0 });
			return;
		}

		const params = new URLSearchParams();
		params.set('start', startDate);
		params.set('end', endDate);
		if (get(owner) !== 'All') params.set('owner', get(owner));
		params.append('type', type);
		appendFilterParams(params);

		fetch(`${backendUrl}/transactions?${params}`, { headers: authHeaders() })
			.then(res => res.json())
			.then((data: { items: Transaction[] }) => {
				const map: Record<string, number> = {};
				let total = 0;
				data.items.forEach(tx => {
					map[tx.category] = (map[tx.category] ?? 0) + tx.amount;
					total += tx.amount;
				});
				const sorted = Object.entries(map)
					.map(([category, amount]) => ({ category, amount }))
					.sort((a, b) => b.amount - a.amount);

				// Keep the biggest categories as their own slices; lump the long tail into
				// "Other" so it doesn't clutter the chart with slivers — the tooltip on
				// that slice still lists what's in it.
				const { breakdown, other } = bucketOther(sorted, DONUT_MAX_SLICES);
				setResult({ breakdown, other, total });
			})
			.catch(handleFetchError);
	};

	const fetchDonutData = () => {
		fetchDonutFor('INCOME');
		fetchDonutFor('EXPENSE');
	};

	// Returns a promise so callers that need to page through several requests in sequence
	// (see catchUpCollapsedMonth below) can await each one rather than firing them concurrently.
	const fetchListPage = (reset: boolean): Promise<void> => {
		if (!mounted || listLoading) return Promise.resolve();
		fetchError = null;
		if (noTypesSelected()) {
			listItems  = [];
			listTotal  = 0;
			listCursor = null;
			listLoaded = true;
			return Promise.resolve();
		}
		if (!reset && listCursor === null && listLoaded) return Promise.resolve();

		listLoading = true;
		const params = new URLSearchParams();
		appendScopeParams(params);
		appendFilterParams(params);
		params.set('limit', String(PAGE_SIZE));
		params.set('sort', SORT_PARAMS[sort].sort);
		params.set('sortDir', SORT_PARAMS[sort].sortDir);
		if (!reset && listCursor) params.set('cursor', listCursor);

		return fetch(`${backendUrl}/transactions?${params}`, { headers: authHeaders() })
			.then(res => res.json())
			.then((data: { items: Transaction[], total: number, nextCursor: string | null }) => {
				// Defensive: a tie on the sort key (e.g. several rows with the same amount) can
				// shift which rows land on which page if the server's ordering for that tie isn't
				// stable across requests, occasionally handing back a row already on a prior page.
				// Dedupe by id so that never crashes the keyed #each — reported upstream as the
				// real fix (stable tiebreak in the sort), this is just a safety net.
				if (reset) {
					listItems = data.items;
				} else {
					const seen = new Set(listItems.map(tx => tx.id));
					listItems = [...listItems, ...data.items.filter(tx => !seen.has(tx.id))];
				}
				listTotal  = data.total;
				listCursor = data.nextCursor;
				listLoaded = true;
			})
			.catch(handleFetchError)
			.finally(() => listLoading = false);
	};

	// Everything scoped by start/end/owner/type — refetch the chart, filter option
	// lists, donut breakdown (if visible), and reset the paginated list.
	const fetchAll = () => {
		fetchChartData();
		fetchFilterOptions();
		fetchListPage(true);
		fetchMonthlySummary();
		if (chartType === 'doughnut') fetchDonutData();
	};

	let ownerSub: Unsubscriber;
	let initialLoadDone = false;
	onMount(() => {
		mounted = true;
		// svelte/store subscriptions fire immediately with the current value — the
		// $effect.pre below already covers that first load, so only react to real
		// owner changes here, not the initial fire, to avoid fetching everything twice.
		ownerSub = owner.subscribe(() => {
			if (initialLoadDone) fetchAll();
		});
		onRefresh(fetchAll);
		window.addEventListener('scroll', handleScroll, { passive: true });
	});

	onDestroy(() => {
		mounted = false;
		ownerSub?.();
		offRefresh(fetchAll);
		if (typeof window !== 'undefined') window.removeEventListener('scroll', handleScroll);
	});

	let hasMore: boolean     = $derived(listItems.length > 0 && listCursor !== null);
	let resultsLabel: string = $derived(hasMore
		? `Showing ${listItems.length} of ${listTotal} transactions`
		: `${listTotal} transaction${listTotal === 1 ? '' : 's'}`);

	type MonthTotals = { count: number, income: number, expense: number, tithing: number };
	type ListRow =
		| { kind: 'header', key: string, monthKey: string, label: string, totals: MonthTotals }
		| { kind: 'tx', key: string, tx: Transaction };

	// Collapsed state per month key; a month not present here defaults to open.
	let openMonths: Record<string, boolean> = $state({});
	const isMonthOpen = (key: string) => openMonths[key] !== false;
	// Collapsing a month that isn't fully loaded yet used to feel broken: scrolling shrinks
	// to fit the now-hidden rows, which re-triggers the scroll auto-load, which fetches more
	// rows that are *still* in the same collapsed month and so still invisible — repeat until
	// that month finally runs out and the next one appears. Instead, when a month collapses,
	// keep paging through it in the background (skipping the scroll trigger entirely) until
	// it's fully loaded, so the next visible month's content is already there.
	const catchUpCollapsedMonth = async (key: string) => {
		const target = monthlySummary[key]?.count;
		if (target === undefined) return; // total unknown yet — fall back to scroll-triggered paging
		while (hasMore) {
			const loaded = listItems.filter(tx => monthKey(tx.date) === key).length;
			if (loaded >= target) break;
			await fetchListPage(false);
		}
	};

	const toggleMonth = (key: string) => {
		const wasOpen = isMonthOpen(key);
		openMonths = { ...openMonths, [key]: !wasOpen };
		if (wasOpen) catchUpCollapsedMonth(key);
	};

	// Accurate per-month totals from the server, scoped by the same filters as the list —
	// independent of pagination, so a header's numbers are right even before that whole
	// month has been scrolled into view. Falls back to accumulating from the loaded page
	// (below) if the endpoint isn't available yet.
	let monthlySummary: Record<string, MonthTotals> = $state({});

	const fetchMonthlySummary = () => {
		if (!mounted) return;
		if (noTypesSelected()) {
			monthlySummary = {};
			return;
		}

		const params = new URLSearchParams();
		appendScopeParams(params);
		appendFilterParams(params);

		fetch(`${backendUrl}/transactions/monthly-summary?${params}`, { headers: authHeaders() })
			.then(res => {
				if (!res.ok) throw new Error(`monthly-summary not available (${res.status})`);
				return res.json();
			})
			.then((data: { month: string, count: number, income: number, expense: number, tithing: number }[]) => {
				const map: Record<string, MonthTotals> = {};
				data.forEach(m => { map[m.month] = { count: m.count, income: m.income, expense: m.expense, tithing: m.tithing }; });
				monthlySummary = map;
			})
			.catch(() => { monthlySummary = {}; });
	};

	let groupedRows: ListRow[] = $derived.by(() => {
		if (!isDateSort(sort)) {
			return listItems.map(tx => ({ kind: 'tx' as const, key: String(tx.id), tx }));
		}
		const rows: ListRow[] = [];
		let lastKey: string | null = null;
		let headerIndex = -1;
		for (const tx of listItems) {
			const key = monthKey(tx.date);
			if (key !== lastKey) {
				rows.push({
					kind: 'header', key: `h-${key}`, monthKey: key, label: monthLabel(tx.date),
					totals: { count: 0, income: 0, expense: 0, tithing: 0 }
				});
				headerIndex = rows.length - 1;
				lastKey = key;
			}
			const totals = (rows[headerIndex] as Extract<ListRow, { kind: 'header' }>).totals;
			totals.count++;
			if (tx.type === 'INCOME') totals.income += tx.amount;
			else if (tx.type === 'EXPENSE') totals.expense += tx.amount;
			else totals.tithing += tx.amount;
			if (isMonthOpen(key)) rows.push({ kind: 'tx', key: String(tx.id), tx });
		}
		return rows;
	});

	const loadMore = () => fetchListPage(false);

	let scrollLocked = false;
	const handleScroll = () => {
		if (scrollLocked || !hasMore || listLoading) return;
		if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 400) {
			scrollLocked = true;
			loadMore();
			setTimeout(() => scrollLocked = false, 250);
		}
	};

	// Type filter changes what the chart, option lists, and list can show — refetch everything scoped by it.
	const toggleType = (type: Transaction['type']) => {
		typeFilter = { ...typeFilter, [type]: !typeFilter[type] };
		fetchFilterOptions();
		fetchListPage(true);
		fetchMonthlySummary();
		if (chartType === 'doughnut') fetchDonutData();
	};

	// Category/location/search narrow the list, donut, and month totals, but not the chart or option lists.
	const onListFilterChange = () => {
		fetchListPage(true);
		fetchMonthlySummary();
		if (chartType === 'doughnut') fetchDonutData();
	};

	const onSearchInput = () => {
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(onListFilterChange, 300);
	};

	const onSortChange = () => fetchListPage(true);

	const resetFilters = () => {
		search         = '';
		categoryFilter = 'All';
		locationFilter = 'All';
		sort           = 'date-desc';
		typeFilter     = { INCOME: true, EXPENSE: true, TITHING: true };
		fetchFilterOptions();
		fetchListPage(true);
		fetchMonthlySummary();
		if (chartType === 'doughnut') fetchDonutData();
	};

	// Draws each donut's total in the center of the ring — Chart.js has no built-in for this.
	const makeCenterTextPlugin = (getTotal: () => number) => ({
		id:        'centerText',
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		afterDraw: (chartInstance: any) => {
			const { ctx, chartArea } = chartInstance;
			if (!chartArea) return;
			const x = (chartArea.left + chartArea.right) / 2;
			const y = (chartArea.top + chartArea.bottom) / 2;
			ctx.save();
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.font = '700 17px Roboto, sans-serif';
			ctx.fillStyle = '#222';
			ctx.fillText(formatCurrency(getTotal()), x, y);
			ctx.restore();
		}
	});

	const buildDonutConfig = (getOther: () => { category: string, amount: number }[], getTotal: () => number) => ({
		type:    'doughnut' as const,
		data:    { labels: [], datasets: [] },
		options: {
			responsive:          true,
			maintainAspectRatio: false,
			cutout:              '65%',
			plugins:             {
				legend:  { display: true, position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 11 } } },
				tooltip: {
					callbacks: {
						label:     (context: TooltipItem<'doughnut'>) => `${context.label}: ${formatCurrency(<number>context.parsed)}`,
						afterBody: (context: TooltipItem<'doughnut'>[]) => {
							const item  = context[0];
							const other = getOther();
							if (item.label !== 'Other' || other.length === 0) return '';
							return ['', ...other.map(d => `${d.category} - ${formatCurrency(d.amount)}`)];
						}
					}
				}
			}
		},
		plugins: [makeCenterTextPlugin(getTotal)]
	});

	const createDonutCharts = () => {
		if (incomeCanvas && !incomeChart) {
			const ctx = incomeCanvas.getContext('2d');
			if (ctx) incomeChart = new Chart(ctx, buildDonutConfig(() => incomeDonut.other, () => incomeDonut.total));
		}
		if (expenseCanvas && !expenseChart) {
			const ctx = expenseCanvas.getContext('2d');
			if (ctx) expenseChart = new Chart(ctx, buildDonutConfig(() => expenseDonut.other, () => expenseDonut.total));
		}
		updateChart();
	};

	// Create chart with chart.js
	const createChart = () => {
		if (chartType === 'doughnut') {
			if (chart) {
				chart.destroy();
				chart = undefined;
			}
			createDonutCharts();
			return;
		}

		if (incomeChart) {
			incomeChart.destroy();
			incomeChart = undefined;
		}
		if (expenseChart) {
			expenseChart.destroy();
			expenseChart = undefined;
		}

		if (!myCanvas) {
			return;
		}

		if (chart && chartInstanceType !== chartType) {
			chart.destroy();
			chart = undefined;
		}

		if (chart) {
			updateChart();
			return chart;
		}

		const ctx = myCanvas.getContext('2d');
		if (!ctx) {
			console.error('Could not get context');
			return;
		}

		chartInstanceType = chartType;

		{
			chart = new Chart(ctx, {
				type:    chartType,
				data:    { labels: [], datasets: [] },
				options: {
					responsive:          true,
					maintainAspectRatio: false,
					spanGaps:            true,
					scales:              {
						y: {
							beginAtZero: true
						}
					},
					interaction:         {
						intersect: false,
						mode:      'nearest',
						axis:      'xy'
					},
					plugins:             {
						legend:  {
							display:  true,
							position: 'bottom'
						},
						title:   {
							display: true,
							text:    'Income vs Expense'
						},
						tooltip: {
							yAlign:       'center',
							caretSize:    0,
							caretPadding: 10,
							callbacks:    {
								label:     (context: TooltipItem<'line'>) => {
									const dataLabel = context.dataset.label || '';
									return `${dataLabel}: ${formatCurrency(context.parsed.y)}`;
								},
								afterBody: (context: TooltipItem<'line'>[]) => {
									const item      = context[0];
									const dataLabel = item.dataset.label || '';

									const actualData                                          = transaction.filter(tx => formatMonth(tx.date) === item.label && tx.type === dataLabel.toUpperCase());
									const groupedData: { category: string, amount: number }[] = [];
									if (actualData) {
										actualData.forEach(tx => {
											const found = groupedData.find(data => data.category === tx.category);
											if (found) {
												found.amount += tx.amount;
											} else {
												groupedData.push({ category: tx.category, amount: tx.amount });
											}
										});
									}

									if (groupedData && groupedData.length > 0) {
										groupedData.sort((a, b) => b.amount - a.amount);
										// Each data point should be on a new line
										return ['', ...groupedData.map(tx => `${tx.category} - ${formatCurrency(tx.amount)}`)];
									} else {
										return 'Total: ' + formatCurrency((<Point>item.raw).y);
									}
								}
							}
						}
					}
				}
			});
		}

		updateChart();
		return chart;
	};

	const updateChart = () => {
		if (chartType === 'doughnut') {
			if (incomeChart) {
				incomeChart.data.labels   = incomeDonut.breakdown.map(b => b.category);
				incomeChart.data.datasets = [{
					data:            incomeDonut.breakdown.map(b => b.amount),
					backgroundColor: incomeDonut.breakdown.map((_, i) => DONUT_PALETTE[i % DONUT_PALETTE.length])
				}];
				incomeChart.update();
			}
			if (expenseChart) {
				expenseChart.data.labels   = expenseDonut.breakdown.map(b => b.category);
				expenseChart.data.datasets = [{
					data:            expenseDonut.breakdown.map(b => b.amount),
					backgroundColor: expenseDonut.breakdown.map((_, i) => DONUT_PALETTE[i % DONUT_PALETTE.length])
				}];
				expenseChart.update();
			}
			return;
		}

		if (!chart) return;

		// Map transactions into labels and data
		labels      = [...new Set(transaction.map(tx => formatMonth(tx.date)))];
		// Step by month
		const start = moment(startDate, 'YYYY-MM-DD').local(false);
		for (let i = start; i < moment(endDate, 'YYYY-MM-DD'); i.add(1, 'month')) {
			const date  = formatMonth(i.toISOString());
			const found = labels.includes(date);
			if (!found) {
				labels.push(date);
			}
		}

		labels.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

		const data        = getIncomeData();
		const expenseData = getExpenseData();
		const tithingData = getTithingData();

		chart.data.labels   = labels;
		chart.data.datasets = [
			{
				label:                  'Income',
				data:                   <Point[]><never>data,
				cubicInterpolationMode: 'monotone',
				backgroundColor:        'rgba(26,143,46,0.7)',
				borderColor:            TYPE_COLOR.INCOME
			},
			{
				label:                  'Expense',
				data:                   <Point[]><never>expenseData,
				cubicInterpolationMode: 'monotone',
				backgroundColor:        'rgba(211,47,47,0.7)',
				borderColor:            TYPE_COLOR.EXPENSE
			},
			{
				label:                  'Tithing',
				data:                   <Point[]><never>tithingData,
				cubicInterpolationMode: 'monotone',
				backgroundColor:        'rgba(184,121,10,0.7)',
				borderColor:            TYPE_COLOR.TITHING
			},
			...(chartType === 'line' ? [{
				label:                  'Net Worth',
				data:                   <Point[]><never>getNetWorthData(),
				cubicInterpolationMode: 'monotone' as const,
				fill:                   true,
				borderColor:            '#007bff',
				backgroundColor:        'rgba(0,123,255,0.15)'
			}] : [])
		];

		chart.update();
	};

	const getIncomeData = () => {
		// Parse out income data from the transactions
		const incomeData      = transaction.filter(tx => tx.type === 'INCOME');
		const incomeDataGroup = incomeData.reduce((acc, tx) => {
			const date = formatMonth(tx.date);
			if (acc[date]) {
				acc[date] += tx.amount;
			} else {
				acc[date] = tx.amount;
			}
			return acc;
		}, {} as Record<string, number>);
		return Object.entries(incomeDataGroup).map(([date, amount]) => ({ x: date, y: amount }));
	};

	const getExpenseData = () => {
		// Parse out expense data from the transactions
		const expenseData      = transaction.filter(tx => tx.type === 'EXPENSE');
		const expenseDataGroup = expenseData.reduce((acc, tx) => {
			const date = formatMonth(tx.date);
			if (acc[date]) {
				acc[date] += tx.amount;
			} else {
				acc[date] = tx.amount;
			}
			return acc;
		}, {} as Record<string, number>);
		return Object.entries(expenseDataGroup).map(([date, amount]) => ({ x: date, y: amount }));
	};

	const getTithingData = () => {
		// Parse out tithing data from the transactions
		const tithingData      = transaction.filter(tx => tx.type === 'TITHING');
		const tithingDataGroup = tithingData.reduce((acc, tx) => {
			const date = formatMonth(tx.date);
			if (acc[date]) {
				acc[date] += tx.amount;
			} else {
				acc[date] = tx.amount;
			}
			return acc;
		}, {} as Record<string, number>);
		return Object.entries(tithingDataGroup).map(([date, amount]) => ({ x: date, y: amount }));
	};

	const getNetWorthData = () => {
		// get the last entry for each month
		const transactionData = transaction.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
			.filter(tx => tx.type === 'INCOME' || tx.type === 'EXPENSE' || tx.type === 'TITHING')
			.reduce((acc, tx) => {
				const date = formatMonth(tx.date);
				acc[date]  = tx;
				return acc;
			}, {} as Record<string, Transaction>);

		// Map income and expense data into net worth, adding the previous month's net worth to the current month's income
		let netWorth: Point[] = [];

		let index = 0;
		labels.forEach(label => {
			let net = 0;
			if (transactionData[label]) {
				net = transactionData[label].net;
			} else if (netWorth.length > 0) {
				// No rows this month: carry the previous month's net worth forward
				net = netWorth[netWorth.length - 1].y;
			}
			netWorth.push({ x: index++, y: net });
		});

		return netWorth;
	};

	// fetchAll() (via fetchListPage) reads and writes `listLoading` synchronously — calling
	// it directly from inside an effect makes the effect depend on a value it just wrote,
	// which retriggers itself forever. untrack() shields those reads/writes from being
	// recorded as this effect's dependencies (mirrors what Svelte's own store-subscription
	// internals already do for the owner.subscribe(fetchAll) call above).
	$effect.pre(() => {
		if (startDate && endDate && mounted) {
			untrack(fetchAll);
			initialLoadDone = true;
		}
	});

	// createChart()/updateChart() mutate the `labels` state and read it back in the same
	// pass (net worth calc) — calling them from inside a Svelte effect creates a
	// self-triggering loop. Refresh the chart imperatively from user interactions instead,
	// same as the initial fetch does.
	const setChartType = (type: 'line' | 'bar' | 'doughnut') => {
		chartType = type;
		// Wait for the CSS visibility swap (canvas-wrapper <-> donut-pair) to actually reach
		// the DOM before creating/sizing a chart on it — creating one on a still-hidden
		// (display:none, 0x0) canvas leaves it stuck at that size even after a later resize().
		tick().then(() => {
			createChart();
			if (type === 'doughnut') fetchDonutData();
		});
	};
</script>

{#if fetchError}
	<div class="fetch-error" role="alert">
		{fetchError}
		<button class="dismiss-btn" onclick={() => fetchError = null}>Dismiss</button>
	</div>
{/if}

<CashSummary {labels} {transaction} {tithingOwed} />

<div class="chart-card">
	<div class="chart-card-header">
		<div class="chart-title">{chartType === 'doughnut' ? 'Category Breakdown' : 'Income vs Expense'}</div>
		<div class="chart-tabs">
			<button class="tab-btn" class:active={chartType === 'line'} onclick={() => setChartType('line')}>Line</button>
			<button class="tab-btn" class:active={chartType === 'bar'} onclick={() => setChartType('bar')}>Bar</button>
			<button class="tab-btn" class:active={chartType === 'doughnut'} onclick={() => setChartType('doughnut')}>Breakdown</button>
		</div>
	</div>
	<!-- Both layouts stay mounted (toggled via CSS, not {#if}) so bind:this refs are always
	     available the instant a tab is clicked — swapping them in/out of the DOM would leave
	     createChart() reading a not-yet-bound canvas on the same tick as the click. -->
	<div class="canvas-wrapper" class:hidden={chartType === 'doughnut'}>
		<canvas bind:this={myCanvas} height="400" id="myChart" width="400"></canvas>
	</div>
	<div class="donut-pair" class:hidden={chartType !== 'doughnut'}>
		<div class="donut-col">
			<div class="donut-col-title income">Income</div>
			<div class="donut-canvas-wrap">
				<canvas bind:this={incomeCanvas}></canvas>
			</div>
		</div>
		<div class="donut-col">
			<div class="donut-col-title expense">Expense</div>
			<div class="donut-canvas-wrap">
				<canvas bind:this={expenseCanvas}></canvas>
			</div>
		</div>
	</div>
</div>

<div class="filter-bar">
	<div class="filter-row">
		<div class="search-wrap">
			<input bind:value={search} oninput={onSearchInput} placeholder="Search category, merchant, owner…" type="search"/>
		</div>
		<select bind:value={categoryFilter} onchange={onListFilterChange}>
			<option value="All">All categories</option>
			{#each categoryOptions as category}
				<option value={category}>{category}</option>
			{/each}
		</select>
		<select bind:value={locationFilter} onchange={onListFilterChange}>
			<option value="All">All locations</option>
			{#each locationOptions as location}
				<option value={location}>{location}</option>
			{/each}
		</select>
		<select bind:value={sort} onchange={onSortChange}>
			<option value="date-desc">Date (newest)</option>
			<option value="date-asc">Date (oldest)</option>
			<option value="amount-desc">Amount (high–low)</option>
			<option value="amount-asc">Amount (low–high)</option>
			<option value="category">Category (A–Z)</option>
		</select>
		<button class="reset-btn" onclick={resetFilters}>Reset</button>
	</div>
	<div class="type-chips-row">
		<span class="row-label">Type</span>
		<div class="type-chips">
			<button class="type-chip" class:active={typeFilter.INCOME} style:--chip-color={TYPE_COLOR.INCOME} onclick={() => toggleType('INCOME')}>Income</button>
			<button class="type-chip" class:active={typeFilter.EXPENSE} style:--chip-color={TYPE_COLOR.EXPENSE} onclick={() => toggleType('EXPENSE')}>Expense</button>
			<button class="type-chip" class:active={typeFilter.TITHING} style:--chip-color={TYPE_COLOR.TITHING} onclick={() => toggleType('TITHING')}>Tithing</button>
		</div>
	</div>
</div>

<div class="results-meta">{resultsLabel}</div>

<div class="flat-list">
	{#each groupedRows as row (row.key)}
		{#if row.kind === 'header'}
			{@const totals = monthlySummary[row.monthKey] ?? row.totals}
			<div
				aria-expanded={isMonthOpen(row.monthKey)}
				class="month-header"
				onclick={() => toggleMonth(row.monthKey)}
				onkeydown={(e) => e.key === 'Enter' && toggleMonth(row.monthKey)}
				role="button"
				tabindex="0"
			>
				<span class="month-chevron" class:collapsed={!isMonthOpen(row.monthKey)}>
					<svg fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
				</span>
				<span class="month-label">{row.label}</span>
				<span class="month-chips">
					<Chip color="#888" size="0.72em">{totals.count}</Chip>
					{#if totals.income}<Chip color={TYPE_COLOR.INCOME} size="0.72em">{formatCurrency(totals.income)}</Chip>{/if}
					{#if totals.expense}<Chip color={TYPE_COLOR.EXPENSE} size="0.72em">{formatCurrency(totals.expense)}</Chip>{/if}
					{#if totals.tithing}<Chip color={TYPE_COLOR.TITHING} size="0.72em">{formatCurrency(totals.tithing)}</Chip>{/if}
				</span>
			</div>
		{:else}
			<TransactionWidget transaction={row.tx} />
		{/if}
	{/each}
	{#if listLoaded && listItems.length === 0}
		<div class="empty">No transactions match the current filters</div>
	{/if}
	{#if hasMore}
		<button class="load-more" onclick={loadMore}>
			<span class="load-more-spinner"></span>
			Load more transactions
		</button>
	{/if}
</div>

<style>
    .fetch-error {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        max-width: 940px;
        margin: 1rem auto 0;
        padding: 0.75rem 1rem;
        background: rgba(211, 47, 47, 0.08);
        border: 1px solid rgba(211, 47, 47, 0.3);
        border-radius: 0.5rem;
        color: #d32f2f;
        font-size: 0.9rem;
    }

    .dismiss-btn {
        all: unset;
        cursor: pointer;
        font-weight: 600;
        text-decoration: underline;
    }

    .chart-card {
        margin: 1rem auto 0;
        width: 60%;
        background: rgba(0, 0, 0, 0.03);
        border: 2px solid rgba(0, 0, 0, 0.08);
        border-radius: 0.75rem;
        padding: 1.25rem;
    }

    .chart-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .chart-title {
        font-size: 1.15rem;
        font-weight: 700;
    }

    .chart-tabs {
        display: flex;
        gap: 0.4rem;
        background: #eceff1;
        padding: 0.25rem;
        border-radius: 0.5rem;
    }

    .tab-btn {
        all: unset;
        cursor: pointer;
        padding: 0.4rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.85rem;
        font-weight: 500;
        color: #444;
    }

    .tab-btn.active {
        background: #007bff;
        color: #fff;
    }

    .canvas-wrapper {
        width: 100%;
        height: 20rem;
    }

    .donut-pair {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 1.5rem;
    }

    .donut-col {
        flex: 1 1 260px;
        max-width: 340px;
        text-align: center;
    }

    .donut-col-title {
        font-weight: 700;
        font-size: 0.95rem;
        margin-bottom: 0.5rem;
    }

    .donut-col-title.income {
        color: #1a8f2e;
    }

    .donut-col-title.expense {
        color: #d32f2f;
    }

    .donut-canvas-wrap {
        position: relative;
        height: 18rem;
    }

    .filter-bar {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        margin: 1.5rem auto 0.5rem;
        width: 60%;
        padding: 0.85rem 1rem;
        background: #f7f7f8;
        border-radius: 0.625rem;
    }

    .filter-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
    }

    .type-chips-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding-top: 0.55rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .type-chips-row .row-label {
        font-size: 0.8rem;
        color: gray;
        font-weight: 500;
    }

    .search-wrap {
        flex: 1 1 220px;
        min-width: 180px;
    }

    .search-wrap input {
        width: 100%;
        font-family: inherit;
        font-size: 0.9rem;
        padding: 0.55em 0.75em;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.375rem;
        box-sizing: border-box;
    }

    .type-chips {
        display: flex;
        gap: 0.4rem;
    }

    .type-chip {
        all: unset;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 500;
        padding: 0.4em 0.9em;
        border-radius: 100vw;
        border: 1.5px solid var(--chip-color);
        color: var(--chip-color);
        background: #fff;
    }

    .type-chip.active {
        background: var(--chip-color);
        color: #fff;
    }

    select {
        font-family: inherit;
        font-size: 0.9rem;
        padding: 0.5em 0.6em;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.375rem;
        background: #fff;
    }

    .reset-btn {
        all: unset;
        cursor: pointer;
        font-size: 0.85rem;
        color: #007bff;
        font-weight: 500;
        margin-left: auto;
    }

    .results-meta {
        color: gray;
        font-size: 0.85rem;
        margin: 0.5rem auto;
        width: 60%;
    }

    .flat-list {
        width: 60%;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .month-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;

        margin-top: 0.7rem;
        padding: 0.4rem 0.6rem;
        background: #f2f2f2;
        border-radius: 0.375rem;
    }

    .month-header:first-child {
        margin-top: 0;
    }

    .month-header:hover {
        background: #ececec;
    }

    .month-chevron {
        display: flex;
        color: #777;
        transition: transform 0.2s;
    }

    .month-chevron.collapsed {
        transform: rotate(-90deg);
    }

    .month-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #444;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .month-chips {
        display: flex;
        align-items: center;
        gap: 0.1rem;
        margin-left: auto;
    }

    .empty {
        padding: 1rem;
        text-align: center;
        color: gray;
        font-size: 0.9rem;
    }

    .load-more {
        all: unset;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin: 0.5rem auto 0;
        padding: 0.6em 1.2em;
        font-size: 0.85rem;
        font-weight: 500;
        color: #007bff;
        border: 1px solid rgba(0, 123, 255, 0.35);
        border-radius: 100vw;
    }

    .load-more:hover {
        background: rgba(0, 123, 255, 0.06);
    }

    .load-more-spinner {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid rgba(0, 123, 255, 0.25);
        border-top-color: #007bff;
        animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Kept last so it always wins over earlier same-specificity display rules
       (.canvas-wrapper, .donut-pair) regardless of source order. */
    .hidden {
        display: none;
    }
</style>
