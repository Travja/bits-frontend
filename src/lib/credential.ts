import { derived, type Readable, type Writable, writable } from 'svelte/store';
import { goto }                                            from '$app/navigation';
import { resolve }                                         from '$app/paths';
import { browser }                                         from '$app/environment';

type Credential = { username?: string, password?: string };

const STORAGE_KEY = 'credential';

// Persisted to sessionStorage so a refresh doesn't drop the session, but it still
// clears when the tab/browser closes rather than lingering indefinitely like localStorage would.
const loadStoredCredential = (): Credential => {
	if (!browser) return { username: undefined, password: undefined };
	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		if (!stored) return { username: undefined, password: undefined };
		return JSON.parse(stored) as Credential;
	} catch {
		return { username: undefined, password: undefined };
	}
};

export const credential: Writable<Credential> = writable(loadStoredCredential());

export const setCredential = (username: string, password: string) => {
	credential.set({ username, password });
	if (browser) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ username, password }));
};

export const basicAuth: Readable<string> = derived(credential, $credential => {
	if (!$credential.username || !$credential.password) return '';
	return btoa(`${$credential.username}:${$credential.password}`);
});

export const logout = () => {
	credential.set({ username: undefined, password: undefined });
	if (browser) sessionStorage.removeItem(STORAGE_KEY);
	goto(resolve('/login')).then();
};
