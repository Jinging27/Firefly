import assert from "node:assert/strict";
import { test } from "node:test";
import { analyticsConfig } from "./analyticsConfig";

test("Umami 基础统计使用用户提供的 Website ID 和三个确认开关", () => {
	const umami = analyticsConfig.umamiAnalytics;

	assert.equal(umami?.websiteId, "6e95009c-52f6-4dea-a101-c90d2510a986");
	assert.equal(umami?.trackOutboundLinks, true);
	assert.equal(umami?.collectWebVitals, true);
	assert.equal(umami?.replays?.enabled, false);
});

test("本阶段不加载其他统计平台，也不把回放配置视为已启用", () => {
	assert.equal(analyticsConfig.googleAnalyticsId, "");
	assert.equal(analyticsConfig.microsoftClarityId, "");
	assert.equal(analyticsConfig.la51Analytics?.Id, "");
	assert.equal(analyticsConfig.umamiAnalytics?.replays?.enabled, false);
});
