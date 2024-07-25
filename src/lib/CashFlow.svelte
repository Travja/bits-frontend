<script lang="ts">
	import type { Transaction }                                            from '$lib/transaction';
	import { Chart, type Point, type TooltipItem }                         from 'chart.js/auto';
	import moment                                                          from 'moment/moment';
	import { onMount }                                                     from 'svelte';
	import { apiKey, backendUrl, formatCurrency, formatDate, formatMonth } from '$lib/lib';
	import CashSummary                                                     from '$lib/CashSummary.svelte';
	import { slide }                                                       from 'svelte/transition';

	export let startDate: string   = new Date().toISOString().split('T')[0];
	export let endDate: string     = new Date().toISOString().split('T')[0];
	let transaction: Transaction[] = [];

	let myCanvas: HTMLCanvasElement;
	let labels: string[] = [];
	let chart: Chart;

	// let pieCanvas: HTMLCanvasElement;
	// let pieLabels: string[] = [];
	// let pieChart: Chart;

	let mounted          = false;
	let transactionsOpen = false;

	$: if (transaction) createChart();
	$: if (startDate && endDate && mounted) fetchData();

	const fetchData = () => {
		if (!mounted) return;

		fetch(`${backendUrl}/transactions?start=${startDate}&end=${endDate}`,
			{
				headers: {
					'x-api-key': apiKey
				}
			})
			.then(res => res.json())
			.then((data: Transaction[]) => transaction = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
			.catch(err => console.error(err));
	};

	onMount(() => mounted = true);

	// Create chart with chart.js
	const createChart = () => {
		if (!myCanvas /*|| !pieCanvas*/) {
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

		// const pieCtx = pieCanvas.getContext('2d');
		// if (pieCtx) {
		// 	pieChart = new Chart<'pie'>(pieCtx, {
		// 		type:    'pie',
		// 		data:    {// values on X-Axis
		// 			labels:   ['Red', 'Pink', 'Green', 'Yellow', 'Orange', 'Blue'],
		// 			datasets: [{
		// 				label:           'My First Dataset',
		// 				data:            [300, 240, 100, 432, 253, 34],
		// 				backgroundColor: [
		// 					'red',
		// 					'pink',
		// 					'green',
		// 					'yellow',
		// 					'orange',
		// 					'blue'
		// 				],
		// 				hoverOffset:     4
		// 			}]
		// 		},
		// 		options: {
		// 			animation: false
		// 			// responsive:          true,
		// 			// maintainAspectRatio: false,
		// 			// interaction:         {
		// 			// 	intersect: false,
		// 			// 	mode:      'nearest',
		// 			// 	axis:      'xy'
		// 			// },
		// 			// plugins: {
		// 			// legend: {
		// 			// 	display:  true,
		// 			// 	position: 'bottom'
		// 			// },
		// 			// title:  {
		// 			// 	display: true,
		// 			// 	text:    'Breakdown of Income vs Expense'
		// 			// }
		// 			// tooltip: {
		// 			// 	yAlign:       'center',
		// 			// 	caretSize:    0,
		// 			// 	caretPadding: 10,
		// 			// 	callbacks:    {
		// 			// 		label:     (context: TooltipItem<'line'>) => {
		// 			// 			const dataLabel = context.dataset.label || '';
		// 			// 			return `${dataLabel}: ${formatCurrency(context.parsed.y)}`;
		// 			// 		},
		// 			// 		afterBody: (context: TooltipItem<'line'>[]) => {
		// 			// 			const item      = context[0];
		// 			// 			const dataLabel = item.dataset.label || '';
		// 			//
		// 			// 			const actualData                                          = transaction.filter(tx => formatMonth(tx.date) === item.label && tx.type === dataLabel.toUpperCase());
		// 			// 			const groupedData: { category: string, amount: number }[] = [];
		// 			// 			if (actualData) {
		// 			// 				actualData.forEach(tx => {
		// 			// 					const found = groupedData.find(data => data.category === tx.category);
		// 			// 					if (found) {
		// 			// 						found.amount += tx.amount;
		// 			// 					} else {
		// 			// 						groupedData.push({ category: tx.category, amount: tx.amount });
		// 			// 					}
		// 			// 				});
		// 			// 			}
		// 			//
		// 			// 			if (groupedData && groupedData.length > 0) {
		// 			// 				groupedData.sort((a, b) => b.amount - a.amount);
		// 			// 				// Each data point should be on a new line
		// 			// 				return ['', ...groupedData.map(tx => `${tx.category} - ${formatCurrency(tx.amount)}`)];
		// 			// 			} else {
		// 			// 				return 'Total: ' + formatCurrency((<Point>item.raw).y);
		// 			// 			}
		// 			// 		}
		// 			// 	}
		// 			// }
		// 			// }
		// 		}
		// 	});
		// }

		updateChart();
		return chart;
	};

	const updateChart = () => {
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
		const netWorth    = getNetWorthData();

		// Update chart data
		chart.data.labels   = labels;
		chart.data.datasets = [
			{
				label:                  'Income',
				data:                   <Point[]><never>data,
				cubicInterpolationMode: 'monotone'
			},
			{
				label:                  'Expense',
				data:                   <Point[]><never>expenseData,
				cubicInterpolationMode: 'monotone'
			},
			{
				label:                  'Net Worth',
				data:                   <Point[]><never>netWorth,
				cubicInterpolationMode: 'monotone',
				fill:                   true
			}
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

	const getNetWorthData = () => {
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

		// Map income and expense data into net worth, adding the previous month's net worth to the current month's income
		let netWorth: Point[] = [];

		labels.forEach(label => {
			const income  = incomeDataGroup[label] || 0;
			const expense = expenseDataGroup[label] || 0;
			const prev    = netWorth.length > 0 ? netWorth[netWorth.length - 1].y : 4394.66; // 4k is the starting point for the year
			netWorth.push({ x: label, y: prev + income - expense });
		});

		return netWorth;
	};

	// noinspection JSUnusedGlobalSymbols
	export const refresh = fetchData;
</script>

{#if chart}
	<CashSummary {transaction} {labels} />
{/if}

<div class="canvas-wrapper">
	<canvas id="myChart" width="400" height="400" bind:this={myCanvas}></canvas>
</div>

<!--<div class="canvas-wrapper">-->
<!--	<canvas id="pieChart" width="400" height="400" bind:this={pieCanvas}></canvas>-->
<!--</div>-->

<div
	class="section-header"
	role="button"
	on:click={() => transactionsOpen = !transactionsOpen}
	on:keypress={(e) => e.key === 'Enter' && (transactionsOpen = !transactionsOpen)}
	aria-expanded={transactionsOpen}
	tabindex="0"
>
	Transaction Details
	<span class="material-icons dropdown" class:rotated={transactionsOpen}>{'arrow_drop_down'}</span>
</div>
{#if transactionsOpen}
	<div class="transactions" transition:slide>
		{#each transaction as tx}
			<p>{formatDate(tx.date)} - {formatCurrency(tx.amount)} - {tx.location} - {tx.category} - {tx.type} ({tx.owner}
				)</p>
		{/each}
	</div>
{/if}

<style>
    .canvas-wrapper {
        width: 60%;
        height: 20rem;
        margin: 0 auto;
        background: rgba(0, 0, 0, 0.1);
        padding: 1rem;
        border: 2px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.75rem;
    }

    .section-header {
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        cursor: pointer;
    }

    .dropdown {
        rotate: 0;
        transition: rotate 0.5s;
    }

    .dropdown.rotated {
        rotate: 180deg;
    }

    .transactions {
        margin: 1rem;
        padding: 1rem;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem;
    }
</style>