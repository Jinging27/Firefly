export interface DailyQuote {
	readonly text: string;
	readonly source?: string;
	readonly author?: string;
}

export interface DailyQuoteConfig {
	readonly title: string;
	readonly fallback: DailyQuote;
	readonly timeoutMs: number;
	readonly storageKey: string;
}

export interface DailyQuoteCacheRecord {
	readonly version: 1;
	readonly quote: DailyQuote;
	readonly expiresAt: number;
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}
