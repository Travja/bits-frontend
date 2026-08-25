<script lang="ts">
	interface Props {
		options: string[];
		selected: string[];
		label: string; // plural, e.g. "categories" -> "All categories" / "Groceries" / "3 categories"
		onchange: (selected: string[]) => void;
	}

	let { options, selected, label, onchange }: Props = $props();

	let open = $state(false);
	let query = $state('');
	let containerEl: HTMLDivElement | undefined = $state();

	let filteredOptions = $derived(
		query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options
	);

	let triggerText = $derived(
		selected.length === 0 ? `All ${label}`
			: selected.length === 1 ? selected[0]
				: `${selected.length} ${label}`
	);

	const toggle = (opt: string) => {
		onchange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt]);
	};

	const clear = () => onchange([]);

	const toggleOpen = () => {
		open = !open;
		if (open) query = '';
	};

	// A single persistent listener (registered once — `open`/`containerEl` are read inside the
	// callback, not during the effect body, so this doesn't re-run on every state change) closes
	// the panel on an outside click. Bubble phase, so the same click that opens the panel via the
	// trigger button's own onclick doesn't immediately close it again.
	$effect(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (open && containerEl && !containerEl.contains(e.target as Node)) open = false;
		};
		document.addEventListener('click', handleOutsideClick);
		return () => document.removeEventListener('click', handleOutsideClick);
	});
</script>

<div bind:this={containerEl} class="multi-select">
	<button class="multi-select-trigger" onclick={toggleOpen} type="button">
		<span class="multi-select-trigger-text">{triggerText}</span>
		<svg class="multi-select-chevron" class:open fill="none" height="14" viewBox="0 0 24 24" width="14">
			<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
		</svg>
	</button>
	{#if open}
		<div class="multi-select-panel">
			{#if options.length > 8}
				<input bind:value={query} class="multi-select-search" placeholder="Search…" type="search"/>
			{/if}
			<div class="multi-select-list">
				{#each filteredOptions as opt (opt)}
					<label class="multi-select-option">
						<input checked={selected.includes(opt)} onchange={() => toggle(opt)} type="checkbox"/>
						<span>{opt}</span>
					</label>
				{/each}
				{#if filteredOptions.length === 0}
					<div class="multi-select-empty">No matches</div>
				{/if}
			</div>
			{#if selected.length > 0}
				<button class="multi-select-clear" onclick={clear} type="button">Clear ({selected.length})</button>
			{/if}
		</div>
	{/if}
</div>

<style>
    .multi-select {
        position: relative;
    }

    .multi-select-trigger {
        all: unset;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        padding: 0.5em 0.6em;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.375rem;
        background: #fff;
        max-width: 14rem;
    }

    .multi-select-trigger-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .multi-select-chevron {
        flex-shrink: 0;
        color: #777;
        transition: transform 0.2s;
    }

    .multi-select-chevron.open {
        transform: rotate(180deg);
    }

    .multi-select-panel {
        position: absolute;
        top: calc(100% + 0.3rem);
        left: 0;
        z-index: 10;
        width: max(100%, 14rem);
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.5rem;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        padding: 0.5rem;
    }

    .multi-select-search {
        width: 100%;
        box-sizing: border-box;
        font-family: inherit;
        font-size: 0.85rem;
        padding: 0.4em 0.6em;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 0.375rem;
        margin-bottom: 0.4rem;
    }

    .multi-select-list {
        max-height: 14rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .multi-select-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35em 0.4em;
        border-radius: 0.3rem;
        font-size: 0.85rem;
        cursor: pointer;
    }

    .multi-select-option:hover {
        background: #f2f2f2;
    }

    .multi-select-option input {
        cursor: pointer;
    }

    .multi-select-empty {
        padding: 0.5rem;
        font-size: 0.85rem;
        color: gray;
        text-align: center;
    }

    .multi-select-clear {
        all: unset;
        display: block;
        cursor: pointer;
        margin-top: 0.4rem;
        padding-top: 0.4rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        font-size: 0.8rem;
        color: #007bff;
        font-weight: 500;
        text-align: center;
        width: 100%;
    }
</style>
