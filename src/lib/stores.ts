import { type Writable, writable } from 'svelte/store';

export const owner: Writable<'All' | 'Travis' | 'Dorothy'> = writable('All');