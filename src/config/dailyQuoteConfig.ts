import type { DailyQuoteConfig } from "../types/dailyQuoteConfig";

const fallback = Object.freeze({
	text: "不积跬步，无以至千里。",
	source: "荀子《劝学》",
});

export const dailyQuoteConfig: DailyQuoteConfig = Object.freeze({
	title: "每日一言",
	fallback,
	timeoutMs: 2_000,
	storageKey: "firefly:daily-quote:v1",
});
