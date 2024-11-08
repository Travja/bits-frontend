import moment from 'moment';

export const formatDate = (date: string) => {
	return moment(date, 'YYYY-MM-DD').local(false).format('l');
};

export const formatMonth = (date: string) => {
	return moment(date, 'YYYY-MM-DD').local(false).format('MMM YYYY');
};

export const formatCurrency = (amount: number) => {
	return new Intl.NumberFormat('en-US', {
		style:    'currency',
		currency: 'USD'
	}).format(amount);
};

export const backendUrl = import.meta.env.VITE_BACKEND_URL;
export const apiKey = import.meta.env.VITE_API_KEY;