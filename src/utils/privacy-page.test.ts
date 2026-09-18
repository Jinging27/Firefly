import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const privacySource = readFileSync(
	new URL("../content/spec/privacy.md", import.meta.url),
	"utf8",
);
const pageSource = readFileSync(
	new URL("../pages/privacy.astro", import.meta.url),
	"utf8",
);
const footerSource = readFileSync(
	new URL("../components/layout/Footer.astro", import.meta.url),
	"utf8",
);

test("隐私说明覆盖当前第三方服务边界", () => {
	for (const phrase of [
		"Umami",
		"Giscus",
		"GitHub",
		"Memos",
		"Web Vitals",
		"会话回放",
		"第三方",
		"更新时间",
	]) {
		assert.ok(privacySource.includes(phrase), `缺少隐私说明关键词：${phrase}`);
	}
});

test("隐私说明不包含凭据、内部路径或运行时请求", () => {
	assert.doesNotMatch(
		privacySource,
		/ghp_|github_pat_|sk-|SESSDATA=|MUSIC_U=/i,
	);
	assert.doesNotMatch(privacySource, /[A-Z]:\\(?:Users|[^\\]+\\Firefly)\\/i);
	assert.doesNotMatch(pageSource, /<script|fetch\(/i);
	assert.doesNotMatch(privacySource, /<script|fetch\(/i);
});

test("隐私页使用 spec 内容并从页脚提供内部入口", () => {
	assert.match(pageSource, /getEntry\("spec", "privacy"\)/);
	assert.match(pageSource, /title="隐私说明"/);
	assert.match(footerSource, /url\("privacy\/"\)/);
	assert.match(footerSource, /隐私说明<\/a/);
});
