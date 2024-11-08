import { type Writable, writable } from 'svelte/store';

export let owner: Writable<'All' | 'Travis' | 'Dorothy'> = writable('All');