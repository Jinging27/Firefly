import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const astroConfig = readFileSync(
	new URL("../../astro.config.mjs", import.meta.url),
	"utf8",
);

describe("工作树开发服务器文件访问范围", () => {
	test("允许 pnpm 真实依赖目录，避免 Svelte 水合模块被 403 拒绝", () => {
		assert.match(astroConfig, /realpathSync/);
		assert.match(astroConfig, /server:\s*\{[\s\S]*fs:\s*\{[\s\S]*allow:/);
	});
});
