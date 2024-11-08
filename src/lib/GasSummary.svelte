<script lang="ts">
	import { formatCurrency }      from '$lib/lib.js';
	import type { GasTransaction } from '$lib/transaction';

	export let transaction: GasTransaction[] = [];

	let avgCost: number;
	let avgPrice: number;
	let avgDistance: number;
	let avgMpg: number;
	let avgCostPerMile: number;

	$: avgCost = transaction.reduce((acc, tx) => acc + tx.amount, 0) / transaction.length;
	$: avgPrice = transaction.reduce((acc, tx) => acc + tx.costPerGallon, 0) / transaction.length;
	$: avgDistance = Math.round(transaction.reduce((acc, tx) => acc + tx.miles, 0) / transaction.length * 100) / 100;
	$: avgMpg = Math.round(transaction.reduce((acc, tx) => acc + tx.mpg, 0) / transaction.length * 100) / 100;
	$: avgCostPerMile = transaction.reduce((acc, tx) => acc + tx.costPerMile, 0) / transaction.length;
</script>

<h2 id="summary-header">Gas Summary</h2>
<div class="summary">
	<div class="card" class:negative={avgCost > 40}>
		<div class="header">Avg Cost</div>
		<div class="value">{avgCost ? formatCurrency(avgCost) : '...'}</div>
	</div>
	<div class="card" class:negative={avgPrice > 4}>
		<div class="header">Avg Price</div>
		<div class="value">{avgPrice ? formatCurrency(avgPrice) : '...'}</div>
	</div>
	<div class="card" class:negative={avgCostPerMile > 0.2}>
		<div class="header">Avg Cost/Mile</div>
		<div class="value">{avgCostPerMile ? formatCurrency(avgCostPerMile) : '...'}</div>
	</div>
	<div class="card">
		<div class="header">Avg Distance</div>
		<div class="value">{avgDistance ? avgDistance + ' mi' : '...'}</div>
	</div>
	<div class="card" class:negative={avgMpg < 18}>
		<div class="header">Avg MPG</div>
		<div class="value">{avgMpg ? avgMpg : '...'}</div>
	</div>
</div>

<style>
    #summary-header {
        display: block;
        width: fit-content;
        margin: 0 auto;
    }

    .summary {
        display: flex;
				flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        margin: 1rem auto 2rem;
        width: 80%;
    }

    .card {
        background: rgba(0, 255, 0, 0.2);
        padding: 1rem;
        border: 2px solid rgba(0, 255, 0, 0.5);
        border-radius: 0.5rem;
        text-align: center;
    }

    .header {
        font-size: 1.5rem;
        font-weight: bold;
        width: max-content;
        margin: 0 auto;
    }

    .value {
        font-size: 2rem;
				width: max-content;
				margin: 0.4rem auto 0;
    }

    .card.negative {
        background: rgba(255, 0, 0, 0.1);
        border: 2px solid rgba(255, 0, 0, 0.3);
    }

    .negative {
        color: red;
    }
</style>