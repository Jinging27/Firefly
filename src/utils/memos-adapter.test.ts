import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { extractImages, fetchMemos, markdownToHtml } from "./memos-adapter";

const memosUrl = "https://memos.example.com";

interface TestMemoOverrides {
	name?: string;
	state?: string;
	visibility?: string;
	content?: string;
	createTime?: string;
	updateTime?: string;
	pinned?: boolean;
	attachments?: Array<{
		name: string;
		filename: string;
		type: string;
		externalLink: string;
	}>;
}

function makeMemo(overrides: TestMemoOverrides = {}) {
	return {
		name: overrides.name ?? "memos/1",
		state: overrides.state ?? "NORMAL",
		creator: "users/1",
		createTime: overrides.createTime ?? "2026-09-06T00:00:00Z",
		updateTime: overrides.updateTime ?? "2026-09-06T00:00:00Z",
		content: overrides.content ?? "一条公开动态",
		visibility: overrides.visibility ?? "PUBLIC",
		pinned: overrides.pinned ?? false,
		attachments: overrides.attachments ?? [],
	};
}

function jsonResponse(value: unknown, status = 200): Response {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
}

async function withFetchMock<T>(
	implementation: typeof fetch,
	callback: () => Promise<T>,
): Promise<T> {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = implementation;
	try {
		return await callback();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

describe("Memos Markdown 安全转换", () => {
	test("保留允许的 Markdown 结构并转义原始 HTML", () => {
		const html = markdownToHtml(
			"# 标题\n\n**加粗**、*强调*、`代码`\n\n[站点](https://example.com)\n\n<script>alert(1)</script>",
		);

		assert.match(html, /<h1>标题<\/h1>/);
		assert.match(html, /<strong>加粗<\/strong>/);
		assert.match(html, /<em>强调<\/em>/);
		assert.match(html, /<code>代码<\/code>/);
		assert.match(html, /<a href="https:\/\/example\.com\/"/);
		assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
		assert.doesNotMatch(html, /<script|onerror|style=/i);
	});

	test("拒绝危险链接、事件属性、样式和嵌入内容", () => {
		const html = markdownToHtml(
			'[危险](javascript:alert(1)) [数据](data:text/html,boom)\n\n<img src="x" onerror="alert(1)"><iframe src="https://evil.example"></iframe><div style="color:red">文本</div>',
		);

		assert.doesNotMatch(
			html,
			/href="(?:javascript:|data:)|<iframe|<img|<div|<[^>]+\s+onerror=/i,
		);
		assert.match(html, /危险/);
		assert.match(html, /数据/);
	});

	test("允许受控的相对链接和 mailto 链接", () => {
		const html = markdownToHtml(
			"[站内](/about/) [锚点](#section) [邮件](mailto:test@example.com)",
		);

		assert.match(html, /href="\/about\/"/);
		assert.match(html, /href="#section"/);
		assert.match(html, /href="mailto:test@example.com"/);
	});

	test("保留引用和任务列表的语义", () => {
		const html = markdownToHtml("> 这是引用\n\n- [x] 已完成\n- [ ] 待完成");

		assert.match(html, /<blockquote>这是引用<\/blockquote>/);
		assert.match(html, /<input type="checkbox" checked disabled>/);
		assert.match(html, /<input type="checkbox" disabled>/);
		assert.doesNotMatch(html, /<li>\[x\]/);
	});

	test("保留普通无序列表和分隔线语义", () => {
		const html = markdownToHtml("- 第一项\n- 第二项\n\n---");

		assert.match(html, /<li>第一项<\/li>/);
		assert.match(html, /<li>第二项<\/li>/);
		assert.match(html, /<hr>/);
	});

	test("拒绝危险链接的大小写、控制字符和凭据变体", () => {
		const html = markdownToHtml(
			"[大小写](JaVaScRiPt:alert(1)) [控制字符](java\nscript:alert(1)) [凭据](https://user:pass@example.com/) [外站](https://evil.example/)",
		);

		assert.doesNotMatch(html, /href="(?:javascript:|https:\/\/user:pass)/i);
		assert.match(html, /大小写/);
		assert.match(html, /控制字符/);
		assert.match(html, /凭据/);
		assert.match(html, /外站/);
	});

	test("拒绝会被浏览器解析成协议相对外站地址的反斜杠链接", () => {
		const html = markdownToHtml(
			"[反斜杠](/\\\\evil.example/private) [编码反斜杠](/%5cevil.example/private)",
		);

		assert.doesNotMatch(html, /href="\/\\\\evil\.example/);
		assert.match(html, /反斜杠/);
		assert.match(html, /编码反斜杠/);
	});
});

describe("Memos 图片来源校验", () => {
	test("只保留 HTTPS 且与 Memos 实例同源的图片", () => {
		const images = extractImages(
			{
				name: "memos/test",
				state: "NORMAL",
				creator: "users/1",
				createTime: "2026-09-06T00:00:00Z",
				updateTime: "2026-09-06T00:00:00Z",
				visibility: "PUBLIC",
				pinned: false,
				content:
					"![同源](/file/a.png) ![外站](https://evil.example/a.png) ![协议](http://memos.example.com/a.png) ![协议](data:image/png;base64,boom)",
				attachments: [
					{
						name: "attachments/1",
						filename: "one.png",
						type: "image/png",
						externalLink: "https://memos.example.com/file/one.png",
					},
					{
						name: "attachments/2",
						filename: "two.png",
						type: "image/png",
						externalLink: "https://evil.example/file/two.png",
					},
				],
			},
			memosUrl,
		);

		assert.deepEqual(
			images.map((image) => image.src),
			[
				"https://memos.example.com/file/a.png",
				"https://memos.example.com/file/one.png",
			],
		);
	});

	test("拒绝图片中的控制字符、协议大小写、凭据、外站和路径穿越", () => {
		const images = extractImages(
			{
				...makeMemo({
					content:
						"![大小写](HTTPS://memos.example.com/memos/ok.png) ![控制](https://memos.example.com/ok\n.png) ![凭据](https://user:pass@memos.example.com/private.png) ![外站](https://memos.example.com.evil.example/a.png) ![穿越](../outside.png)",
				}),
			},
			"https://memos.example.com/memos",
		);

		assert.deepEqual(
			images.map((image) => image.src),
			["https://memos.example.com/memos/ok.png"],
		);
	});

	test("拒绝编码路径穿越和反斜杠路径穿越", () => {
		const images = extractImages(
			{
				...makeMemo({
					content:
						"![编码](images/%2e%2e/private.png) ![编码斜杠](images%2f..%2fprivate.png) ![反斜杠](images\\..\\private.png)",
				}),
			},
			"https://memos.example.com/memos",
		);

		assert.deepEqual(images, []);
	});

	test("附件只接受同源 HTTPS 图片，并编码附件路径", () => {
		const images = extractImages(
			{
				...makeMemo({
					attachments: [
						{
							name: "attachments/one",
							filename: "a/b.png",
							type: "image/png",
							externalLink: "",
						},
						{
							name: "attachments/two",
							filename: "two.png",
							type: "image/png",
							externalLink: "https://user:pass@memos.example.com/two.png",
						},
						{
							name: "attachments/three",
							filename: "three.png",
							type: "image/png",
							externalLink: "https://evil.example/three.png",
						},
					],
				}),
			},
			memosUrl,
		);

		assert.deepEqual(
			images.map((image) => image.src),
			["https://memos.example.com/file/attachments/one/a%2Fb.png"],
		);
	});
});

describe("Memos API 安全边界", () => {
	test("拒绝无效 JSON 和无效顶层结构", async () => {
		await assert.rejects(
			withFetchMock(
				async () => new Response("{not-json", { status: 200 }),
				() => fetchMemos(`${memosUrl}/invalid-json`),
			),
			/Memos API 返回的 JSON 无效/,
		);

		await assert.rejects(
			withFetchMock(
				async () => jsonResponse({ memos: "not-an-array" }),
				() => fetchMemos(`${memosUrl}/invalid-shape`),
			),
			/Memos API 返回的数据结构无效/,
		);
	});

	test("非 2xx 响应只记录状态码，不泄露响应正文", async () => {
		const messages: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			messages.push(args.map(String).join(" "));
		};
		try {
			await assert.rejects(
				withFetchMock(
					async () =>
						new Response("实例内部敏感错误信息", {
							status: 500,
							headers: { "content-type": "text/plain" },
						}),
					() => fetchMemos(`${memosUrl}/server-error`),
				),
				/Memos API 请求失败：500/,
			);
		} finally {
			console.error = originalError;
		}

		assert.deepEqual(messages, ["[Memos API] 请求失败：500"]);
		assert.doesNotMatch(messages.join("\n"), /实例内部敏感错误信息/);
	});

	test("只返回 NORMAL 且 PUBLIC 的动态", async () => {
		const result = await withFetchMock(
			async () =>
				jsonResponse({
					memos: [
						makeMemo({ name: "memos/public" }),
						makeMemo({ name: "memos/draft", state: "DRAFT" }),
						makeMemo({ name: "memos/private", visibility: "PRIVATE" }),
					],
					nextPageToken: "",
				}),
			() => fetchMemos(`${memosUrl}/filter`),
		);

		assert.deepEqual(
			result.map((entry) => entry.id),
			["public"],
		);
	});

	test("忽略非法字段、超长内容和超大附件数组", async () => {
		const result = await withFetchMock(
			async () =>
				jsonResponse({
					memos: [
						makeMemo({ name: "memos/valid" }),
						{ ...makeMemo({ name: "memos/bad-pinned" }), pinned: "yes" },
						makeMemo({
							name: "memos/long-content",
							content: "x".repeat(20001),
						}),
						makeMemo({
							name: "memos/many-attachments",
							attachments: Array.from({ length: 21 }, (_, index) => ({
								name: `attachments/${index}`,
								filename: `${index}.png`,
								type: "image/png",
								externalLink: "",
							})),
						}),
					],
					nextPageToken: "",
				}),
			() => fetchMemos(`${memosUrl}/invalid-fields`),
		);

		assert.deepEqual(
			result.map((entry) => entry.id),
			["valid"],
		);
	});

	test("拒绝超长分页标记", async () => {
		await assert.rejects(
			withFetchMock(
				async () =>
					jsonResponse({
						memos: [],
						nextPageToken: "x".repeat(513),
					}),
				() => fetchMemos(`${memosUrl}/long-page-token`),
			),
			/Memos API 返回的分页标记无效/,
		);
	});

	test("按 maxPages 和 maxEntries 限制分页请求，并编码分页标记", async () => {
		const requests: string[] = [];
		const result = await withFetchMock(
			async (input, init) => {
				const url = String(input);
				requests.push(url);
				assert.equal(init?.credentials, "omit");
				assert.equal(init?.redirect, "error");
				assert.equal(init?.referrerPolicy, "no-referrer");
				if (requests.length === 1) {
					return jsonResponse({
						memos: [makeMemo({ name: "memos/one" })],
						nextPageToken: "next page/1",
					});
				}
				return jsonResponse({
					memos: [
						makeMemo({ name: "memos/two" }),
						makeMemo({ name: "memos/three" }),
					],
					nextPageToken: "should-not-be-used",
				});
			},
			() =>
				fetchMemos(`${memosUrl}/pagination`, {
					pageSize: 2,
					maxPages: 2,
					maxEntries: 2,
				}),
		);

		assert.equal(requests.length, 2);
		assert.match(requests[0], /pageSize=2/);
		assert.match(requests[1], /pageSize=1/);
		assert.equal(
			new URL(requests[1]).searchParams.get("pageToken"),
			"next page/1",
		);
		assert.deepEqual(
			result.map((entry) => entry.id),
			["one", "two"],
		);
	});

	test("达到 maxPages 后不再请求后续页", async () => {
		let calls = 0;
		const result = await withFetchMock(
			async () => {
				calls += 1;
				return jsonResponse({
					memos: [makeMemo({ name: `memos/page-${calls}` })],
					nextPageToken: "more",
				});
			},
			() =>
				fetchMemos(`${memosUrl}/max-pages`, {
					maxPages: 1,
					maxEntries: 10,
				}),
		);

		assert.equal(calls, 1);
		assert.deepEqual(
			result.map((entry) => entry.id),
			["page-1"],
		);
	});

	test("拒绝超过响应体上限的响应", async () => {
		const oversizedBody = "x".repeat(1024 * 1024 + 1);

		await assert.rejects(
			withFetchMock(
				async () => new Response(oversizedBody, { status: 200 }),
				() => fetchMemos(`${memosUrl}/oversized`),
			),
			/Memos API 响应体超过大小限制/,
		);
	});

	test("超时会中止请求并返回明确错误", async () => {
		await assert.rejects(
			withFetchMock(
				async (_input, init) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () => {
							reject(new DOMException("Aborted", "AbortError"));
						});
					}),
				() => fetchMemos(`${memosUrl}/timeout`, { timeoutMs: 250 }),
			),
			/Memos API 请求超时/,
		);
	});

	test("尊重调用方 AbortSignal，且不会误报为超时", async () => {
		const controller = new AbortController();
		const request = withFetchMock(
			async (_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => {
						reject(new DOMException("Aborted", "AbortError"));
					});
				}),
			() =>
				fetchMemos(`${memosUrl}/external-abort`, { signal: controller.signal }),
		);
		setTimeout(() => controller.abort(), 10);

		await assert.rejects(request, { name: "AbortError" });
	});

	test("拒绝不安全的 Memos API 地址且不发起请求", async () => {
		let calls = 0;
		const fetchMock = async () => {
			calls += 1;
			return jsonResponse({ memos: [], nextPageToken: "" });
		};

		for (const url of [
			"http://memos.example.com",
			"https://user:pass@memos.example.com",
			"https://memos.example.com/line\nbreak",
		]) {
			await assert.rejects(
				withFetchMock(fetchMock, () => fetchMemos(url)),
				/Memos API 地址必须是不含凭据的 HTTPS 地址/,
			);
		}
		assert.equal(calls, 0);
	});
});
