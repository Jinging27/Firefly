---
title: Firefly 魔改：让默认壁纸按需渲染
published: 2026-09-08
description: 记录 Firefly 如何在不改壁纸资源的前提下，默认只输出首张桌面和移动壁纸，并保留轮播与切换能力。
image: ""
tags: [Firefly, 性能, 壁纸]
category: Firefly
slug: firefly-wallpaper-on-demand
---

Firefly 的多图壁纸很方便，但如果轮播没有启用，页面通常只会显示其中一张。让其他图片继续出现在 HTML 中，会让浏览器下载当前视口用不到的资源。本次改造把“是否需要完整图片集合”放在构建期决定，减少默认首屏的无效图片请求。

## 改动位置

核心逻辑在 `src/utils/layout-utils.ts` 的 `getRenderableBackgroundImages`，布局接入在 `src/layouts/MainGridLayout.astro`。布局先取得完整配置，再依据默认轮播状态和轮播切换能力筛选：

```ts
const renderAll = carouselEnabled || carouselSwitchable;
const desktop = renderAll ? [...images.desktop] : images.desktop.slice(0, 1);
const mobile = renderAll ? [...images.mobile] : images.mobile.slice(0, 1);
```

关闭轮播且不能切换时，模板走单图路径，不输出多图 `slide-item` 容器；单图的 `ImageWrapper` 使用互斥的 `<source media="(max-width: 1023px)">` 与 `<source media="(min-width: 1024px)">`，浏览器只选择当前视口首图，同时保留 Astro 静态图片优化、LQIP 和 `fallbackFormat` 回退。开启轮播或允许用户切换时，保留原有数组和轮播脚本。

## 如何使用

图片仍在 `src/config/backgroundWallpaper.ts` 配置，不需要重命名或删除 `d1-d6`、`m1-m6`。默认关闭轮播即可使用首图按需渲染。需要轮播时，将 `common.carousel.enable` 改为 `true`；需要把控制权交给访客时，开启显示设置并设置 `bannerCarouselSwitchable: true`。

本项目默认显示设置总开关为关闭状态，因此默认构建会采用单图路径。仅在解析后的设置确实允许切换时，才为了兼容运行时切换保留完整集合。功能没有偷偷修改这些默认值。

## 性能与兼容性边界

默认路径不新增 API、依赖、定时器或客户端脚本，只减少未使用壁纸的 HTML 引用。桌面/移动断点、壁纸模式、图片优化和现有配置均保持不变。开启轮播时仍会产生完整图片集合，这是功能所需的资源，不能同时承诺单图请求。

## 验证与回滚

专项测试覆盖关闭轮播、开启轮播、允许切换、空数组和单图输入，并锁定媒体条件与轮播集合布局契约；本次结果为 6/6。全量 14 个测试文件、Biome、`pnpm check`、`pnpm type-check` 和 `pnpm build` 均通过。生产预览浏览器 Network 实测：1440px 仅请求 d1 桌面首图，390px 仅请求 m1 移动首图；文章页返回 200，亮暗主题均保持正常。scoped re-review 已确认媒体条件、验证证据和 `fallbackFormat` 语义均已补齐；源码契约正则的可维护性问题作为 Minor 记录。轮播和可切换路径继续保留完整集合。

回滚时移除布局中的 `getRenderableBackgroundImages` 调用，恢复直接使用 `getBackgroundImages()` 即可，壁纸配置与资源无需回滚。
