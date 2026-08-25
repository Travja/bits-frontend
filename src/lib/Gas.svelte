<script lang="ts">
	import { Chart, type Point, type TooltipItem }    from 'chart.js/auto';
	import moment                                     from 'moment/moment';
	import { onDestroy, onMount }                     from 'svelte';
	import { backendUrl, formatCurrency, formatDate } from '$lib/lib';
	import type { GasTransaction }                    from '$lib/transaction';
	import GasSummary                                 from '$lib/GasSummary.svelte';
	import { offRefresh, onRefresh }                  from '$lib/date-service';
	import GasTransactionWidget                       from '$lib/ui/GasTransactionWidget.svelte';
	import { owner }                                  from '$lib/stores';
	import { get, type Unsubscriber }                 from 'svelte/store';
	import { basicAuth }                              from '$lib/credential';
	import Chip                                       from '$lib/ui/Chip.svelte';
	import { monthKey, monthLabel }                   from '$lib/transactionQuery';

	interface Props {
		startDate?: string;
		endDate?: string;
	}

	let {
				startDate = $bindable(new Date().toISOString().split('T')[0]),
				endDate   = $bindable(new Date().toISOString().split('T')[0])
			}: Props                      = $props();
	let myCanvas: HTMLCanvasElement   = $state()!;
	let transaction: GasTransaction[] = $state([]);
	let labels: string[]              = [];
	let chart: Chart;

	let mounted = $state(false);

	const fetchData = () => {
		if (!mounted) return;

		fetch(`${backendUrl}/gas?start=${startDate}&end=${endDate}${get(owner) !== 'All' ? `&owner=${get(owner)}` : ''}`,
			{
				headers: {
					'Authorization': 'Basic ' + get(basicAuth)
				}
			})
			.then(res => res.json())
			.then((data: GasTransaction[]) => {
				transaction = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
				createChart();
			})
			.catch(err => console.error(err));
	};

	let ownerSub: Unsubscriber;
	onMount(() => {
		mounted  = true;
		ownerSub = owner.subscribe(fetchData);
		onRefresh(fetchData);
	});

	onDestroy(() => {
		mounted = false;
		ownerSub?.();
		offRefresh(fetchData);
	});

	// Create chart with chart.js
	const createChart = () => {
		if (!myCanvas) {
			return;
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

		chart = new Chart(ctx, {
			type:    'line',
			data:    {
				labels:   [],
				datasets: []
			},
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
						text:    'Gas'
					},
					tooltip: {
						callbacks: {
							label:     (context: TooltipItem<'line'>) => {
								const dataLabel = context.dataset.label || '';
								if (dataLabel.includes('Price') || dataLabel.includes('Cost')) {
									return `${dataLabel}: ${formatCurrency(context.parsed.y)}`;
								}
							},
							afterBody: (context: TooltipItem<'line'>[]) => {
								const item       = context[0];
								const actualData = transaction.filter(tx => formatDate(tx.date) === item.label);

								if (actualData) {
									// Each data point should be on a new line
									return ['', ...actualData.map(tx => `${tx.location} - ${formatCurrency(tx.amount)}`)];
								} else {
									return 'Total: ' + formatCurrency((<Point>item.raw).y);
								}
							}
						}
					}
				}
			}
		});

		updateChart();
		return chart;
	};

	const updateChart = () => {
		// Map transactions into labels and data
		labels      = [...new Set(transaction.map(tx => formatDate(tx.date)))];
		// Step by month
		const start = moment(startDate, 'YYYY-MM-DD').local(false);
		for (let i = start; i < moment(endDate, 'YYYY-MM-DD'); i.add(1, 'day')) {
			const date  = formatDate(i.toISOString());
			const found = labels.includes(date);
			if (!found) {
				labels.push(date);
			}
		}

		labels.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

		const costData         = getData(tx => ({ x: formatDate(tx.date), y: tx.amount }));
		const mpgData          = getData(tx => ({ x: formatDate(tx.date), y: tx.mpg }));
		const gallonData       = getData(tx => ({ x: formatDate(tx.date), y: tx.gallons }));
		const distanceData     = getData(tx => ({ x: formatDate(tx.date), y: tx.miles }));
		const priceData        = getData(tx => ({ x: formatDate(tx.date), y: tx.costPerGallon }));
		const pricePerMileData = getData(tx => ({ x: formatDate(tx.date), y: tx.costPerMile }));

		// Update chart data
		chart.data.labels   = labels;
		chart.data.datasets = [
			{
				label:   'Distance',
				data:    <Point[]><never>distanceData,
				tension: 0.4
			},
			{
				label:   'Cost',
				data:    <Point[]><never>costData,
				tension: 0.4
			},
			{
				label:   'MPG',
				data:    <Point[]><never>mpgData,
				tension: 0.4
			},
			{
				label:   'Gallons',
				data:    <Point[]><never>gallonData,
				tension: 0.4
			},
			{
				label:   'Price',
				data:    <Point[]><never>priceData,
				tension: 0.4
			},
			{
				label:   'Price Per Mile',
				data:    <Point[]><never>pricePerMileData,
				tension: 0.4
			}
		];

		chart.update();
	};

	const getData = (func: (tx: GasTransaction) => { x: string | number, y: number }) => transaction.map(func);

	$effect.pre(() => {
		if (startDate && endDate && mounted) fetchData();
	});

	// ---- month grouping for the transaction list, matching the cash flow tracker's list ----
	type MonthTotals = { count: number, amount: number };
	type ListRow =
		| { kind: 'header', key: string, monthKey: string, label: string, totals: MonthTotals }
		| { kind: 'tx', key: string, tx: GasTransaction };

	// Collapsed state per month key; a month not present here defaults to open.
	let openMonths: Record<string, boolean> = $state({});
	const isMonthOpen = (key: string) => openMonths[key] !== false;
	const toggleMonth = (key: string) => {
		openMonths = { ...openMonths, [key]: !isMonthOpen(key) };
	};

	// Small, fully-loaded dataset (fill-ups are infrequent) — no pagination needed, so this
	// groups the whole already-fetched list client-side rather than fetching page by page.
	let groupedRows: ListRow[] = $derived.by(() => {
		const rows: ListRow[] = [];
		let lastKey: string | null = null;
		let headerIndex = -1;
		for (const tx of transaction) {
			const key = monthKey(tx.date);
			if (key !== lastKey) {
				rows.push({
					kind: 'header', key: `h-${key}`, monthKey: key, label: monthLabel(tx.date),
					totals: { count: 0, amount: 0 }
				});
				headerIndex = rows.length - 1;
				lastKey = key;
			}
			const totals = (rows[headerIndex] as Extract<ListRow, { kind: 'header' }>).totals;
			totals.count++;
			totals.amount += tx.amount;
			if (isMonthOpen(key)) rows.push({ kind: 'tx', key: String(tx.id), tx });
		}
		return rows;
	});
