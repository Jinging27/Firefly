import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { sidebarLayoutConfig } from "../../config/sidebarConfig";

const dailyQuoteAstro = readFileSync(
	new URL("./DailyQuote.astro", import.meta.url),
	"utf8",
);
const dailyQuoteClient = readFileSync(
	new URL("./DailyQuoteClient.svelte", import.meta.url),
	"utf8",
);

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
			["music", "dailyQuote", "timeProgress", "categories"],
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

	test("标题保持系统字体，正文按语义类使用正楷和桌面字号", () => {
		const contentRule = dailyQuoteAstro.match(
			/:global\(widget-layout\[data-id="daily-quote"\] #daily-quote\)\s*\{([^}]*)\}/,
		);
		assert.ok(contentRule, "每日一言正楷字体规则必须限定在内容容器");
		assert.match(contentRule[1], /font-family\s*:/);
		assert.match(
			contentRule[1],
			/"Kaiti SC",\s*"STKaiti",\s*"KaiTi",\s*"楷体",\s*"DFKai-SB",\s*"BiauKai",\s*serif/,
		);
		assert.doesNotMatch(
			dailyQuoteAstro,
			/:global\(widget-layout\[data-id="daily-quote"\]\)\s*\{[^}]*font-family[^}]*\}/,
		);
		assert.doesNotMatch(
			dailyQuoteAstro,
			/:global\(\.daily-quote-widget\)\s*\{[^}]*font-family[^}]*\}/,
		);
		assert.doesNotMatch(dailyQuoteAstro, /STXingkai|华文行楷|Xingkai SC/);
		assert.match(
			dailyQuoteClient,
			/class="daily-quote-text text-base leading-7 /,
		);
		assert.match(
			dailyQuoteClient,
			/class="daily-quote-attribution text-sm leading-6 /,
		);
	});
});
