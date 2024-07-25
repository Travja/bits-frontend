<script lang="ts">
	import CashFlow from '$lib/CashFlow.svelte';
	import Gas      from '$lib/Gas.svelte';
	import moment   from 'moment';

	let startDate = moment().subtract(6, 'months').startOf('month').format('YYYY-MM-DD');
	let endDate   = moment().format('YYYY-MM-DD');
	let cashFlow: { refresh: () => void };
	let gas: { refresh: () => void };

	const refresh = () => {
		cashFlow.refresh();
		gas.refresh();
	};
</script>

<span>
	<input type="date" bind:value={startDate} />
	to
	<input type="date" bind:value={endDate} />
</span>
<button on:click={refresh}>Refresh</button>
<CashFlow bind:startDate={startDate} bind:endDate={endDate} bind:this={cashFlow} />
<hr />
<Gas bind:startDate={startDate} bind:endDate={endDate} bind:this={gas} />

<style>
    button {
        /* Reset all button styles */
        all: unset;
        padding: 0.5em 1em;
        background-color: #007bff;
        color: white;
        border-radius: 0.25em;
    }
</style>