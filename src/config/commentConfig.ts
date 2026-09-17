import type { CommentConfig } from "../types/commentConfig";

export const commentConfig: CommentConfig = {
	// 使用 GitHub Discussions 承载评论，不需要在博客中保存 Token 或 Cookie。
	type: "giscus",
	giscus: {
		repo: "Jinging27/Firefly",
		repoId: "R_kgDOTyvXLQ",
		category: "Announcements",
		categoryId: "DIC_kwDOTyvXLc4DFz6S",
		mapping: "pathname",
		strict: "0",
		reactionsEnabled: "1",
		emitMetadata: "0",
		inputPosition: "bottom",
		lang: "zh-CN",
		loading: "lazy",
	},
};
