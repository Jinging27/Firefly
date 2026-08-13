import type {
	DailyQuote,
	DailyQuoteCacheRecord,
	DailyQuoteConfig,
	StorageLike,
} from "../types/dailyQuoteConfig";

const CONTROL_CHARACTER_PATTERN =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: 此正则专门拒绝外部接口返回的控制字符与危险格式字符。
	/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const MAX_QUOTE_LENGTH = 40;
const MAX_METADATA_LENGTH = 80;
const MINIMUM_CACHE_TTL_MS = 60 * 60 * 1_000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1_000;
export const DAILY_QUOTE_ENDPOINT =
	"https://international.v1.hitokoto.cn/?c=d&c=i&c=k&encode=json&max_length=40";

export interface DailyQuoteRequestDependencies {
	readonly fetch: typeof globalThis.fetch;
	readonly setTimeout: (callback: () => void, ms: number) => unknown;
	readonly clearTimeout: (handle: unknown) => void;
}

export interface DailyQuoteLoaderDependencies
	extends DailyQuoteRequestDependencies {
	readonly storage: StorageLike | null;
	readonly now: () => number;
}

function normalizeValidText(value: unknown, maxLength: number): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.normalize().trim();
	return Array.from(normalized).length > 0 &&
		Array.from(normalized).length <= maxLength &&
		!CONTROL_CHARACTER_PATTERN.test(normalized)
		? normalized
		: null;
}

export function parseDailyQuote(value: unknown): DailyQuote | null {
	if (typeof value !== "object" || value === null) return null;

	const record = value as Record<string, unknown>;
	const text = normalizeValidText(record.hitokoto, MAX_QUOTE_LENGTH);
	if (!text) return null;

	const quote: { text: string; source?: string; author?: string } = {
		text,
	};
	const source = normalizeValidText(record.from, MAX_METADATA_LENGTH);
	if (source) {
		quote.source = source;
	}
	const author = normalizeValidText(record.from_who, MAX_METADATA_LENGTH);
	if (author) {
		quote.author = author;
	}
	return quote;
}

export function calculateDailyQuoteExpiry(now: number): number {
	const beijingNow = new Date(now + BEIJING_OFFSET_MS);
	const nextBeijingMidnight =
		Date.UTC(
			beijingNow.getUTCFullYear(),
			beijingNow.getUTCMonth(),
			beijingNow.getUTCDate() + 1,
		) - BEIJING_OFFSET_MS;
	return Math.max(nextBeijingMidnight, now + MINIMUM_CACHE_TTL_MS);
}

export function readDailyQuoteCache(
	storage: StorageLike | null,
	storageKey: string,
	now: number,
): DailyQuote | null {
	if (!storage) return null;
	try {
		const serialized = storage.getItem(storageKey);
		if (!serialized) return null;
		const record = JSON.parse(serialized) as Partial<DailyQuoteCacheRecord>;
		if (
			record.version !== 1 ||
			typeof record.expiresAt !== "number" ||
			!Number.isFinite(record.expiresAt) ||
			record.expiresAt <= now
		) {
			return null;
		}
		return parseCachedQuote(record.quote);
	} catch {
		return null;
	}
}

function parseCachedQuote(value: unknown): DailyQuote | null {
	if (typeof value !== "object" || value === null) return null;
	const record = value as Record<string, unknown>;
	return parseDailyQuote({
		hitokoto: record.text,
		from: record.source,
		from_who: record.author,
	});
}

function writeDailyQuoteCache(
	storage: StorageLike | null,
	storageKey: string,
	record: DailyQuoteCacheRecord,
): void {
	if (!storage) return;
	try {
		storage.setItem(storageKey, JSON.stringify(record));
	} catch {
		// localStorage 可能因隐私模式或容量限制不可用，远程结果仍可正常显示。
	}
}

export async function requestDailyQuote(
	config: DailyQuoteConfig,
	dependencies: DailyQuoteRequestDependencies,
): Promise<DailyQuote | null> {
	const controller = new AbortController();
	const timeout = dependencies.setTimeout(
		() => controller.abort(),
		config.timeoutMs,
	);
	try {
		const response = await dependencies.fetch(DAILY_QUOTE_ENDPOINT, {
			method: "GET",
			mode: "cors",
			credentials: "omit",
			referrerPolicy: "no-referrer",
			cache: "no-store",
			redirect: "error",
			signal: controller.signal,
		});
		if (!response.ok) return null;
		const mimeType = response.headers
			.get("content-type")
			?.split(";", 1)[0]
			?.trim()
			.toLowerCase();
		if (
			mimeType !== "application/json" &&
			!(mimeType?.startsWith("application/") && mimeType.endsWith("+json"))
		) {
			return null;
		}
		return parseDailyQuote(await response.json());
	} catch {
		return null;
	} finally {
		dependencies.clearTimeout(timeout);
	}
}

export function createDailyQuoteLoader(
	config: DailyQuoteConfig,
	dependencies: DailyQuoteLoaderDependencies,
): () => Promise<DailyQuote | null> {
	let result: Promise<DailyQuote | null> | null = null;
	return () => {
		if (result) return result;
		result = (async () => {
			const now = dependencies.now();
			const cached = readDailyQuoteCache(
				dependencies.storage,
				config.storageKey,
				now,
			);
			if (cached) return cached;
			const quote = await requestDailyQuote(config, dependencies);
			if (quote) {
				writeDailyQuoteCache(dependencies.storage, config.storageKey, {
					version: 1,
					quote,
					expiresAt: calculateDailyQuoteExpiry(now),
				});
			}
			return quote;
		})();
		return result;
	};
}
