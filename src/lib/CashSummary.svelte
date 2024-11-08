<script lang="ts">
	import { formatCurrency }   from '$lib/lib.js';
	import type { Transaction } from '$lib/transaction';

	export let transaction: Transaction[] = [];
	export let labels: string[]           = [];

	let tithing: number;
	let grossIncome: number;
	let grossExpense: number;
	let netIncome: number;

	$: tithing = grossIncome * 0.1;
	$: grossIncome = transaction.filter(tx => tx.type === 'INCOME').reduce((acc, tx) => acc + tx.amount, 0);
	$: grossExpense = transaction.filter(tx => tx.type === 'EXPENSE').reduce((acc, tx) => acc + tx.amount, 0);
	$: netIncome = grossIncome - tithing - grossExpense;
</script>

<h2 id="summary-header">Summary</h2>
<div class="summary">
	<div class="card" class:negative={grossIncome < 0}>
		<div class="header">Gross Income</div>
		{#if !grossIncome}
			<div class="value">...</div>
		{:else}
			<div class="value">{formatCurrency(grossIncome)}</div>
			<div class="monthly">{formatCurrency(grossIncome / labels.length)}/mo</div>
		{/if}
	</div>
	<div class="card" class:negative={grossExpense < 0}>
		<div class="header">Gross Expense</div>
		{#if !grossExpense}
			<div class="value">...</div>
		{:else}
			<div class="value">{formatCurrency(grossExpense)}</div>
			<div class="monthly">{formatCurrency(grossExpense / labels.length)}/mo</div>
		{/if}
	</div>
	<div class="card" class:negative={tithing < 0}>
		<div class="header">Tithing</div>
		{#if !tithing}
			<div class="value">...</div>
		{:else}
			<div class="value">{formatCurrency(tithing)}</div>
			<div class="monthly">{formatCurrency(tithing / labels.length)}/mo</div>
		{/if}
	</div>
	<div class="card" class:negative={netIncome < 0}>
		<div class="header">Net Income</div>
		{#if !netIncome}
			<div class="value">...</div>
		{:else}
			<div class="value">{formatCurrency(netIncome)}</div>
			<div class="monthly">{formatCurrency(netIncome / labels.length)}/mo</div>
		{/if}
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
        margin: 0.4rem auto;
    }

    .monthly {
        font-size: 0.9rem;
        color: gray;
    }

    .card.negative {
        background: rgba(255, 0, 0, 0.1);
        border: 2px solid rgba(255, 0, 0, 0.3);
    }

    .negative {
        color: red;
    }
</style>