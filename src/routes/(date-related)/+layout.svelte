<script lang="ts">
	import { endDate, refresh, startDate } from '$lib/date-service';
</script>

<span>
	<input bind:value={$startDate} type="date" />
	to
	<input bind:value={$endDate} type="date" />
</span>
<button on:click={refresh}>Refresh</button>

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