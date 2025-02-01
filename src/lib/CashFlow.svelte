<script lang="ts">
	import type { Transaction }                        from '$lib/transaction';
	import { Chart, type Point, type TooltipItem }     from 'chart.js/auto';
	import moment                                      from 'moment/moment';
	import { onDestroy, onMount }                      from 'svelte';
	import { backendUrl, formatCurrency, formatMonth } from '$lib/lib';
	import CashSummary                                 from '$lib/CashSummary.svelte';
	import { slide }                                   from 'svelte/transition';
	import { offRefresh, onRefresh }                   from '$lib/date-service';
	import TransactionWidget                           from '$lib/ui/TransactionWidget.svelte';
	import { owner }                                   from './stores';
	import { get, type Unsubscriber }                  from 'svelte/store';
	import { basicAuth }                               from '$lib/credential';
	import Chip                                        from '$lib/ui/Chip.svelte';

	interface Props {
		startDate?: string;
		endDate?: string;
	}

	let {
				startDate = $bindable(new Date().toISOString().split('T')[0]),
				endDate   = $bindable(new Date().toISOString().split('T')[0])
			}: Props = $props();

	let transaction: Transaction[]         = $state([]);
	let incomeTransactions: Transaction[]  = $state([]);
	let expenseTransactions: Transaction[] = $state([]);

	let myCanvas: HTMLCanvasElement = $state()!;
	let labels: string[]            = $state([]);
	let chart: Chart;

	// let pieCanvas: HTMLCanvasElement;
	// let pieLabels: string[] = [];
	// let pieChart: Chart;

	let mounted     = $state(false);
	let incomeOpen  = $state(false);
	let expenseOpen = $state(false);

	const fetchData = () => {
		if (!mounted) return;

		fetch(`${backendUrl}/transactions?start=${startDate}&end=${endDate}${get(owner) !== 'All' ? `&owner=${get(owner)}` : ''}`,
			{
				headers: {
					'Authorization': 'Basic ' + get(basicAuth)
				}
			})
			.then(res => res.json())
			.then((data: Transaction[]) => {
				transaction = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

				createChart();

				incomeTransactions  = transaction.filter(tx => tx.type === 'INCOME');
				expenseTransactions = transaction.filter(tx => tx.type === 'EXPENSE');
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

		let index = 0;
		labels.forEach(label => {
			const income  = incomeDataGroup[label] || 0;
			const expense = expenseDataGroup[label] || 0;
			const prev    = netWorth.length > 0 ? netWorth[netWorth.length - 1].y : 4394.66; // 4k is the starting point for the year
			netWorth.push({ x: index++, y: prev + income - expense });
		});

		return netWorth;
	};

	$effect.pre(() => {
		if (startDate && endDate && mounted) fetchData();
	});
</script>

<CashSummary {labels} {transaction} />

<div class="canvas-wrapper">
	<canvas bind:this={myCanvas} height="400" id="myChart" width="400"></canvas>
</div>

<!--<div class="canvas-wrapper">-->
<!--	<canvas id="pieChart" width="400" height="400" bind:this={pieCanvas}></canvas>-->
<!--</div>-->

<div class="summary-grid">
	<div
		aria-expanded={incomeOpen}
		class="section-header"
		onclick={() => incomeOpen = !incomeOpen}
		onkeydown={(e) => e.key === 'Enter' && (incomeOpen = !incomeOpen)}
		role="button"
		tabindex="0"
	>
		Income
		<Chip color="green">{formatCurrency(incomeTransactions.reduce((acc, tx) => acc + tx.amount, 0))}</Chip>
		<Chip size="0.5em">{incomeTransactions.length}</Chip>
		<span class="material-icons dropdown" class:rotated={incomeOpen}>{'arrow_drop_down'}</span>
	</div>
	<div
		aria-expanded={expenseOpen}
		class="section-header"
		onclick={() => expenseOpen = !expenseOpen}
		onkeypress={(e) => e.key === 'Enter' && (expenseOpen = !expenseOpen)}
		role="button"
		tabindex="0"
	>
		Expenses
		<Chip color="#f44">{formatCurrency(expenseTransactions.reduce((acc, tx) => acc + tx.amount, 0))}</Chip>
		<Chip size="0.5em">{expenseTransactions.length}</Chip>
		<span class="material-icons dropdown" class:rotated={expenseOpen}>{'arrow_drop_down'}</span>
	</div>
	{#if incomeOpen}
		<div class="transactions income" transition:slide>
			{#each incomeTransactions as tx}
				<TransactionWidget transaction={tx} />
			{/each}
		</div>
	{/if}
	{#if expenseOpen}
		<div class="transactions expenses" transition:slide>
			{#each expenseTransactions as tx}
				<TransactionWidget transaction={tx} />
			{/each}
		</div>
	{/if}
</div>

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
        justify-content: center;
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
        padding: 1rem;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem;

        align-self: flex-start;
    }

    .summary-grid {
        margin-top: 1rem;

        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-column-gap: 1em;
    }

    .expenses {
        grid-column: 2;
    }
</style>