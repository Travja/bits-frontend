<script lang="ts">
	import { formatCurrency }   from '$lib/lib.js';
	import type { Transaction } from '$lib/transaction';

	interface Props {
		transaction?: Transaction[];
		labels?: string[];
		tithingOwed?: number;
	}

	let { transaction = [], labels = [], tithingOwed = 0 }: Props = $props();

	let grossIncome: number    = $derived(transaction.filter(tx => tx.type === 'INCOME').reduce((acc, tx) => acc + tx.amount, 0));
	let grossExpense: number   = $derived(transaction.filter(tx => tx.type === 'EXPENSE').reduce((acc, tx) => acc + tx.amount, 0));
	let accruedTithing: number = $derived(grossIncome * 0.1);
	let tithingPaid: number    = $derived(transaction.filter(tx => tx.type === 'TITHING').reduce((acc, tx) => acc + tx.amount, 0));
	let netIncome: number      = $derived(grossIncome - accruedTithing - grossExpense);

	const ACCENT = {
		income:  { bg: 'rgba(26,143,46,0.08)', border: 'rgba(26,143,46,0.3)', fg: '#1a8f2e' },
		expense: { bg: 'rgba(211,47,47,0.07)', border: 'rgba(211,47,47,0.3)', fg: '#d32f2f' },
		tithing: { bg: 'rgba(184,121,10,0.09)', border: 'rgba(184,121,10,0.3)', fg: '#b8790a' },
		neutral: { bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.12)', fg: '#555' }
	};

	let netAccent = $derived(netIncome < 0 ? ACCENT.expense : ACCENT.income);
	let owedAccent = $derived(tithingOwed > 0 ? ACCENT.tithing : ACCENT.neutral);
</script>

<h2 id="summary-header">Summary</h2>
<div class="summary">
	<div class="card" style:--bg={ACCENT.income.bg} style:--border={ACCENT.income.border} style:--fg={ACCENT.income.fg}>
		<div class="header">Gross Income</div>
		{#if !grossIncome}
			<div class="value">...</div>
		{:else}
			<div class="value">{formatCurrency(grossIncome)}</div>
			<div class="monthly">{formatCurrency(grossIncome / labels.length)}/mo</div>
		{/if}
	</div>
	<div class="card" style:--bg={ACCENT.expense.bg} style:--border={ACCENT.expense.border} style:--fg={ACCENT.expense.fg}>
		<div class="header">Gross Expense</div>
		{#if !grossExpense}
			<div class="value">...</div>
		{:else}
			<div class="value">{formatCurrency(grossExpense)}</div>
			<div class="monthly">{formatCurrency(grossExpense / labels.length)}/mo</div>
		{/if}
	</div>
	<div class="card" style:--bg={ACCENT.tithing.bg} style:--border={ACCENT.tithing.border} style:--fg={ACCENT.tithing.fg}>
		<div class="header">Tithing Paid</div>
		<div class="value">{formatCurrency(tithingPaid)}</div>
		<div class="monthly">{formatCurrency(tithingPaid / labels.length)}/mo</div>
	</div>
	<div class="card" style:--bg={owedAccent.bg} style:--border={owedAccent.border} style:--fg={owedAccent.fg}>
		<div class="header">Tithing Owed</div>
		<div class="value">{formatCurrency(tithingOwed)}</div>
	</div>
	<div class="card" style:--bg={netAccent.bg} style:--border={netAccent.border} style:--fg={netAccent.fg}>
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
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: 0.75rem;
        max-width: 940px;
        margin: 1rem auto 2rem;
    }

    .card {
        background: var(--bg);
        border: 1px solid var(--border);
        border-top: 3px solid var(--fg);
        border-radius: 0.625rem;
        padding: 1rem 1.1rem;
        text-align: center;
    }

    .header {
        font-size: 0.82rem;
        font-weight: 600;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }

    .value {
        font-size: 1.7rem;
        font-weight: 700;
        color: var(--fg);
        margin: 0.35rem 0;
    }

    .monthly {
        font-size: 0.82rem;
        color: gray;
    }
</style>
