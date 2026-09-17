import type { GitHubHeatmapConfig } from "@/types/githubHeatmapConfig";

export const githubHeatmapConfig: GitHubHeatmapConfig = Object.freeze({
	title: "GitHub 贡献",
	endpoint: "https://github-contributions-api.jogruber.de/v4",
	cacheKey: "firefly:github-heatmap:v1",
	cacheTtlMs: 6 * 60 * 60 * 1_000,
	// 允许首次冷启动连接有更充足的时间，但仍不会阻塞页面渲染。
	requestTimeoutMs: 5_000,
	maxDays: 371,
});
