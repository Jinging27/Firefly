import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const managerSource = readFileSync(
	new URL("./MusicManager.astro", import.meta.url),
	"utf8",
);

describe("Meting 请求降级", () => {
	test("每个接口请求都必须有超时取消和计时器清理", () => {
		assert.match(managerSource, /new AbortController\(\)/);
		assert.match(managerSource, /controller\.abort\(\)/);
		assert.match(managerSource, /signal:\s*controller\.signal/);
		assert.match(managerSource, /clearTimeout\(timeout\)/);
	});

	test("超时配置会传入浏览器端并保留备用接口顺序", () => {
		assert.match(managerSource, /requestTimeoutMs/);
		assert.match(
			managerSource,
			/var apis = \[m\.api\]\.concat\(m\.fallbackApis \|\| \[\]\)/,
		);
		assert.match(managerSource, /for \(var i = 0; i < apis\.length; i\+\+\)/);
	});
});
