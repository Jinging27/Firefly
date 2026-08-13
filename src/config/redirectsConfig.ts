import type { RedirectsConfig } from "../types/redirectsConfig";

const SHORT_LINK_PREFIX = "/go/";
const SHORT_LINK_SOURCE_PATTERN = /^\/go\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;

function assertValidSource(source: string): void {
	if (!source.startsWith(SHORT_LINK_PREFIX) || !source.endsWith("/")) {
		throw new Error(
			`短链接源路径必须以 ${SHORT_LINK_PREFIX} 开头并以 / 结尾：${source}`,
		);
	}

	if (!SHORT_LINK_SOURCE_PATTERN.test(source)) {
		throw new Error(
			`短链接源路径只能使用单段小写字母、数字和单连字符 slug：${source}`,
		);
	}

	if (
		source.includes("?") ||
		source.includes("#") ||
		source.includes("\\") ||
		/\s/.test(source)
	) {
		throw new Error(
			`短链接源路径不能包含查询串、片段、反斜杠或空白字符：${source}`,
		);
	}
}

function assertValidDestination(source: string, destination: string): void {
	if (destination === source) {
		throw new Error(`短链接不能重定向到自身：${source}`);
	}

	if (
		destination.includes("?") ||
		destination.includes("#") ||
		destination.includes("\\") ||
		/\s/.test(destination)
	) {
		throw new Error(
			`短链接目标不能包含查询串、片段、反斜杠或空白字符：${destination}`,
		);
	}

	if (destination.startsWith("/")) {
		const hasDotSegment = destination
			.split("/")
			.some((segment) => segment === "." || segment === "..");

		if (
			destination.startsWith("//") ||
			!destination.endsWith("/") ||
			destination.slice(1).includes("//") ||
			destination.includes("%") ||
			destination.includes("*") ||
			destination.includes(":") ||
			hasDotSegment
		) {
			throw new Error(
				`站内短链接目标必须是无动态匹配、编码分隔符或点路径的规范绝对路径：${destination}`,
			);
		}
		return;
	}

	let url: URL;
	if (!destination.startsWith("https://") || destination.includes("%")) {
		throw new Error(`站外短链接目标必须是完整的 HTTPS URL：${destination}`);
	}

	try {
		url = new URL(destination);
	} catch {
		throw new Error(`站外短链接目标必须是完整的 HTTPS URL：${destination}`);
	}

	if (
		url.protocol !== "https:" ||
		url.username !== "" ||
		url.password !== "" ||
		url.search !== "" ||
		url.hash !== ""
	) {
		throw new Error(`站外短链接目标必须是无凭据的 HTTPS URL：${destination}`);
	}
}

function assertValidRedirectsConfig(config: RedirectsConfig): void {
	for (const [source, rule] of Object.entries(config)) {
		assertValidSource(source);
		if (rule.status !== 301) {
			throw new Error(`短链接只允许使用永久重定向状态码 301：${source}`);
		}
		assertValidDestination(source, rule.destination);
	}
}

export function defineRedirectsConfig(
	config: RedirectsConfig,
): RedirectsConfig {
	assertValidRedirectsConfig(config);

	return Object.freeze(
		Object.fromEntries(
			Object.entries(config).map(([source, rule]) => [
				source,
				Object.freeze({ ...rule }),
			]),
		),
	);
}

export function serializeCloudflareRedirects(config: RedirectsConfig): string {
	assertValidRedirectsConfig(config);

	return `${Object.entries(config)
		.sort(([sourceA], [sourceB]) => sourceA.localeCompare(sourceB, "en"))
		.map(
			([source, { destination, status }]) =>
				`${source} ${destination} ${status}`,
		)
		.join("\n")}\n`;
}

export const redirectsConfig: RedirectsConfig = defineRedirectsConfig({
	"/go/vscode/": {
		status: 301,
		destination: "/posts/vscode-settings-and-extensions/",
	},
	"/go/github/": {
		status: 301,
		destination: "https://github.com/Jinging27",
	},
});
