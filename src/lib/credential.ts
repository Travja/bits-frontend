import { derived, type Readable, type Writable, writable } from 'svelte/store';
import { goto }                                            from '$app/navigation';

export const credential: Writable<{ username?: string, password?: string }> = writable({
	username: undefined,
	password: undefined
});

export const setCredential = (username: string, password: string) => {
	credential.set({ username, password });
};

export const basicAuth: Readable<string> = derived(credential, $credential => {
	if (!$credential.username || !$credential.password) return '';
	return btoa(`${$credential.username}:${$credential.password}`);
});

export const logout = () => {
	credential.set({ username: undefined, password: undefined });
	goto('/login').then();
};