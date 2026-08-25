<script lang="ts">
	import { endDate, refresh, startDate } from '$lib/date-service';
	import { owner }                       from '$lib/stores';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="global-toolbar">
	<div class="date-range">
		<input bind:value={$startDate} type="date" />
		<span>to</span>
		<input bind:value={$endDate} type="date" />
	</div>
	<button class="refresh-btn" onclick={refresh}>Refresh</button>
	<select bind:value={$owner}>
		<option value="All">All owners</option>
		<option value="Travis">Travis</option>
		<option value="Dorothy">Dorothy</option>
	</select>
</div>

{@render children?.()}

<style>
    .global-toolbar {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.6rem;

        max-width: 940px;
        margin: 1rem auto 0;
        padding: 0.85rem 1rem;
        background: #f7f7f8;
        border-radius: 0.625rem;
    }

    .date-range {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: gray;
        font-size: 0.9rem;
    }

    input[type='date'],
    select {
        font-family: inherit;
        font-size: 0.9rem;
        padding: 0.45em 0.6em;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.375rem;
        background: #fff;
    }

    .refresh-btn {
        /* Reset all button styles */
        all: unset;
        cursor: pointer;
        padding: 0.5em 1em;
        background-color: #007bff;
        color: white;
        border-radius: 0.375rem;
        font-size: 0.9rem;
        font-weight: 500;
    }

    .refresh-btn:hover {
        background-color: #0069d9;
    }
</style>
