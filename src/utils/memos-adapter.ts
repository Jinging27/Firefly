/**
 * Memos API 客户端适配器
 * 直接从 Memos API 获取数据并转换为动态系统格式
 * @author: CuteLeaf <xiaye@msn.com>
 */

interface MemoAttachment {
	name: string;
	filename: string;
	type: string;
	externalLink: string;
}

interface MemoLocation {
	placeholder?: string;
}

interface Memo {
	name: string;
	state: string;
	creator: string;
	createTime: string;
	updateTime: string;
	content: string;
	visibility: string;
	pinned: boolean;
	attachments: MemoAttachment[];
	location?: MemoLocation;
}

interface MemosApiResponse {
	memos: Memo[];
	nextPageToken: string;
}

export interface FetchMemosOptions {
	pageSize?: number;
	maxPages?: number;
	maxEntries?: number;
	parent?: string;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export interface DynamicImage {
	alt: string;
	src: string;
	title?: string;
}

export interface DynamicEntry {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned?: boolean;
	location?: string;
}

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const PLACEHOLDER_PREFIX = "__FIREFLY_MEMOS_LINK_";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 5;
const MAX_MAX_PAGES = 10;
const DEFAULT_MAX_ENTRIES = 300;
const MAX_MAX_ENTRIES = 300;
const DEFAULT_TIMEOUT_MS = 3000;
const MAX_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_ERROR_RESPONSE_BYTES = 16 * 1024;
const MAX_MEMO_CONTENT_LENGTH = 20000;
const MAX_MEMO_FIELD_LENGTH = 512;
const MAX_LOCATION_LENGTH = 512;
const MAX_ATTACHMENT_COUNT = 20;
const MAX_ATTACHMENT_FIELD_LENGTH = 2048;
const MAX_IMAGES_PER_MEMO = 12;

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function hasUnsafeCharacters(value: string): boolean {
	return [...value].some((character) => {
		const code = character.charCodeAt(0);
		return code <= 0x1f || code === 0x7f;
	});
}

function hasPathTraversal(value: string): boolean {
	try {
		const decodedPath = decodeURIComponent(value)
			.split(/[?#]/, 1)[0]
			.replaceAll("\\", "/");
		return decodedPath.split("/").some((segment) => segment === "..");
	} catch {
		return true;
	}
}

/** 返回可放入 href 的站内相对地址或允许协议的绝对地址。 */
function sanitizeLinkTarget(target: string): string | null {
	const value = target.trim();
	if (!value || hasUnsafeCharacters(value) || value.startsWith("//"))
		return null;

	if (/^(?:[/?#]|\.\.?\/)/.test(value)) {
		// URL 解析会把反斜杠当作斜杠；拒绝它，避免 /\\evil.example
		// 在浏览器中被解释为指向外站的协议相对地址。
		if (value.includes("\\")) return null;
		try {
			const relative = new URL(value, "https://firefly.invalid/");
			if (relative.origin !== "https://firefly.invalid") return null;
		} catch {
			return null;
		}
		return value;
	}

	try {
		const parsed = new URL(value);
		if (
			!SAFE_LINK_PROTOCOLS.has(parsed.protocol) ||
			parsed.username ||
			parsed.password
		)
			return null;
		return parsed.toString();
	} catch {
		return null;
	}
}

/**
 * 将 Markdown 内容转换为简单的 HTML。
 *
 * 先把用户可控的文字和 Markdown 链接拆出并转义，再生成固定标签，
 * 避免远端内容通过 innerHTML 进入脚本、事件属性或任意 HTML。
 */
export function markdownToHtml(markdown: string): string {
	const links: string[] = [];
	let source = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "");
	source = source.replace(
		/\[([^\]]+)\]\(([^)]+)\)/g,
		(_match, label, target) => {
			const safeTarget = sanitizeLinkTarget(target);
			if (!safeTarget) return label;
			const placeholder = `${PLACEHOLDER_PREFIX}${links.length}__`;
			links.push(
				`<a href="${escapeHtml(safeTarget)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
			);
			return placeholder;
		},
	);

	let html = escapeHtml(source)
		// 加粗
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		// 斜体
		.replace(/\*(.+?)\*/g, "<em>$1</em>")
		// 行内代码
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		// 标题
		.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		.replace(/^## (.+)$/gm, "<h2>$1</h2>")
		.replace(/^# (.+)$/gm, "<h1>$1</h1>")
		// 任务列表
		.replace(
			/^- \[x\] (.+)$/gm,
			'<li><input type="checkbox" checked disabled> $1</li>',
		)
		.replace(/^- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
		// 无序列表
		.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>")
		// 引用（HTML 转义后再匹配）
		.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
		// 分割线
		.replace(/^---$/gm, "<hr>");

	// 换行转换为 <br>，但保留段落分隔
	const paragraphs = html.split(/\n\n+/);
	html = paragraphs
		.map((p) => {
			const trimmed = p.trim();
			if (!trimmed) return "";
			// 如果已经是块级元素，不包裹 <p>
			if (/^<[a-z]/.test(trimmed)) return trimmed;
			return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
		})
		.filter(Boolean)
		.join("\n");

	for (const [index, link] of links.entries()) {
		html = html.replaceAll(escapeHtml(`${PLACEHOLDER_PREFIX}${index}__`), link);
	}
	return html;
}

/**
 * 从内容中提取纯文本用于搜索
 */
function extractPlainText(content: string): string {
	return content
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeMemosBaseUrl(memosApiUrl: string): URL | null {
	try {
		const base = new URL(memosApiUrl);
		if (
			base.protocol !== "https:" ||
			base.username ||
			base.password ||
			hasUnsafeCharacters(memosApiUrl)
		) {
			return null;
		}
		base.search = "";
		base.hash = "";
		const path = base.pathname.replace(/\/+$/, "");
		base.pathname = `${path}/`;
		return base;
	} catch {
		return null;
	}
}

function resolveMemosImageUrl(raw: string, memosApiUrl: string): string | null {
	const base = normalizeMemosBaseUrl(memosApiUrl);
	if (!base) return null;

	try {
		const value = raw.trim();
		if (!value || hasUnsafeCharacters(value) || hasPathTraversal(value))
			return null;
		let imageUrl: URL;
		const basePath = base.pathname.replace(/\/+$/, "");
		if (
			value.startsWith("/") &&
			basePath &&
			!value.startsWith(`${basePath}/`)
		) {
			imageUrl = new URL(`${basePath}${value}`, base.origin);
		} else {
			imageUrl = new URL(value, base);
		}
		if (
			imageUrl.protocol !== "https:" ||
			imageUrl.origin !== base.origin ||
			imageUrl.username ||
			imageUrl.password
		) {
			return null;
		}
		if (
			basePath &&
			imageUrl.pathname !== basePath &&
			!imageUrl.pathname.startsWith(`${basePath}/`)
		) {
			return null;
		}
		return imageUrl.toString();
	} catch {
		return null;
	}
}

/**
 * 从 Memos 内容中提取图片，只接受 HTTPS 且与 Memos 实例同源的地址。
 */
export function extractImages(memo: Memo, memosApiUrl: string): DynamicImage[] {
	const images: DynamicImage[] = [];

	// 从 Markdown 内容中提取图片
	const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;
	match = imagePattern.exec(memo.content);
	while (match !== null) {
		const src = resolveMemosImageUrl(match[2], memosApiUrl);
		if (src)
			images.push({ alt: match[1].slice(0, MAX_ATTACHMENT_FIELD_LENGTH), src });
		if (images.length >= MAX_IMAGES_PER_MEMO) return images;
		match = imagePattern.exec(memo.content);
	}

	// 从 Memos 附件中提取图片
	if (Array.isArray(memo.attachments)) {
		for (const attachment of memo.attachments) {
			if (
				attachment.type.startsWith("image/") &&
				attachment.filename.length <= MAX_ATTACHMENT_FIELD_LENGTH &&
				attachment.externalLink.length <= MAX_ATTACHMENT_FIELD_LENGTH
			) {
				// Memos 文件服务路径: /file/attachments/{id}/{filename}
				const attachmentId = attachment.name.split("/").pop() || "";
				const base = normalizeMemosBaseUrl(memosApiUrl);
				if (!base || !attachmentId) continue;
				const basePath = base.pathname.replace(/\/+$/, "");
				const fallback = `${basePath}/file/attachments/${encodeURIComponent(attachmentId)}/${encodeURIComponent(attachment.filename)}`;
				const src = resolveMemosImageUrl(
					attachment.externalLink || fallback,
					memosApiUrl,
				);
				if (src) {
					images.push({
						alt: attachment.filename.slice(0, MAX_ATTACHMENT_FIELD_LENGTH),
						src,
						title: attachment.filename,
					});
					if (images.length >= MAX_IMAGES_PER_MEMO) return images;
				}
			}
		}
	}

	return images;
}

// 请求去重缓存，避免同页面多个组件重复请求
const pendingRequests = new Map<string, Promise<DynamicEntry[]>>();

/**
 * 从 Memos API 获取数据并转换为动态格式
 */
export async function fetchMemos(
	memosApiUrl: string,
	options?: FetchMemosOptions,
): Promise<DynamicEntry[]> {
	const normalized = normalizeFetchOptions(options);
	const cacheKey = [
		memosApiUrl,
		normalized.parent,
		normalized.pageSize,
		normalized.maxPages,
		normalized.maxEntries,
		normalized.timeoutMs,
	].join(":");
	// 带有调用方 AbortSignal 的请求由调用方独占，避免一个组件取消请求时影响另一个组件。
	if (normalized.signal) return fetchMemosInternal(memosApiUrl, normalized);
	const pending = pendingRequests.get(cacheKey);
	if (pending) return pending;

	const promise = fetchMemosInternal(memosApiUrl, normalized);
	pendingRequests.set(cacheKey, promise);
	void promise.then(
		() => pendingRequests.delete(cacheKey),
		() => pendingRequests.delete(cacheKey),
	);
	return promise;
}

function normalizeInteger(
	value: number | undefined,
	fallback: number,
	minimum: number,
	maximum: number,
): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.trunc(value as number)));
}

function normalizeFetchOptions(
	options?: FetchMemosOptions,
): Required<Omit<FetchMemosOptions, "signal">> &
	Pick<FetchMemosOptions, "signal"> {
	return {
		pageSize: normalizeInteger(
			options?.pageSize,
			DEFAULT_PAGE_SIZE,
			1,
			MAX_PAGE_SIZE,
		),
		maxPages: normalizeInteger(
			options?.maxPages,
			DEFAULT_MAX_PAGES,
			1,
			MAX_MAX_PAGES,
		),
		maxEntries: normalizeInteger(
			options?.maxEntries,
			DEFAULT_MAX_ENTRIES,
			1,
			MAX_MAX_ENTRIES,
		),
		parent:
			typeof options?.parent === "string" &&
			options.parent.length <= MAX_MEMO_FIELD_LENGTH
				? options.parent.trim()
				: "",
		timeoutMs: normalizeInteger(
			options?.timeoutMs,
			DEFAULT_TIMEOUT_MS,
			250,
			MAX_TIMEOUT_MS,
		),
		signal: options?.signal,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): value is string {
	return typeof value === "string" && value.length <= maximum;
}

function parseMemo(value: unknown): Memo | null {
	if (!isRecord(value)) return null;
	if (
		!boundedString(value.name, MAX_MEMO_FIELD_LENGTH) ||
		!boundedString(value.state, MAX_MEMO_FIELD_LENGTH) ||
		!boundedString(value.creator, MAX_MEMO_FIELD_LENGTH) ||
		!boundedString(value.createTime, MAX_MEMO_FIELD_LENGTH) ||
		!boundedString(value.updateTime, MAX_MEMO_FIELD_LENGTH) ||
		!boundedString(value.content, MAX_MEMO_CONTENT_LENGTH) ||
		!boundedString(value.visibility, MAX_MEMO_FIELD_LENGTH) ||
		(value.pinned !== undefined && typeof value.pinned !== "boolean")
	)
		return null;

	const rawAttachments =
		value.attachments === undefined ? [] : value.attachments;
	if (
		!Array.isArray(rawAttachments) ||
		rawAttachments.length > MAX_ATTACHMENT_COUNT
	)
		return null;
	const attachments: MemoAttachment[] = [];
	for (const rawAttachment of rawAttachments) {
		if (!isRecord(rawAttachment)) return null;
		if (
			!boundedString(rawAttachment.name, MAX_MEMO_FIELD_LENGTH) ||
			!boundedString(rawAttachment.filename, MAX_ATTACHMENT_FIELD_LENGTH) ||
			!boundedString(rawAttachment.type, MAX_MEMO_FIELD_LENGTH) ||
			!boundedString(rawAttachment.externalLink, MAX_ATTACHMENT_FIELD_LENGTH)
		)
			return null;
		attachments.push({
			name: rawAttachment.name,
			filename: rawAttachment.filename,
			type: rawAttachment.type,
			externalLink: rawAttachment.externalLink,
		});
	}

	let location: MemoLocation | undefined;
	if (value.location !== undefined && value.location !== null) {
		if (!isRecord(value.location)) return null;
		if (
			value.location.placeholder !== undefined &&
			!boundedString(value.location.placeholder, MAX_LOCATION_LENGTH)
		)
			return null;
		location = {
			placeholder: value.location.placeholder as string | undefined,
		};
	}

	return {
		name: value.name,
		state: value.state,
		creator: value.creator,
		createTime: value.createTime,
		updateTime: value.updateTime,
		content: value.content,
		visibility: value.visibility,
		pinned: value.pinned ?? false,
		attachments,
		location,
	};
}

function parseMemosResponse(value: unknown): MemosApiResponse {
	if (!isRecord(value) || !Array.isArray(value.memos)) {
		throw new Error("Memos API 返回的数据结构无效");
	}
	const memos = value.memos
		.map(parseMemo)
		.filter((memo): memo is Memo => memo !== null);
	const nextPageToken = value.nextPageToken;
	if (
		nextPageToken !== undefined &&
		nextPageToken !== null &&
		!boundedString(nextPageToken, MAX_MEMO_FIELD_LENGTH)
	) {
		throw new Error("Memos API 返回的分页标记无效");
	}
	return { memos, nextPageToken: nextPageToken || "" };
}

async function readResponseText(
	response: Response,
	maximumBytes: number,
): Promise<string> {
	if (!response.body) throw new Error("Memos API 响应体不可安全读取");

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
				throw new Error("Memos API 响应体不是有效字节流");
			totalBytes += value.byteLength;
			if (totalBytes > maximumBytes)
				throw new Error("Memos API 响应体超过大小限制");
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

async function fetchMemosPage(
	url: string,
	timeoutMs: number,
	externalSignal?: AbortSignal,
): Promise<MemosApiResponse> {
	const controller = new AbortController();
	let timedOut = false;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let abortListener: (() => void) | undefined;
	if (externalSignal?.aborted) controller.abort();
	else if (externalSignal) {
		abortListener = () => controller.abort();
		externalSignal.addEventListener("abort", abortListener, { once: true });
	}
	timeoutId = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);

	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: controller.signal,
			credentials: "omit",
			referrerPolicy: "no-referrer",
			redirect: "error",
		});
		if (!response.ok) {
			// 错误正文可能包含实例内部信息，不写入浏览器控制台；只读取有限字节，
			// 既确保响应体有明确上限，也避免超限响应继续占用内存。
			let responseBodyError: unknown;
			if (response.body) {
				try {
					await readResponseText(response, MAX_ERROR_RESPONSE_BYTES);
				} catch (error) {
					responseBodyError = error;
				}
			}
			console.error(`[Memos API] 请求失败：${response.status}`);
			if (
				responseBodyError instanceof Error &&
				responseBodyError.message === "Memos API 响应体超过大小限制"
			)
				throw new Error(
					`Memos API 请求失败：${response.status}（响应体超过大小限制）`,
				);
			throw new Error(`Memos API 请求失败：${response.status}`);
		}
		const text = await readResponseText(response, MAX_RESPONSE_BYTES);
		let json: unknown;
		try {
			json = JSON.parse(text);
		} catch {
			throw new Error("Memos API 返回的 JSON 无效");
		}
		return parseMemosResponse(json);
	} catch (error) {
		if (timedOut) throw new Error("Memos API 请求超时");
		throw error;
	} finally {
		if (timeoutId !== undefined) clearTimeout(timeoutId);
		if (externalSignal && abortListener)
			externalSignal.removeEventListener("abort", abortListener);
		controller.abort();
	}
}

async function fetchMemosInternal(
	memosApiUrl: string,
	options: ReturnType<typeof normalizeFetchOptions>,
): Promise<DynamicEntry[]> {
	const base = normalizeMemosBaseUrl(memosApiUrl);
	if (!base) throw new Error("Memos API 地址必须是不含凭据的 HTTPS 地址");
	const pageSize = options.pageSize;
	const maxPages = options.maxPages;
	const maxEntries = options.maxEntries;
	const parent = options.parent;
	const allMemos: Memo[] = [];
	let pageToken = "";

	for (let page = 0; page < maxPages && allMemos.length < maxEntries; page++) {
		const url = new URL("api/v1/memos", base);
		url.searchParams.set(
			"pageSize",
			String(Math.min(pageSize, maxEntries - allMemos.length)),
		);
		if (parent) {
			url.searchParams.set("parent", parent);
		}
		if (pageToken) {
			url.searchParams.set("pageToken", pageToken);
		}

		const data = await fetchMemosPage(
			url.toString(),
			options.timeoutMs,
			options.signal,
		);
		allMemos.push(...data.memos.slice(0, maxEntries - allMemos.length));

		if (!data.nextPageToken) break;
		pageToken = data.nextPageToken;
	}

	return allMemos
		.filter((memo) => memo.state === "NORMAL" && memo.visibility === "PUBLIC")
		.map((memo): DynamicEntry | null => {
			const id = memo.name.split("/").pop() || "";
			const published = new Date(memo.createTime).getTime();
			if (!id || !Number.isFinite(published)) return null;
			const html = markdownToHtml(memo.content);
			const images = extractImages(memo, memosApiUrl);
			const location = memo.location?.placeholder?.trim() || "";
			const searchText = [extractPlainText(memo.content), location]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();
			const pinned = memo.pinned || false;

			return {
				id,
				published,
				html,
				images,
				searchText,
				pinned,
				location,
			};
		})
		.filter((entry): entry is DynamicEntry => entry !== null)
		.sort((a, b) => {
			// 置顶优先，然后按发布时间降序
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return b.published - a.published;
		});
}
