import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const configSource = readFileSync(
	new URL("../config/backgroundWallpaper.ts", import.meta.url),
	"utf8",
);
const typeSource = readFileSync(
	new URL("../types/backgroundWallpaper.ts", import.meta.url),
	"utf8",
);
const playerSource = readFileSync(
	new URL("../components/features/BackgroundPlayer.astro", import.meta.url),
	"utf8",
);

describe("背景视频配置契约", () => {
	test("默认关闭背景视频播放器", () => {
		assert.match(configSource, /playerEnable:\s*false/);
	});

	test("当前配置不引用远程视频地址", () => {
		assert.doesNotMatch(configSource, /https:\/\/[^\s"']+\.(?:mp4|webm|ogg)/i);
		assert.doesNotMatch(configSource, /bed\.twoleaf\.cn/i);
	});

	test("保留播放器类型和组件能力", () => {
		assert.match(typeSource, /playerUrl\?:\s*string\s*\|\s*string\[\]/);
		assert.match(playerSource, /playerUrl:\s*string\s*\|\s*string\[\]/);
		assert.match(playerSource, /id="bg-player-video"/);
	});

	test("保留桌面和移动静态壁纸配置", () => {
		assert.match(configSource, /desktop:\s*\[/);
		assert.match(configSource, /mobile:\s*\[/);
		assert.match(configSource, /DesktopWallpaper\/d1\.avif/);
		assert.match(configSource, /MobileWallpaper\/m1\.avif/);
	});
});
