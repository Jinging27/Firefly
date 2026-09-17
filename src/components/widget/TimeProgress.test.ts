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
	test("不再作为左栏独立卡片注册，改由右侧日历承载", () => {
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
		assert.equal(allTypes.filter((type) => type === "timeProgress").length, 0);
		assert.deepEqual(
			leftTypes.slice(
				leftTypes.indexOf("music"),
				leftTypes.indexOf("categories") + 1,
			),
			["music", "dailyQuote", "categories"],
		);
		assert.equal(
			sidebarLayoutConfig.rightComponents.some(
				(component) => component.type === "calendar",
			),
			true,
		);
	});

	test("仅桌面非文章页可见，并按倒计时状态安排刷新", () => {
		const calendar = sidebarLayoutConfig.rightComponents.find(
			(component) => component.type === "calendar",
		);
		assert.ok(calendar);
		assert.equal(calendar.position, "sticky");
		assert.equal(calendar.showOnPostPage, false);
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
