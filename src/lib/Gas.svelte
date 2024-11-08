<script lang="ts">
	import { Chart, type Point, type TooltipItem }            from 'chart.js/auto';
	import moment                                             from 'moment/moment';
	import { onDestroy, onMount }                             from 'svelte';
	import { apiKey, backendUrl, formatCurrency, formatDate } from '$lib/lib';
	import type { GasTransaction }                            from '$lib/transaction';
	import { slide }                                          from 'svelte/transition';
	import GasSummary                                         from '$lib/GasSummary.svelte';
	import { offRefresh, onRefresh }                          from '$lib/date-service';
	import TransactionWidget                                  from '$lib/ui/TransactionWidget.svelte';
	import { owner }                                          from '$lib/stores';
	import { get, type Unsubscriber }                         from 'svelte/store';

	export let startDate: string      = new Date().toISOString().split('T')[0];
	export let endDate: string        = new Date().toISOString().split('T')[0];
	let myCanvas: HTMLCanvasElement;
	let transaction: GasTransaction[] = [];
	let labels: string[]              = [];
	let chart: Chart;

	let mounted          = false;
	let transactionsOpen = false;

	$: if (transaction) createChart();
	$: if (startDate && endDate && mounted) fetchData();

	const fetchData = () => {
		if (!mounted) return;

		fetch(`${backendUrl}/gas?start=${startDate}&end=${endDate}${get(owner) !== 'All' ? `&owner=${get(owner)}` : ''}`,
			{
				headers: {
					'x-api-key': apiKey
				}
			})
			.then(res => res.json())
			.then((data: GasTransaction[]) => transaction = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
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
</script>

<GasSummary {transaction} />

<div class="canvasWrapper">
	<canvas bind:this={myCanvas} height="400" id="myChart" width="400"></canvas>
</div>

<div
	aria-expanded={transactionsOpen}
	class="section-header"
	on:click={() => transactionsOpen = !transactionsOpen}
	on:keypress={(e) => e.key === 'Enter' && (transactionsOpen = !transactionsOpen)}
	role="button"
	tabindex="0"
>
	Transaction Details
	<span class="material-icons dropdown" class:rotated={transactionsOpen}>{'arrow_drop_down'}</span>
</div>
{#if transactionsOpen}
	<div class="transactions" transition:slide>
		{#each transaction as tx}
			<TransactionWidget transaction={tx} />
		{/each}
	</div>
{/if}

<style>
    .canvasWrapper {
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