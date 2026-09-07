export type GitHubContributionDay = {
	date: string;
	count: number;
	level: number;
};

export type GitHubContributionData = {
	total: number;
	contributions: readonly GitHubContributionDay[];
};

export type GitHubHeatmapConfig = {
	title: string;
	endpoint: string;
	cacheKey: string;
	cacheTtlMs: number;
	requestTimeoutMs: number;
	maxDays: number;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
