export interface Transaction {
	amount: number,
	category: string,
	date: string,
	id: number,
	location: string,
	recurring?: boolean,
	type: 'INCOME' | 'EXPENSE',
	owner: string
}

export interface GasTransaction extends Transaction {
	miles: number,
	gallons: number,
	mpg: number,
	costPerMile: number,
	costPerGallon: number
};