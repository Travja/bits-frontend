<script lang="ts">
	import type { Transaction }           from '$lib/transaction';
	import { formatCurrency, formatDate } from '$lib/lib.js';

    interface Props {
        transaction: Transaction;
    }

    let { transaction }: Props = $props();
</script>

<div class="transaction" class:expense={transaction.type === 'EXPENSE'} class:income={transaction.type === 'INCOME'}>
	<div class="details">
		<span class="date">{formatDate(transaction.date)}</span>
		<span class="owner">{transaction.owner}</span>
	</div>
	<div class="description">{transaction.location} - {transaction.category}</div>
	<div class="value">{formatCurrency(transaction.amount)}</div>
</div>

<style>
    .transaction {
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        align-items: center;
        gap: 0.5rem;

        padding: 0.5em;
        margin: 0.5em 0;
        border-radius: 0.25em;
    }

    .transaction.expense {
        background-color: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.5);
    }

    .transaction.income {
        background-color: rgba(0, 255, 0, 0.1);
        border: 1px solid rgba(0, 255, 0, 0.5);
    }

    .description {
        font-size: 1.1em;
        justify-self: center;
    }

    .value {
        font-weight: bold;
        justify-self: flex-end;
    }

    .income .value {
        color: green;
    }

    .expense .value {
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