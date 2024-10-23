<script lang="ts">
	import Gas    from '$lib/Gas.svelte';
	import { endDate, startDate } from '$lib/date-service';
</script>

<Gas bind:endDate={$endDate} bind:startDate={$startDate} />

<style>

</style>