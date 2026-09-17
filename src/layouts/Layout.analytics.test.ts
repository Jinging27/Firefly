import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layoutSource = readFileSync(
	new URL("./Layout.astro", import.meta.url),
	"utf8",
);
const umamiSource = readFileSync(
	new URL("../components/analytics/UmamiAnalytics.astro", import.meta.url),
	"utf8",
);

test("统计脚本只在生产环境按 ID 条件注入", () => {
	assert.match(layoutSource, /const isProduction = import\.meta\.env\.PROD/);
	assert.match(
		layoutSource,
		/\{isProduction && analyticsConfig\?\.googleAnalyticsId &&/,
	);
	assert.match(
		layoutSource,
		/\{isProduction && analyticsConfig\?\.microsoftClarityId &&/,
	);
	assert.match(
		layoutSource,
		/\{isProduction && analyticsConfig\?\.umamiAnalytics\?\.websiteId &&/,
	);
	assert.match(
		layoutSource,
		/\{isProduction && analyticsConfig\?\.la51Analytics\?\.Id &&/,
	);
});

test("Umami 脚本使用 defer，避免阻塞首屏解析", () => {
	assert.match(umamiSource, /<script[\s\S]*defer[\s\S]*src=\{scriptUrl\}/);
	assert.match(umamiSource, /data-performance=\{collectWebVitals \? "true"/);
	assert.match(umamiSource, /data-umami-event-url/);
});
