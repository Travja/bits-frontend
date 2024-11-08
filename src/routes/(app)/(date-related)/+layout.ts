import { credential } from '$lib/credential';
import { get }        from 'svelte/store';
import { redirect }   from '@sveltejs/kit';

export function load() {
	// Check if we have credentials, if not, redirect to login page
	const credentials = get(credential);
	if (!credentials.username || !credentials.password) {
		console.log('No credentials, redirecting to login page');
		return redirect(307, '/login');
	}
}