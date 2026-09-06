export type Holiday = {
	name: string;
	date: string;
	source: string;
	verified: boolean;
	sourceUrl?: string;
	coverageYears: readonly number[];
};

export type TimeProgressConfig = {
	title: string;
	holidays: readonly Holiday[];
};
