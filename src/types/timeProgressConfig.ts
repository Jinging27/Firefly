export type Holiday = {
	name: string;
	date: string;
	source: string;
	verified: boolean;
	sourceUrl?: string;
	coverageYears: readonly number[];
	kind?: "publicHoliday" | "springFestival";
};

export type TimeProgressConfig = {
	title: string;
	holidays: readonly Holiday[];
	springFestivals: readonly Holiday[];
};
