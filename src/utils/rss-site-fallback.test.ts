import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const rssRoute = readFileSync(
	new URL("../pages/rss.xml.ts", import.meta.url),
	"utf8",
);

describe("RSS 站点域名兜底", () => {
	test("优先使用 Astro 上下文，并在缺失时回退到站点配置", () => {
		assert.match(
			rssRoute,
			/site:\s*context\.site\s*\?\?\s*siteConfig\.site_url/,
		);
	});

	test("不再保留 Firefly 上游演示域名", () => {
		assert.doesNotMatch(rssRoute, /https:\/\/firefly\.cuteleaf\.cn/);
	});
});
