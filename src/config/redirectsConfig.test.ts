import assert from "node:assert/strict";
import test from "node:test";
import type { RedirectsConfig } from "../types/redirectsConfig";
import {
	defineRedirectsConfig,
	redirectsConfig,
	serializeCloudflareRedirects,
} from "./redirectsConfig";

test("包含首批真实短链并统一使用 301", () => {
	assert.deepEqual(redirectsConfig, {
		"/go/vscode/": {
			status: 301,
			destination: "/posts/vscode-settings-and-extensions/",
		},
		"/go/github/": {
			status: 301,
			destination: "https://github.com/Jinging27",
		},
	});
});

test("生成确定性的 Cloudflare _redirects 内容", () => {
	assert.equal(
		serializeCloudflareRedirects(redirectsConfig),
		[
			"/go/github/ https://github.com/Jinging27 301",
			"/go/vscode/ /posts/vscode-settings-and-extensions/ 301",
			"",
		].join("\n"),
	);
});

test("返回不可变的短链接配置且不冻结调用方对象", () => {
	const input: RedirectsConfig = {
		"/go/example/": {
			status: 301,
			destination: "/posts/example/",
		},
	};
	const config = defineRedirectsConfig(input);

	assert.equal(Object.isFrozen(config), true);
	assert.equal(Object.isFrozen(config["/go/example/"]), true);
	assert.equal(Object.isFrozen(input), false);
	assert.equal(Object.isFrozen(input["/go/example/"]), false);
});

test("拒绝危险或不规范的短链接配置", () => {
	const invalidConfigs: Array<{ name: string; config: unknown }> = [
		{
			name: "非短链接前缀",
			config: {
				"/vscode/": { status: 301, destination: "/posts/example/" },
			},
		},
		{
			name: "源路径缺少尾斜杠",
			config: {
				"/go/vscode": { status: 301, destination: "/posts/example/" },
			},
		},
		{
			name: "站内目标缺少尾斜杠",
			config: {
				"/go/vscode/": { status: 301, destination: "/posts/example" },
			},
		},
		{
			name: "站内目标包含反斜杠",
			config: {
				"/go/example/": { status: 301, destination: "/\\evil/" },
			},
		},
		{
			name: "非 HTTPS 外链",
			config: {
				"/go/example/": {
					status: 301,
					destination: "http://example.com",
				},
			},
		},
		{
			name: "缺少双斜杠的 HTTPS 外链",
			config: {
				"/go/example/": {
					status: 301,
					destination: "https:example.com",
				},
			},
		},
		{
			name: "只有单斜杠的 HTTPS 外链",
			config: {
				"/go/example/": {
					status: 301,
					destination: "https:/example.com",
				},
			},
		},
		{
			name: "带百分号编码的 HTTPS 外链",
			config: {
				"/go/example/": {
					status: 301,
					destination: "https://example.com/%0a",
				},
			},
		},
		{
			name: "带凭据的 HTTPS 外链",
			config: {
				"/go/example/": {
					status: 301,
					destination: "https://user:password@example.com",
				},
			},
		},
		{
			name: "协议相对外链",
			config: {
				"/go/example/": {
					status: 301,
					destination: "//example.com",
				},
			},
		},
		{
			name: "带查询参数的目标",
			config: {
				"/go/example/": {
					status: 301,
					destination: "https://example.com/?source=blog",
				},
			},
		},
		{
			name: "源目标自循环",
			config: {
				"/go/example/": { status: 301, destination: "/go/example/" },
			},
		},
		{
			name: "临时重定向状态码",
			config: {
				"/go/example/": {
					status: 302,
					destination: "https://example.com",
				},
			},
		},
	];

	for (const { name, config } of invalidConfigs) {
		assert.throws(() => defineRedirectsConfig(config as RedirectsConfig), name);
	}
});

test("只允许静态单段 slug 作为短链接源路径", () => {
	const invalidSources = [
		"/go/../example/",
		"/go/example/subpath/",
		"/go/*/",
		"/go/:slug/",
		"/go/example%2fsubpath/",
		"/go/Example/",
		"/go/-example/",
		"/go/example-/",
		"/go/example--link/",
	];

	for (const source of invalidSources) {
		assert.throws(
			() =>
				defineRedirectsConfig({
					[source]: {
						status: 301,
						destination: "/posts/example/",
					},
				}),
			source,
		);
	}
});

test("拒绝存在动态匹配或路径解析歧义的站内目标", () => {
	const invalidDestinations = [
		"/posts/../admin/",
		"/posts/example%2fsubpath/",
		"/posts/*/",
		"/posts/:slug/",
		"/posts//example/",
	];

	for (const destination of invalidDestinations) {
		assert.throws(
			() =>
				defineRedirectsConfig({
					"/go/example/": { status: 301, destination },
				}),
			destination,
		);
	}
});

test("序列化前再次校验运行时配置", () => {
	assert.throws(() =>
		serializeCloudflareRedirects({
			"/go/example/": {
				status: 301,
				destination: "/safe/\n/evil/",
			},
		} as RedirectsConfig),
	);
});
