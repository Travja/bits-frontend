<script lang="ts">
	export let color = 'gray';
	export let size  = '0.85em';
</script>

<div class="chip" style:--chip-bg="{color}" style:--font-size="{size}">
	<slot></slot>
</div>

<style>
    .chip {
        font-size: var(--font-size, 0.85em);
        display: inline-block;
        margin: 0.5em;
        padding: 0.5em 0.75em;
        background-color: var(--chip-bg, #333);
        color: white;
        border-radius: 100vw;
    }
</style>
