<script lang="ts">
	import CashFlow               from '$lib/CashFlow.svelte';
	import { endDate, startDate } from '$lib/date-service';
</script>

<CashFlow bind:endDate={$endDate} bind:startDate={$startDate} />