<script lang="ts">
	import { formatCurrency }      from '$lib/lib.js';
	import type { GasTransaction } from '$lib/transaction';
	import { tweened }             from 'svelte/motion';
	import { cubicOut }            from 'svelte/easing';

	interface Props {
		transaction?: GasTransaction[];
	}

	let { transaction = [] }: Props = $props();

	// A handful of fill-ups are manual entries with no recorded mileage — miles/mpg/costPerMile/
	// costPerGallon come back null for those. Average only over transactions that actually have
	// a given field, rather than letting one null poison the whole reduce into NaN.
	const average = (values: (number | null | undefined)[]): number => {
		const present = values.filter((v): v is number => v != null);
		return present.length ? present.reduce((acc, v) => acc + v, 0) / present.length : 0;
	};

	let avgCost: number        = $derived(average(transaction.map(tx => tx.amount)));
	let avgPrice: number       = $derived(average(transaction.map(tx => tx.costPerGallon)));
	let avgDistance: number    = $derived(Math.round(average(transaction.map(tx => tx.miles)) * 100) / 100);
	let avgMpg: number         = $derived(Math.round(average(transaction.map(tx => tx.mpg)) * 100) / 100);
	let avgCostPerMile: number = $derived(average(transaction.map(tx => tx.costPerMile)));

	const tweenOpts = { duration: 500, easing: cubicOut };
	const avgCostT        = tweened(0, tweenOpts);
	const avgPriceT       = tweened(0, tweenOpts);
	const avgDistanceT    = tweened(0, tweenOpts);
	const avgMpgT         = tweened(0, tweenOpts);
	const avgCostPerMileT = tweened(0, tweenOpts);

	$effect(() => { avgCostT.set(avgCost); });
	$effect(() => { avgPriceT.set(avgPrice); });
	$effect(() => { avgDistanceT.set(avgDistance); });
	$effect(() => { avgMpgT.set(avgMpg); });
	$effect(() => { avgCostPerMileT.set(avgCostPerMile); });

	const ACCENT = {
		good:    { bg: 'rgba(26,143,46,0.08)', border: 'rgba(26,143,46,0.3)', fg: '#1a8f2e' },
		bad:     { bg: 'rgba(211,47,47,0.07)', border: 'rgba(211,47,47,0.3)', fg: '#d32f2f' },
		neutral: { bg: 'rgba(0,0,0,0.03)', border: 'rgba(0,0,0,0.12)', fg: '#555' }
	};

	let costAccent        = $derived(avgCost > 40 ? ACCENT.bad : ACCENT.good);
	let priceAccent       = $derived(avgPrice > 4 ? ACCENT.bad : ACCENT.good);
	let costPerMileAccent = $derived(avgCostPerMile > 0.2 ? ACCENT.bad : ACCENT.good);
	let mpgAccent          = $derived(avgMpg && avgMpg < 18 ? ACCENT.bad : ACCENT.good);
</script>

<h2 id="summary-header">Gas Summary</h2>
<div class="summary">
	<div class="card" style:--bg={costAccent.bg} style:--border={costAccent.border} style:--fg={costAccent.fg}>
		<div class="header">Avg Cost</div>
		<div class="value">{avgCost ? formatCurrency($avgCostT) : '...'}</div>
	</div>
	<div class="card" style:--bg={priceAccent.bg} style:--border={priceAccent.border} style:--fg={priceAccent.fg}>
		<div class="header">Avg Price</div>
		<div class="value">{avgPrice ? formatCurrency($avgPriceT) : '...'}</div>
	</div>
	<div class="card" style:--bg={costPerMileAccent.bg} style:--border={costPerMileAccent.border} style:--fg={costPerMileAccent.fg}>
		<div class="header">Avg Cost/Mile</div>
		<div class="value">{avgCostPerMile ? formatCurrency($avgCostPerMileT) : '...'}</div>
	</div>
	<div class="card" style:--bg={ACCENT.neutral.bg} style:--border={ACCENT.neutral.border} style:--fg={ACCENT.neutral.fg}>
		<div class="header">Avg Distance</div>
		<div class="value">{avgDistance ? $avgDistanceT.toFixed(2) + ' mi' : '...'}</div>
	</div>
	<div class="card" style:--bg={mpgAccent.bg} style:--border={mpgAccent.border} style:--fg={mpgAccent.fg}>
		<div class="header">Avg MPG</div>
		<div class="value">{avgMpg ? $avgMpgT.toFixed(2) : '...'}</div>
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
        margin: 0.35rem 0 0;
    }
</style>
