import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sidebarLayoutConfig } from "../../config/sidebarConfig";

const calendarAstro = readFileSync(
	new URL("./Calendar.astro", import.meta.url),
	"utf8",
);

test("日历承载月度、年度、最近节日和春节信息", () => {
	const leftTypes = sidebarLayoutConfig.leftComponents.map(
		(component) => component.type,
	);
	const calendar = sidebarLayoutConfig.rightComponents.find(
		(component) => component.type === "calendar",
	);
	assert.ok(calendar);
	assert.equal(leftTypes.includes("timeProgress"), false);
	assert.equal(calendar.showOnPostPage, false);
	assert.match(calendarAstro, /data-time-progress-widget/);
	assert.match(calendarAstro, /showWeek=\{false\}/);
	assert.match(calendarAstro, /showEmptyCountdown=\{true\}/);
	assert.match(
		calendarAstro,
		/springFestivals=\{timeProgressConfig\.springFestivals\}/,
	);
	assert.match(calendarAstro, /getNextSpringFestivalCountdown/);
});

test("日历仍保留文章数据、切月和年度热力图入口", () => {
	assert.match(calendarAstro, /calendarDataUrl/);
	assert.match(calendarAstro, /changeMonth/);
	assert.match(calendarAstro, /showHeatmap/);
	assert.match(calendarAstro, /swup:contentReplaced/);
});
