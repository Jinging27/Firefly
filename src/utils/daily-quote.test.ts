import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { DailyQuoteConfig, StorageLike } from "../types/dailyQuoteConfig";
import {
	calculateDailyQuoteExpiry,
	createDailyQuoteLoader,
	parseDailyQuote,
	readDailyQuoteCache,
	requestDailyQuote,
} from "./daily-quote";

const config: DailyQuoteConfig = {
	title: "每日一言",
	fallback: { text: "不积跬步，无以至千里。", source: "荀子《劝学》" },
	timeoutMs: 2_000,
	storageKey: "firefly:daily-quote:v1",
};

class MemoryStorage implements StorageLike {
	readonly values = new Map<string, string>();
	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("parseDailyQuote", () => {
	test("映射合法的一言字段", () => {
		assert.deepEqual(
			parseDailyQuote({
				hitokoto: "山高自有客行路",
				from: "西游记",
				from_who: "吴承恩",
			}),
			{
				text: "山高自有客行路",
				source: "西游记",
				author: "吴承恩",
			},
		);
	});

	for (const [name, value] of [
		["非对象", null],
		["正文不是字符串", { hitokoto: 1 }],
		["正文为空", { hitokoto: "" }],
		["正文超过四十个 Unicode 字符", { hitokoto: "春".repeat(41) }],
		["正文包含控制字符", { hitokoto: "山高\n水长" }],
	] as const) {
		test(`拒绝${name}`, () => {
			assert.equal(parseDailyQuote(value), null);
		});
	}

	test("按 Unicode 字符而非 UTF-16 码元计算正文长度", () => {
		const text = "🌸".repeat(40);
		assert.deepEqual(parseDailyQuote({ hitokoto: text }), { text });
	});

	test("可选来源字段非法时丢弃字段而不拒绝正文", () => {
		assert.deepEqual(
			parseDailyQuote({
				hitokoto: "行到水穷处",
				from: "出处\u0000非法",
				from_who: "作".repeat(81),
			}),
			{ text: "行到水穷处" },
		);
	});

	test("HTML 字符保持普通字符串且不做转换", () => {
		const text = '<img src=x onerror="alert(1)">';
		assert.deepEqual(parseDailyQuote({ hitokoto: text }), { text });
	});

	test("正文会去除首尾 Unicode 空白并拒绝纯空白", () => {
		assert.deepEqual(parseDailyQuote({ hitokoto: "\u3000 山高水长 \u00a0" }), {
			text: "山高水长",
		});
		assert.equal(parseDailyQuote({ hitokoto: " \t\u3000\u00a0 " }), null);
	});

	test("可选字段会去除首尾空白并丢弃纯空白", () => {
		assert.deepEqual(
			parseDailyQuote({
				hitokoto: "正文",
				from: "\u3000 出处 \u00a0",
				from_who: "\u3000\u00a0",
			}),
			{ text: "正文", source: "出处" },
		);
	});

	test("拒绝仅含零宽空格或包含双向控制字符的正文", () => {
		assert.equal(parseDailyQuote({ hitokoto: "\u200b" }), null);
		assert.equal(parseDailyQuote({ hitokoto: "正常\u202e正文" }), null);
	});

	test("可选字段包含零宽或双向控制字符时丢弃字段", () => {
		assert.deepEqual(
			parseDailyQuote({
				hitokoto: "正常正文",
				from: "来源\u200b",
				from_who: "作者\u2066",
			}),
			{ text: "正常正文" },
		);
	});
});

describe("每日一言缓存", () => {
	test("北京时间零点距离超过一小时时以零点为过期时间", () => {
		const now = Date.UTC(2026, 7, 13, 12, 0);
		assert.equal(calculateDailyQuoteExpiry(now), Date.UTC(2026, 7, 13, 16, 0));
	});

	test("北京时间最后一小时内仍至少缓存一小时", () => {
		const now = Date.UTC(2026, 7, 13, 15, 30);
		assert.equal(calculateDailyQuoteExpiry(now), now + 60 * 60 * 1_000);
	});

	test("读取有效缓存并拒绝过期或损坏缓存", () => {
		const storage = new MemoryStorage();
		storage.setItem(
			config.storageKey,
			JSON.stringify({
				version: 1,
				quote: { text: "缓存正文" },
				expiresAt: 2_000,
			}),
		);
		assert.deepEqual(readDailyQuoteCache(storage, config.storageKey, 1_000), {
			text: "缓存正文",
		});
		assert.equal(readDailyQuoteCache(storage, config.storageKey, 2_000), null);
		storage.setItem(config.storageKey, "{损坏");
		assert.equal(readDailyQuoteCache(storage, config.storageKey, 1_000), null);
	});

	test("拒绝缺失或错误 schema version 的缓存", () => {
		const storage = new MemoryStorage();
		storage.setItem(
			config.storageKey,
			JSON.stringify({ quote: { text: "旧缓存" }, expiresAt: 2_000 }),
		);
		assert.equal(readDailyQuoteCache(storage, config.storageKey, 1_000), null);
		storage.setItem(
			config.storageKey,
			JSON.stringify({
				version: 2,
				quote: { text: "错误版本" },
				expiresAt: 2_000,
			}),
		);
		assert.equal(readDailyQuoteCache(storage, config.storageKey, 1_000), null);
	});

	test("拒绝非有限过期时间的缓存", () => {
		const storage = new MemoryStorage();
		storage.setItem(
			config.storageKey,
			'{"version":1,"quote":{"text":"永久缓存"},"expiresAt":1e400}',
		);
		assert.equal(readDailyQuoteCache(storage, config.storageKey, 1_000), null);
	});

	test("localStorage getItem 异常时静默返回 null", () => {
		const storage: StorageLike = {
			getItem() {
				throw new Error("denied");
			},
			setItem() {},
		};
		assert.equal(readDailyQuoteCache(storage, config.storageKey, 1_000), null);
	});
});

describe("requestDailyQuote", () => {
	test("使用固定 URL 与全部安全请求选项并写入成功响应", async () => {
		let input: RequestInfo | URL | undefined;
		let init: RequestInit | undefined;
		const maliciousConfig = {
			...config,
			endpoint: "https://evil.example/collect",
		} as DailyQuoteConfig & { endpoint: string };
		const quote = await requestDailyQuote(maliciousConfig, {
			fetch: async (nextInput, nextInit) => {
				input = nextInput;
				init = nextInit;
				return new Response(JSON.stringify({ hitokoto: "远方有光" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
			setTimeout: () => 1,
			clearTimeout: () => {},
		});
		assert.deepEqual(quote, { text: "远方有光" });
		assert.equal(
			input,
			"https://international.v1.hitokoto.cn/?c=d&c=i&c=k&encode=json&max_length=40",
		);
		assert.equal(init?.method, "GET");
		assert.equal(init?.mode, "cors");
		assert.equal(init?.credentials, "omit");
		assert.equal(init?.referrerPolicy, "no-referrer");
		assert.equal(init?.cache, "no-store");
		assert.equal(init?.redirect, "error");
		assert.ok(init?.signal instanceof AbortSignal);
	});

	test("接受 application/json 与带 +json 的 MIME 类型", async () => {
		for (const contentType of [
			"application/json; charset=utf-8",
			"application/problem+json",
		]) {
			assert.deepEqual(
				await requestDailyQuote(config, {
					fetch: async () =>
						new Response(JSON.stringify({ hitokoto: "合法 JSON" }), {
							status: 200,
							headers: { "content-type": contentType },
						}),
					setTimeout: () => 1,
					clearTimeout: () => {},
				}),
				{ text: "合法 JSON" },
			);
		}
	});

	test("拒绝非 JSON MIME，即使响应正文是合法 JSON", async () => {
		for (const contentType of ["text/plain", "text/json", ""]) {
			assert.equal(
				await requestDailyQuote(config, {
					fetch: async () =>
						new Response(JSON.stringify({ hitokoto: "不可接受" }), {
							status: 200,
							headers: contentType ? { "content-type": contentType } : {},
						}),
					setTimeout: () => 1,
					clearTimeout: () => {},
				}),
				null,
			);
		}
	});

	for (const [name, fetch] of [
		["非 2xx", async () => new Response("{}", { status: 503 })],
		[
			"JSON 异常",
			async () =>
				new Response("not-json", {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		],
		[
			"响应非法",
			async () =>
				new Response(JSON.stringify({ hitokoto: "" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
		],
	] as const) {
		test(`${name}时返回 null`, async () => {
			assert.equal(
				await requestDailyQuote(config, {
					fetch,
					setTimeout: () => 1,
					clearTimeout: () => {},
				}),
				null,
			);
		});
	}

	test("两秒超时会中止请求并返回 null", async () => {
		let delay = 0;
		let aborted = false;
		const result = await requestDailyQuote(config, {
			fetch: (_input, init) =>
				new Promise((_resolve, reject) => {
					const rejectAsAborted = () => {
						aborted = true;
						reject(new DOMException("Aborted", "AbortError"));
					};
					if (init?.signal?.aborted) rejectAsAborted();
					else init?.signal?.addEventListener("abort", rejectAsAborted);
				}),
			setTimeout: (callback, ms) => {
				delay = ms;
				callback();
				return 1;
			},
			clearTimeout: () => {},
		});
		assert.equal(delay, 2_000);
		assert.equal(aborted, true);
		assert.equal(result, null);
	});
});

describe("createDailyQuoteLoader", () => {
	test("有效缓存命中时不发起 fetch", async () => {
		const storage = new MemoryStorage();
		storage.setItem(
			config.storageKey,
			JSON.stringify({
				version: 1,
				quote: { text: "今日缓存" },
				expiresAt: 2_000,
			}),
		);
		let fetchCount = 0;
		const load = createDailyQuoteLoader(config, {
			storage,
			now: () => 1_000,
			fetch: async () => {
				fetchCount++;
				return new Response();
			},
			setTimeout: () => 1,
			clearTimeout: () => {},
		});
		assert.deepEqual(await load(), { text: "今日缓存" });
		assert.equal(fetchCount, 0);
	});

	test("并发调用共用请求，成功后写入缓存", async () => {
		const storage = new MemoryStorage();
		let fetchCount = 0;
		const load = createDailyQuoteLoader(config, {
			storage,
			now: () => Date.UTC(2026, 7, 13, 12),
			fetch: async () => {
				fetchCount++;
				await Promise.resolve();
				return new Response(JSON.stringify({ hitokoto: "并肩看云" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
			setTimeout: () => 1,
			clearTimeout: () => {},
		});
		const [first, second] = await Promise.all([load(), load()]);
		assert.deepEqual(first, { text: "并肩看云" });
		assert.deepEqual(second, first);
		assert.equal(fetchCount, 1);
		assert.deepEqual(JSON.parse(storage.getItem(config.storageKey) ?? "null"), {
			version: 1,
			quote: first,
			expiresAt: Date.UTC(2026, 7, 13, 16),
		});
	});

	test("首次失败后同一 loader 再次调用也不重试", async () => {
		let fetchCount = 0;
		const load = createDailyQuoteLoader(config, {
			storage: new MemoryStorage(),
			now: () => 1_000,
			fetch: async () => {
				fetchCount++;
				return new Response("{}", { status: 500 });
			},
			setTimeout: () => 1,
			clearTimeout: () => {},
		});
		assert.equal(await load(), null);
		assert.equal(await load(), null);
		assert.equal(fetchCount, 1);
	});

	test("setItem 异常不影响成功结果", async () => {
		const storage: StorageLike = {
			getItem: () => null,
			setItem() {
				throw new Error("denied");
			},
		};
		const load = createDailyQuoteLoader(config, {
			storage,
			now: () => 1_000,
			fetch: async () =>
				new Response(JSON.stringify({ hitokoto: "仍然成功" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			setTimeout: () => 1,
			clearTimeout: () => {},
		});
		assert.deepEqual(await load(), { text: "仍然成功" });
	});
});
