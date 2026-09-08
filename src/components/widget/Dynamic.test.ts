import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const dynamicSource = readFileSync(
	new URL("./Dynamic.astro", import.meta.url),
	"utf8",
);

describe("动态侧栏延迟水合", () => {
	test("只在组件可见时水合，不在页面加载时立即初始化", () => {
		assert.match(dynamicSource, /<DynamicSidebar client:visible /);
		assert.doesNotMatch(dynamicSource, /<DynamicSidebar client:load /);
	});

	test("保留现有动态数据入口和配置传递", () => {
		assert.match(dynamicSource, /apiUrl=\{apiUrl\}/);
		assert.match(dynamicSource, /limit=\{limit\}/);
		assert.match(dynamicSource, /\{memos\}/);
		assert.match(dynamicSource, /id="latest-dynamics"/);
		assert.match(dynamicSource, /href=\{url\("\/dynamic\/"\)\}/);
	});

	test("没有为延迟水合增加网络代码或新的依赖", () => {
		assert.doesNotMatch(dynamicSource, /fetch\(|XMLHttpRequest|WebSocket/);
		assert.doesNotMatch(dynamicSource, /https?:\/\//);
	});
});
