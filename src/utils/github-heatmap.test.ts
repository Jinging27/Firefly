import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildGitHubContributionWeeks,
	createGitHubHeatmapLoader,
	parseGitHubContributions,
	parseGitHubUsername,
} from "./github-heatmap";

const validResponse = {
	total: { "2026": 2, lastYear: 2 },
	contributions: [
		{ date: "2026-09-01", count: 1, level: 1 },
		{ date: "2026-09-02", count: 1, level: 1 },
	],
};
const normalizedData = {
	total: 2,
	contributions: validResponse.contributions,
};

describe("GitHub 热力图数据", () => {
	test("只接受标准 GitHub 用户链接", () => {
		assert.equal(
			parseGitHubUsername("https://github.com/Jinging27"),
			"Jinging27",
		);
		assert.equal(
			parseGitHubUsername("https://github.com/Jinging27/"),
			"Jinging27",
		);
		assert.equal(parseGitHubUsername("http://github.com/Jinging27"), null);
		assert.equal(
			parseGitHubUsername("https://github.com/Jinging27/repo"),
			null,
		);
		assert.equal(
			parseGitHubUsername("https://github.com/Jinging27?tab=overview"),
			null,
		);
		assert.equal(
			parseGitHubUsername("https://github.com/Jinging27#readme"),
			null,
		);
		assert.equal(parseGitHubUsername("https://github.com:443/Jinging27"), null);
		assert.equal(
			parseGitHubUsername("https://user@github.com/Jinging27"),
			null,
		);
		assert.equal(
			parseGitHubUsername("https://user:pass@github.com/Jinging27"),
			null,
		);
	});

	test("校验贡献日期、计数、等级、唯一日期与总数", () => {
		assert.deepEqual(
			parseGitHubContributions(validResponse, 371),
			normalizedData,
		);
		assert.equal(
			parseGitHubContributions(
				{
					...validResponse,
					contributions: [{ date: "2026-02-30", count: 1, level: 1 }],
				},
				371,
			),
			null,
		);
		assert.equal(
			parseGitHubContributions(
				{
					...validResponse,
					contributions: [
						{ date: "2025-01-01", count: 1, level: 1 },
						{ date: "2026-01-10", count: 1, level: 1 },
					],
				},
				371,
			),
			null,
		);
		assert.equal(parseGitHubContributions(validResponse, 0), null);
		assert.equal(parseGitHubContributions(validResponse, Number.NaN), null);
		assert.equal(
			parseGitHubContributions(
				{
					...validResponse,
					contributions: [
						{ date: "2026-09-01", count: 1, level: 1 },
						{ date: "2026-09-01", count: 1, level: 1 },
					],
				},
				371,
			),
			null,
		);
		assert.equal(
			parseGitHubContributions(
				{ ...validResponse, total: { "2026": 3, lastYear: 3 } },
				371,
			),
			null,
		);
		assert.equal(
			parseGitHubContributions({ ...validResponse, total: 2 }, 371),
			null,
		);
		assert.equal(
			parseGitHubContributions(
				{ contributions: validResponse.contributions },
				371,
			),
			null,
		);
		assert.equal(
			parseGitHubContributions(
				{
					...validResponse,
					contributions: [{ date: "2026-09-01", count: -1, level: 1 }],
				},
				371,
			),
			null,
		);
	});

	test("按周排列贡献格子并保留空位", () => {
		const weeks = buildGitHubContributionWeeks({
			total: 2,
			contributions: [
				{ date: "2026-09-08", count: 1, level: 1 },
				{ date: "2026-09-09", count: 1, level: 1 },
			],
		});
		assert.equal(weeks.length, 1);
		assert.equal(weeks[0].length, 7);
		assert.equal(weeks[0][0], null);
		assert.equal(weeks[0][2]?.date, "2026-09-08");
		assert.equal(weeks[0][3]?.date, "2026-09-09");
	});

	test("异常日期跨度不会生成无限周列", () => {
		const weeks = buildGitHubContributionWeeks({
			total: 2,
			contributions: [
				{ date: "2020-01-01", count: 1, level: 1 },
				{ date: "2026-01-01", count: 1, level: 1 },
			],
		});
		assert.deepEqual(weeks, []);
	});

	test("缓存命中且并发请求只发送一次", async () => {
		let calls = 0;
		let requestedUrl = "";
		const storage = new Map<string, string>();
		const storageLike = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		};
		const fetchImpl = async (input: RequestInfo | URL) => {
			calls += 1;
			requestedUrl = String(input);
			return new Response(JSON.stringify(validResponse), {
				headers: { "content-type": "application/json" },
			});
		};
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{ fetchImpl, storage: storageLike, now: () => 1_000 },
		);
		const [first, second] = await Promise.all([loader(), loader()]);
		assert.deepEqual(first, normalizedData);
		assert.deepEqual(second, normalizedData);
		assert.equal(calls, 1);
		assert.equal(
			requestedUrl,
			"https://github-contributions-api.jogruber.de/v4/Jinging27?y=last",
		);
		assert.deepEqual(await loader(), normalizedData);
		assert.equal(calls, 1);
	});

	test("重定向被拒绝时不跟随并安全降级", async () => {
		let redirect: RequestRedirect | undefined;
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async (_input, init) => {
					redirect = init?.redirect;
					throw new TypeError("redirect denied");
				},
			},
		);
		assert.equal(await loader(), null);
		assert.equal(redirect, "error");
	});

	test("网络失败安全降级", async () => {
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async () => {
					throw new Error("offline");
				},
			},
		);
		assert.equal(await loader(), null);
	});

	test("HTTP 错误状态安全降级且不解析响应体", async () => {
		let bodyRead = false;
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async () => {
					const response = new Response("服务暂时不可用", {
						status: 503,
						headers: { "content-type": "application/json" },
					});
					const originalText = response.text.bind(response);
					response.text = async () => {
						bodyRead = true;
						return originalText();
					};
					return response;
				},
			},
		);
		assert.equal(await loader(), null);
		assert.equal(bodyRead, false);
	});

	test("错误 JSON 安全降级", async () => {
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async () =>
					new Response("{不是合法 JSON", {
						headers: { "content-type": "application/json; charset=utf-8" },
					}),
			},
		);
		assert.equal(await loader(), null);
	});

	test("请求超时会中止 fetch 并安全降级", async () => {
		let aborted = false;
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 20,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async (_input, init) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener(
							"abort",
							() => {
								aborted = true;
								reject(new DOMException("请求已中止", "AbortError"));
							},
							{ once: true },
						);
					}),
			},
		);
		assert.equal(await loader(), null);
		assert.equal(aborted, true);
	});

	test("异常配置不会发起请求", async () => {
		let calls = 0;
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "",
				cacheTtlMs: Number.POSITIVE_INFINITY,
				requestTimeoutMs: 0,
				maxDays: 0,
			},
			"Jinging27",
			{
				fetchImpl: async () => {
					calls += 1;
					return new Response();
				},
			},
		);
		assert.equal(await loader(), null);
		assert.equal(calls, 0);
	});

	test("拒绝无穷或非有限的缓存过期时间", async () => {
		const storage = new Map<string, string>();
		const storageLike = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		};
		storage.set(
			"cache",
			JSON.stringify({
				username: "Jinging27",
				data: normalizedData,
			}).replace('"data"', '"expiresAt":1e309,"data"'),
		);
		let calls = 0;
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				storage: storageLike,
				now: () => 1_000,
				fetchImpl: async () => {
					calls += 1;
					return new Response(JSON.stringify(validResponse), {
						headers: { "content-type": "application/json" },
					});
				},
			},
		);
		assert.deepEqual(await loader(), normalizedData);
		assert.equal(calls, 1);
	});

	test("响应体超过限制时安全降级", async () => {
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async () =>
					new Response(JSON.stringify({ padding: "x".repeat(512 * 1024) }), {
						headers: { "content-type": "application/json" },
					}),
			},
		);
		assert.equal(await loader(), null);
	});

	test("Content-Length 超过限制时在读取响应体前安全降级", async () => {
		let bodyRead = false;
		const loader = createGitHubHeatmapLoader(
			{
				title: "GitHub 贡献",
				endpoint: "https://github-contributions-api.jogruber.de/v4",
				cacheKey: "cache",
				cacheTtlMs: 1_000,
				requestTimeoutMs: 2_000,
				maxDays: 371,
			},
			"Jinging27",
			{
				fetchImpl: async () => {
					const response = new Response(JSON.stringify(validResponse), {
						headers: {
							"content-type": "application/json",
							"content-length": String(512 * 1024 + 1),
						},
					});
					const originalText = response.text.bind(response);
					response.text = async () => {
						bodyRead = true;
						return originalText();
					};
					return response;
				},
			},
		);
		assert.equal(await loader(), null);
		assert.equal(bodyRead, false);
	});
});
