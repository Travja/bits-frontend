<script lang="ts">
    interface Props {
        color?: string;
        size?: string;
        children?: import('svelte').Snippet;
    }

    let { color = 'gray', size = '0.85em', children }: Props = $props();
</script>

<div class="chip" style:--chip-bg="{color}" style:--font-size="{size}">
	{@render children?.()}
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