</script>

<GasSummary {transaction} />

<div class="chart-card">
	<div class="chart-card-header">
		<div class="chart-title">Fuel Trends</div>
	</div>
	<div class="canvas-wrapper">
		<canvas bind:this={myCanvas} height="400" id="myChart" width="400"></canvas>
	</div>
</div>

<div class="results-meta">{transaction.length} fill-up{transaction.length === 1 ? '' : 's'}</div>

<div class="flat-list">
	{#each groupedRows as row (row.key)}
		{#if row.kind === 'header'}
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
					<Chip color="#888" size="0.72em">{row.totals.count}</Chip>
					<Chip color="#d32f2f" size="0.72em">{formatCurrency(row.totals.amount)}</Chip>
				</span>
			</div>
		{:else}
			<GasTransactionWidget transaction={row.tx} />
		{/if}
	{/each}
	{#if transaction.length === 0}
		<div class="empty">No fill-ups in this date range</div>
	{/if}
</div>

<style>
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
        margin-bottom: 0.75rem;
    }

    .chart-title {
        font-size: 1.15rem;
        font-weight: 700;
    }

    .canvas-wrapper {
        width: 100%;
        height: 20rem;
    }

    .results-meta {
        color: gray;
        font-size: 0.85rem;
        margin: 1rem auto 0.5rem;
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
        margin-left: auto;
    }

    .empty {
        padding: 1rem;
        text-align: center;
        color: gray;
        font-size: 0.9rem;
    }
</style>
