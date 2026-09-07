import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { sidebarLayoutConfig } from "../../config/sidebarConfig";

const heatmapAstro = readFileSync(
	new URL("./GitHubHeatmap.astro", import.meta.url),
	"utf8",
);
const heatmapClient = readFileSync(
	new URL("./GitHubHeatmapClient.svelte", import.meta.url),
	"utf8",
);

describe("GitHub 贡献热力图侧栏契约", () => {
	test("只在右侧栏注册，不进入移动端和左侧栏", () => {
		const leftTypes = sidebarLayoutConfig.leftComponents.map(
			(component) => component.type,
		);
		const rightTypes = sidebarLayoutConfig.rightComponents.map(
			(component) => component.type,
		);
		const mobileTypes = sidebarLayoutConfig.mobileBottomComponents.map(
			(component) => component.type,
		);
		assert.equal(leftTypes.includes("githubHeatmap"), false);
		assert.equal(
			rightTypes.filter((type) => type === "githubHeatmap").length,
			1,
		);
		assert.equal(mobileTypes.includes("githubHeatmap"), false);
		const config = sidebarLayoutConfig.rightComponents.find(
			(component) => component.type === "githubHeatmap",
		);
		assert.ok(config);
		assert.equal(config?.showOnPostPage, false);
	});

	test("只在桌面端可见并使用可见时水合", () => {
		assert.match(heatmapAstro, /client:visible/);
		assert.match(heatmapAstro, /min-width: 1280px/);
		assert.match(heatmapAstro, /parseGitHubUsername/);
		assert.match(heatmapClient, /暂时无法显示贡献记录/);
		assert.match(heatmapClient, /role="grid"/);
		assert.match(heatmapClient, /class="github-heatmap-week" role="row"/);
		assert.match(heatmapClient, /role="gridcell"/);
		assert.match(heatmapClient, /aria-label=/);
	});

	test("客户端请求不携带凭据且不引入构建期网络请求", () => {
		assert.match(heatmapClient, /createGitHubHeatmapLoader/);
		assert.doesNotMatch(heatmapAstro, /fetch\(|XMLHttpRequest|WebSocket/);
		assert.doesNotMatch(heatmapClient, /credentials:\s*["']include/);
	});

	test("网格在侧栏中保持可压缩且不强制溢出", () => {
		assert.match(heatmapClient, /\.github-heatmap-grid[\s\S]*gap: 2px/);
		assert.match(heatmapClient, /\.github-heatmap-cell[\s\S]*min-width: 0/);
		assert.doesNotMatch(heatmapClient, /min-width: 3px/);
	});
});
