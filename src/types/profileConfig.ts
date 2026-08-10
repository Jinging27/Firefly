export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		appUrl?: string;
		icon: string;
		showName?: boolean;
	}[];
};
