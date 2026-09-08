import type {
	GitHubContributionData,
	GitHubContributionDay,
	GitHubHeatmapConfig,
	StorageLike,
} from "@/types/githubHeatmapConfig";

const ENDPOINT_ORIGIN = "https://github-contributions-api.jogruber.de";
const USERNAME_PATTERN = /^[A-Za-z0-9-]{1,39}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_COUNT = 10_000;
const MAX_LEVEL = 4;
const MIN_MAX_DAYS = 1;
const MAX_MAX_DAYS = 371;
const MAX_GRID_WEEKS = 54;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const MAX_CACHE_KEY_LENGTH = 128;
const MAX_CACHE_TTL_MS = 31 * 24 * 60 * 60 * 1_000;
const MAX_REQUEST_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 512 * 1024;

type CacheRecord = {
	username: string;
	expiresAt: number;
	data: GitHubContributionData;
};

export function parseGitHubUsername(urlValue: string): string | null {
	try {
		const authority = urlValue.match(/^https:\/\/([^/?#]*)/i)?.[1] ?? "";
		if (authority.toLowerCase() !== "github.com") return null;
		const url = new URL(urlValue);
		if (
			url.protocol !== "https:" ||
			url.hostname !== "github.com" ||
			url.port ||
			url.username ||
			url.password ||
			url.search ||
			url.hash
		)
			return null;
		const [username, ...rest] = url.pathname.split("/").filter(Boolean);
		if (!username || rest.length > 0 || !USERNAME_PATTERN.test(username))
			return null;
		return username;
	} catch {
		return null;
	}
}

function buildGitHubEndpoint(
	endpointValue: string,
	username: string,
): URL | null {
	try {
		const endpoint = new URL(endpointValue);
		if (
			endpoint.origin !== ENDPOINT_ORIGIN ||
			endpoint.pathname.replace(/\/+$/, "") !== "/v4" ||
			endpoint.port ||
			endpoint.username ||
			endpoint.password ||
			endpoint.search ||
			endpoint.hash
		)
			return null;
		endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/${encodeURIComponent(username)}`;
		endpoint.searchParams.set("y", "last");
		return endpoint;
	} catch {
		return null;
	}
}

function parseContributionDay(value: unknown): GitHubContributionDay | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const date = typeof record.date === "string" ? record.date : "";
	const count = typeof record.count === "number" ? record.count : Number.NaN;
	const level = typeof record.level === "number" ? record.level : Number.NaN;
	if (
		!DATE_PATTERN.test(date) ||
		!Number.isInteger(count) ||
		count < 0 ||
		count > MAX_COUNT
	)
		return null;
	if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) return null;
	const parsed = new Date(`${date}T00:00:00Z`);
	if (
		Number.isNaN(parsed.getTime()) ||
		parsed.toISOString().slice(0, 10) !== date
	)
		return null;
	return { date, count, level };
}

function validateContributionDays(
	value: unknown,
	maxDays: number,
): GitHubContributionDay[] | null {
	if (
		!Number.isInteger(maxDays) ||
		maxDays < MIN_MAX_DAYS ||
		maxDays > MAX_MAX_DAYS
	)
		return null;
	if (!Array.isArray(value) || value.length === 0 || value.length > maxDays)
		return null;
	const contributions = value.map(parseContributionDay);
	if (contributions.some((day): day is null => day === null)) return null;
	const validContributions = contributions as GitHubContributionDay[];
	if (
		new Set(validContributions.map((day) => day.date)).size !==
		validContributions.length
	)
		return null;
	const timestamps = validContributions.map((day) =>
		Date.parse(`${day.date}T00:00:00Z`),
	);
	const firstTimestamp = Math.min(...timestamps);
	const lastTimestamp = Math.max(...timestamps);
	if (
		!Number.isFinite(firstTimestamp) ||
		!Number.isFinite(lastTimestamp) ||
		lastTimestamp - firstTimestamp > (maxDays - 1) * MILLISECONDS_PER_DAY
	)
		return null;
	return validContributions;
}

function normalizeValidatedData(
	contributions: GitHubContributionDay[],
	maxDays: number,
): GitHubContributionData | null {
	const total = contributions.reduce((sum, day) => sum + day.count, 0);
	if (total > MAX_COUNT * maxDays) return null;
	return { total, contributions };
}

export function parseGitHubContributions(
	value: unknown,
	maxDays: number,
): GitHubContributionData | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const validContributions = validateContributionDays(
		record.contributions,
		maxDays,
	);
	if (!validContributions) return null;
	const normalized = normalizeValidatedData(validContributions, maxDays);
	if (!normalized) return null;
	const totalRecord = record.total;
	if (!totalRecord || typeof totalRecord !== "object") return null;
	const lastYear = (totalRecord as Record<string, unknown>).lastYear;
	if (
		typeof lastYear !== "number" ||
		!Number.isInteger(lastYear) ||
		lastYear < 0 ||
		lastYear > MAX_COUNT * maxDays ||
		lastYear !== normalized.total
	)
		return null;
	return normalized;
}

function parseCachedContributions(
	value: unknown,
	maxDays: number,
): GitHubContributionData | null {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const contributions = validateContributionDays(record.contributions, maxDays);
	if (!contributions || typeof record.total !== "number") return null;
	const normalized = normalizeValidatedData(contributions, maxDays);
	return normalized && normalized.total === record.total ? normalized : null;
}

/** 将按日期返回的贡献数据排成周列，空位保留为 null。 */
export function buildGitHubContributionWeeks(
	data: GitHubContributionData,
): readonly (readonly (GitHubContributionDay | null)[])[] {
	if (data.contributions.length === 0) return [];
	const sorted = [...data.contributions].sort((left, right) =>
		left.date.localeCompare(right.date),
	);
	const first = new Date(`${sorted[0].date}T00:00:00Z`);
	const last = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
	const alignedSpanDays =
		Math.floor((last.getTime() - first.getTime()) / MILLISECONDS_PER_DAY) +
		1 +
		first.getUTCDay() +
		(6 - last.getUTCDay());
	const weekCount = Math.ceil(alignedSpanDays / 7);
	if (weekCount > MAX_GRID_WEEKS) return [];
	first.setUTCDate(first.getUTCDate() - first.getUTCDay());
	last.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
	const byDate = new Map(sorted.map((day) => [day.date, day]));
	const weeks: (GitHubContributionDay | null)[][] = [];
	for (
		const cursor = new Date(first);
		cursor <= last;
		cursor.setUTCDate(cursor.getUTCDate() + 7)
	) {
		const week: (GitHubContributionDay | null)[] = [];
		for (let day = 0; day < 7; day += 1) {
			const date = new Date(cursor);
			date.setUTCDate(date.getUTCDate() + day);
			week.push(byDate.get(date.toISOString().slice(0, 10)) ?? null);
		}
		weeks.push(week);
	}
	return weeks;
}

function readCache(
	storage: StorageLike | undefined,
	key: string,
	username: string,
	now: number,
	maxDays: number,
): GitHubContributionData | null {
	if (!storage) return null;
	try {
		const record = JSON.parse(
			storage.getItem(key) || "null",
		) as Partial<CacheRecord> | null;
		if (
			!record ||
			record.username !== username ||
			typeof record.expiresAt !== "number" ||
			!Number.isFinite(record.expiresAt) ||
			record.expiresAt <= now
		)
			return null;
		return parseCachedContributions(record.data, maxDays);
	} catch {
		return null;
	}
}

function writeCache(
	storage: StorageLike | undefined,
	key: string,
	username: string,
	data: GitHubContributionData,
	expiresAt: number,
): void {
	if (!storage) return;
	if (!Number.isFinite(expiresAt)) return;
	try {
		storage.setItem(
			key,
			JSON.stringify({ username, expiresAt, data } satisfies CacheRecord),
		);
	} catch {
		// 存储被禁用或已满时仍保留当前请求结果。
	}
}

export function createGitHubHeatmapLoader(
	config: GitHubHeatmapConfig,
	username: string,
	dependencies: {
		fetchImpl: typeof fetch;
		storage?: StorageLike;
		now?: () => number;
	},
): () => Promise<GitHubContributionData | null> {
	let pending: Promise<GitHubContributionData | null> | null = null;
	const validConfig =
		Boolean(config) &&
		typeof config === "object" &&
		typeof config.endpoint === "string" &&
		typeof config.cacheKey === "string" &&
		config.cacheKey.length > 0 &&
		config.cacheKey.length <= MAX_CACHE_KEY_LENGTH &&
		Number.isInteger(config.maxDays) &&
		config.maxDays >= MIN_MAX_DAYS &&
		config.maxDays <= MAX_MAX_DAYS &&
		Number.isFinite(config.cacheTtlMs) &&
		config.cacheTtlMs >= 0 &&
		config.cacheTtlMs <= MAX_CACHE_TTL_MS &&
		Number.isFinite(config.requestTimeoutMs) &&
		config.requestTimeoutMs > 0 &&
		config.requestTimeoutMs <= MAX_REQUEST_TIMEOUT_MS;
	return async () => {
		if (!validConfig || !USERNAME_PATTERN.test(username)) return null;
		if (pending) return pending;
		const now = dependencies.now?.() ?? Date.now();
		const cached = readCache(
			dependencies.storage,
			config.cacheKey,
			username,
			now,
			config.maxDays,
		);
		if (cached) return cached;
		pending = (async () => {
			const controller = new AbortController();
			const timeout = setTimeout(
				() => controller.abort(),
				config.requestTimeoutMs,
			);
			try {
				const endpoint = buildGitHubEndpoint(config.endpoint, username);
				if (!endpoint) return null;
				const response = await dependencies.fetchImpl(endpoint, {
					signal: controller.signal,
					credentials: "omit",
					referrerPolicy: "no-referrer",
					redirect: "error",
					headers: { Accept: "application/json" },
				});
				if (
					!response.ok ||
					!response.headers
						.get("content-type")
						?.toLowerCase()
						.includes("application/json")
				)
					return null;
				const contentLength = response.headers.get("content-length");
				if (contentLength) {
					const declaredBytes = Number(contentLength);
					if (
						!Number.isFinite(declaredBytes) ||
						declaredBytes < 0 ||
						declaredBytes > MAX_RESPONSE_BYTES
					)
						return null;
				}
				const body = await readResponseText(response, MAX_RESPONSE_BYTES);
				const data = parseGitHubContributions(JSON.parse(body), config.maxDays);
				if (data)
					writeCache(
						dependencies.storage,
						config.cacheKey,
						username,
						data,
						now + config.cacheTtlMs,
					);
				return data;
			} catch {
				return null;
			} finally {
				clearTimeout(timeout);
				pending = null;
			}
		})();
		return pending;
	};
}

async function readResponseText(
	response: Response,
	maximumBytes: number,
): Promise<string> {
	if (!response.body) {
		const text = await response.text();
		if (new TextEncoder().encode(text).byteLength > maximumBytes)
			throw new Error("GitHub 热力图响应体超过大小限制");
		return text;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	let completed = false;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				completed = true;
				break;
			}
			if (!(value instanceof Uint8Array))
				throw new Error("GitHub 热力图响应体不是有效字节流");
			totalBytes += value.byteLength;
			if (totalBytes > maximumBytes)
				throw new Error("GitHub 热力图响应体超过大小限制");
			chunks.push(value);
		}
		const bytes = new Uint8Array(totalBytes);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}
		return new TextDecoder().decode(bytes);
	} finally {
		if (!completed) await reader.cancel().catch(() => undefined);
		reader.releaseLock();
	}
}
