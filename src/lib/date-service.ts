import { writable } from 'svelte/store';
import moment       from 'moment';

export const startDate = writable(moment().subtract(6, 'months').startOf('month').format('YYYY-MM-DD'));
export const endDate   = writable(moment().format('YYYY-MM-DD'));

const refreshCallbacks: (() => void)[] = [];
export const onRefresh = (callback: () => void) => {
	refreshCallbacks.push(callback);
}
export const offRefresh = (callback: () => void) => {
	const index = refreshCallbacks.indexOf(callback);
	if (index > -1) {
		refreshCallbacks.splice(index, 1);
	}
}

export const refresh = () => {
	refreshCallbacks.forEach(callback => callback());
};