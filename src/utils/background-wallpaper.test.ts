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
