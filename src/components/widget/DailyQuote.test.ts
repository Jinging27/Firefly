import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sidebarLayoutConfig } from "../../config/sidebarConfig";

describe("每日一言侧栏布局", () => {
	test("只在左栏配置一次，且紧邻音乐下方和分类上方", () => {
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

		assert.equal(allTypes.filter((type) => type === "dailyQuote").length, 1);
		assert.deepEqual(
			leftTypes.slice(
				leftTypes.indexOf("music"),
				leftTypes.indexOf("categories") + 1,
			),
			["music", "dailyQuote", "categories"],
		);
	});

	test("与相邻组件同属 sticky 分组，并保持文章页隐藏", () => {
		const music = sidebarLayoutConfig.leftComponents.find(
			(component) => component.type === "music",
		);
		const dailyQuote = sidebarLayoutConfig.leftComponents.find(
			(component) => component.type === "dailyQuote",
		);
		const categories = sidebarLayoutConfig.leftComponents.find(
			(component) => component.type === "categories",
		);

		assert.ok(music);
		assert.ok(dailyQuote);
		assert.ok(categories);
		assert.equal(music.position, "sticky");
		assert.equal(dailyQuote.position, "sticky");
		assert.equal(categories.position, "sticky");
		assert.equal(dailyQuote.showOnPostPage, false);
	});
});
