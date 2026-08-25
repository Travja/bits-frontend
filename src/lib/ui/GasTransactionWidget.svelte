<script lang="ts">
	import type { GasTransaction }        from '$lib/transaction';
	import { formatCurrency, formatDate } from '$lib/lib.js';

	interface Props {
		transaction: GasTransaction;
	}

	let { transaction }: Props = $props();

	// A handful of fill-ups are manual entries with no recorded mileage.
	let hasMpg   = $derived(transaction.mpg != null);
	let hasPrice = $derived(transaction.costPerGallon != null);
</script>

<div class="transaction">
	<div class="accent-bar"></div>
	<div class="details">
		<span class="date">{formatDate(transaction.date)}</span>
		<span class="owner">{transaction.owner}</span>
	</div>
	<div class="description">
		<div class="location">{transaction.location} - {transaction.category}</div>
		{#if hasMpg || hasPrice}
			<div class="stats">
				{#if hasMpg}{transaction.mpg.toFixed(1)} MPG{/if}
				{#if hasMpg && hasPrice}&nbsp;&middot;&nbsp;{/if}
				{#if hasPrice}{formatCurrency(transaction.costPerGallon)}/gal{/if}
			</div>
		{/if}
	</div>
	<div class="value">{formatCurrency(transaction.amount)}</div>
</div>

<style>
    .transaction {
        display: grid;
        grid-template-columns: 4px 1fr 2fr 1fr;
        align-items: center;
        gap: 0.6rem;

        padding: 0.4em 0.6em;
        border-radius: 0.25em;
        background-color: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.5);
    }

    .accent-bar {
        align-self: stretch;
        border-radius: 2px;
        background: red;
    }

    .description {
        justify-self: center;
        text-align: center;
    }

    .location {
        font-size: 1.1em;
    }

    .stats {
        font-size: 0.78em;
        color: gray;
        margin-top: 0.1em;
    }

    .value {
        font-weight: bold;
        justify-self: flex-end;
        color: red;
    }

    .details {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;

        font-size: 0.9em;
    }
</style>
