<script lang="ts">
	import { endDate, refresh, startDate } from '$lib/date-service';
	import { owner }                       from '$lib/stores';
</script>

<span>
	<input bind:value={$startDate} type="date" />
	to
	<input bind:value={$endDate} type="date" />
</span>
<button on:click={refresh}>Refresh</button>

<select bind:value={$owner}>
	<option value="All">All</option>
	<option value="Travis">Travis</option>
	<option value="Dorothy">Dorothy</option>
</select>

<slot></slot>

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