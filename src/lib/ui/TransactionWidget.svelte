<script lang="ts">
	import type { Transaction }           from '$lib/transaction';
	import { formatCurrency, formatDate } from '$lib/lib.js';

    interface Props {
        transaction: Transaction;
    }

    let { transaction }: Props = $props();
</script>

<div class="transaction" class:expense={transaction.type === 'EXPENSE'} class:income={transaction.type === 'INCOME'} class:tithing={transaction.type === 'TITHING'}>
	<div class="accent-bar"></div>
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
        grid-template-columns: 4px 1fr 2fr 1fr;
        align-items: center;
        gap: 0.6rem;

        padding: 0.4em 0.6em;
        border-radius: 0.25em;
    }

    .accent-bar {
        align-self: stretch;
        border-radius: 2px;
    }

    .transaction.expense {
        background-color: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.5);
    }

    .transaction.income {
        background-color: rgba(0, 255, 0, 0.1);
        border: 1px solid rgba(0, 255, 0, 0.5);
    }

    .transaction.tithing {
        background-color: rgba(240, 162, 2, 0.1);
        border: 1px solid rgba(210, 140, 0, 0.4);
    }

    .income .accent-bar {
        background: green;
    }

    .expense .accent-bar {
        background: red;
    }

    .tithing .accent-bar {
        background: #b8790a;
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

    .tithing .value {
        color: #b8790a;
    }

    .details {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: flex-start;

        font-size: 0.9em;
    }
</style>