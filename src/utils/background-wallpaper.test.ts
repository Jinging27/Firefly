import assert from "node:assert/strict";
import test from "node:test";
import {
	type BackgroundImages,
	getRenderableBackgroundImages,
} from "./layout-utils";

const images: BackgroundImages = {
	desktop: ["desktop-1.avif", "desktop-2.avif"],
	mobile: ["mobile-1.avif", "mobile-2.avif"],
	isMultiple: true,
};

function extractSection(
	source: string,
	startMarker: string,
	endMarker: string,
) {
	const start = source.indexOf(startMarker);
	assert.notEqual(start, -1, `未找到代码区块起点：${startMarker}`);

	const end = source.indexOf(endMarker, start + startMarker.length);
	assert.notEqual(end, -1, `未找到代码区块终点：${endMarker}`);

	return source.slice(start, end);
}

function extractImageWrapperCall(source: string, slotClass: string) {
	const slotStart = source.indexOf(slotClass);
	assert.notEqual(slotStart, -1, `未找到壁纸槽位：${slotClass}`);

	const wrapperStart = source.indexOf("<ImageWrapper", slotStart);
	assert.notEqual(wrapperStart, -1, `未找到壁纸 ImageWrapper：${slotClass}`);

	const wrapperEnd = source.indexOf("/>", wrapperStart);
	assert.notEqual(
		wrapperEnd,
		-1,
		`未找到壁纸 ImageWrapper 结束位置：${slotClass}`,
	);

	return source.slice(wrapperStart, wrapperEnd + 2);
}

function extractMapBlock(source: string, device: "mobile" | "desktop") {
	const mapStartMarker = `{backgroundImages.${device}.map((src, index) => (`;
	const mapStart = source.indexOf(mapStartMarker);
	assert.notEqual(mapStart, -1, `未找到${device}轮播 map 区块`);

	const mapEnd = source.indexOf("))}", mapStart + mapStartMarker.length);
	assert.notEqual(mapEnd, -1, `未找到${device}轮播 map 区块结束位置`);

	return source.slice(mapStart, mapEnd + "))}".length);
}

test("轮播关闭且不可切换时只渲染桌面和移动首图", () => {
	const result = getRenderableBackgroundImages(images, false, false);

	assert.deepEqual(result, {
		desktop: ["desktop-1.avif"],
		mobile: ["mobile-1.avif"],
		isMultiple: false,
	});
	assert.notStrictEqual(result.desktop, images.desktop);
	assert.notStrictEqual(result.mobile, images.mobile);
});

test("单图布局契约使用互斥的视口媒体条件", async () => {
	const fs = await import("node:fs/promises");
	const layout = await fs.readFile(
		new URL("../layouts/MainGridLayout.astro", import.meta.url),
		"utf8",
	);
	const singleImageBranch = extractSection(
		layout,
		"/* 单图模式 */",
		"<!-- 壁纸轮播脚本",
	);
	const mobileImageWrapper = extractImageWrapperCall(
		singleImageBranch,
		"banner-image-slot-mobile",
	);
	const desktopImageWrapper = extractImageWrapperCall(
		singleImageBranch,
		"banner-image-slot-desktop",
	);

	assert.match(mobileImageWrapper, /src=\{backgroundImages\.mobile\[0\]\}/);
	assert.match(mobileImageWrapper, /media="\(max-width: 1023px\)"/);
	assert.match(mobileImageWrapper, /loading="eager"/);
	assert.match(mobileImageWrapper, /fetchpriority="high"/);
	assert.match(desktopImageWrapper, /src=\{backgroundImages\.desktop\[0\]\}/);
	assert.match(desktopImageWrapper, /media="\(min-width: 1024px\)"/);
	assert.match(desktopImageWrapper, /loading="eager"/);
	assert.match(desktopImageWrapper, /fetchpriority="high"/);
});

test("轮播布局契约仍遍历完整桌面和移动集合", async () => {
	const fs = await import("node:fs/promises");
	const layout = await fs.readFile(
		new URL("../layouts/MainGridLayout.astro", import.meta.url),
		"utf8",
	);
	const carouselBranch = extractSection(
		layout,
		"/* 轮播模式：渲染所有图片为 slide-item */",
		"/* 单图模式 */",
	);
	const mobileMapBlock = extractMapBlock(carouselBranch, "mobile");
	const desktopMapBlock = extractMapBlock(carouselBranch, "desktop");

	assert.match(mobileMapBlock, /class:list=\{\["slide-item block lg:hidden"/);
	assert.match(mobileMapBlock, /data-index=\{index\}/);
	assert.match(mobileMapBlock, /<ImageWrapper[\s\S]*src=\{src\}/);
	assert.match(desktopMapBlock, /class:list=\{\["slide-item hidden lg:block"/);
	assert.match(desktopMapBlock, /data-index=\{index\}/);
	assert.match(desktopMapBlock, /<ImageWrapper[\s\S]*src=\{src\}/);
});

test("默认开启轮播时保留全部壁纸", () => {
	const result = getRenderableBackgroundImages(images, true, false);

	assert.deepEqual(result, images);
	assert.notStrictEqual(result.desktop, images.desktop);
	assert.notStrictEqual(result.mobile, images.mobile);
});

test("允许用户切换轮播时保留全部壁纸", () => {
	const result = getRenderableBackgroundImages(images, false, true);

	assert.deepEqual(result, images);
});

test("空数组和单图输入保持安全且不伪造多图状态", () => {
	assert.deepEqual(
		getRenderableBackgroundImages(
			{ desktop: [], mobile: [], isMultiple: false },
			false,
			false,
		),
		{ desktop: [], mobile: [], isMultiple: false },
	);
	assert.deepEqual(
		getRenderableBackgroundImages(
			{ desktop: ["desktop.avif"], mobile: ["mobile.avif"], isMultiple: false },
			false,
			false,
		),
		{ desktop: ["desktop.avif"], mobile: ["mobile.avif"], isMultiple: false },
	);
});
