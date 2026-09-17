import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { commentConfig } from "./commentConfig";

const giscusSource = readFileSync(
	new URL("../components/comment/Giscus.astro", import.meta.url),
	"utf8",
);

describe("Giscus 评论配置契约", () => {
	test("启用用户确认的仓库和 Announcements 分类", () => {
		assert.equal(commentConfig.type, "giscus");
		assert.deepEqual(commentConfig.giscus, {
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
		});
	});

	test("继续使用 Web Component 和延迟加载，不粘贴账号凭据", () => {
		assert.match(giscusSource, /<giscus-widget/);
		assert.match(
			giscusSource,
			/import\("https:\/\/esm\.sh\/giscus@1\.6\.0\?bundle"\)/,
		);
		assert.doesNotMatch(giscusSource, /client\.js/);
		assert.doesNotMatch(giscusSource, /token|cookie|password/i);
	});
});
