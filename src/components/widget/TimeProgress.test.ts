import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { sidebarLayoutConfig } from "../../config/sidebarConfig";

const timeProgressAstro = readFileSync(
	new URL("./TimeProgress.astro", import.meta.url),
	"utf8",
);
const timeProgressClient = readFileSync(
	new URL("./TimeProgressClient.svelte", import.meta.url),
	"utf8",
);
const timeProgressLifecycle = readFileSync(
	new URL("../../utils/time-progress-lifecycle.ts", import.meta.url),
	"utf8",
);

describe("时间进度侧栏布局", () => {
	test("只在左栏配置一次，顺序固定在每日一言和分类之间", () => {
		const leftTypes = sidebarLayoutConfig.leftComponents.map(
			(component) => component.type,
		);
		const allTypes = [
			...leftTypes,
			...sidebarLayoutConfig.rightComponents.map((component) => component.type),
			...sidebarLayoutConfig.mobileBottomComponents.map(
				(component) => component.type,
			),
		];
		assert.equal(allTypes.filter((type) => type === "timeProgress").length, 1);
		assert.deepEqual(
			leftTypes.slice(
				leftTypes.indexOf("music"),
				leftTypes.indexOf("categories") + 1,
			),
			["music", "dailyQuote", "timeProgress", "categories"],
		);
	});

	test("仅桌面非文章页可见，并按倒计时状态安排刷新", () => {
		const config = sidebarLayoutConfig.leftComponents.find(
			(component) => component.type === "timeProgress",
		);
		assert.ok(config);
		assert.equal(config.position, "sticky");
		assert.equal(config.showOnPostPage, false);
		assert.match(timeProgressAstro, /@media \(min-width: 1280px\)/);
		assert.match(timeProgressAstro, /client:visible/);
		assert.match(timeProgressLifecycle, /getTimeProgressRefreshDelay\(true\)/);
		assert.match(timeProgressLifecycle, /getTimeProgressRefreshDelay\(false\)/);
		assert.match(timeProgressLifecycle, /clearInterval\(timer\)/);
		assert.match(timeProgressLifecycle, /clearTimeout\(timer\)/);
		assert.match(timeProgressLifecycle, /MutationObserver/);
		assert.match(timeProgressLifecycle, /IntersectionObserver/);
		assert.match(timeProgressLifecycle, /visibilitychange/);
		assert.match(timeProgressClient, /matchMedia\("\(min-width: 1280px\)"\)/);
		assert.match(timeProgressLifecycle, /registerSwupVisitStart/);
		assert.match(timeProgressLifecycle, /windowRef/);
		assert.match(timeProgressLifecycle, /documentRef/);
		assert.match(timeProgressClient, /role="progressbar"/);
		assert.doesNotMatch(timeProgressClient, /fetch\(|XMLHttpRequest|WebSocket/);
	});
});
