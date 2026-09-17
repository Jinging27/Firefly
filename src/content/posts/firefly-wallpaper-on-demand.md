---
title: Firefly 魔改：让默认壁纸按需渲染
published: 2026-09-08
updated: 2026-09-18
description: 记录 Firefly 如何在不改壁纸资源的前提下，默认只输出首张桌面和移动壁纸，并保留轮播与切换能力。
image: ""
tags: [Firefly, 性能, 壁纸]
category: Firefly
slug: firefly-wallpaper-on-demand
---

Firefly 的多图壁纸很方便，但如果轮播没有启用，页面通常只会显示其中一张。让其他图片继续出现在 HTML 中，会让浏览器下载当前视口用不到的资源。本次改造把“是否需要完整图片集合”放在构建期决定，减少默认首屏的无效图片请求。

## 实施步骤

先备份项目或新建分支。依赖未安装时运行 `pnpm install`。这项优化不需要删除壁纸文件，只根据轮播开关决定输出几张图片。

1. 打开 `src/utils/layout-utils.ts`，确认使用 `getRenderableBackgroundImages`；
2. 打开 `src/layouts/MainGridLayout.astro`，确认单图路径仍使用桌面/移动互斥的 `<source media>`；
3. 默认关闭轮播且不允许访客切换时只输出首图；如果开启轮播或允许切换，必须保留完整集合；
4. 运行壁纸专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用浏览器 Network 面板在 1440px 和 390px 分别检查请求数量。

不要为了减少请求直接删除 `d1-d6` 或 `m1-m6` 资源；这样会破坏以后重新启用轮播的路径。

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

专项测试覆盖关闭轮播、开启轮播、允许切换、空数组和单图输入，并锁定媒体条件与轮播集合布局契约；本次结果为 6/6。当前全量测试 **138/138 通过**，`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 默认关闭轮播时，1440px 只请求桌面首图，390px 只请求移动首图；
- 开启轮播或允许访客切换时，Network 面板可以看到完整图片集合，这是功能所需的正常开销；
- 亮色、暗色、首页和文章页都保持原来的壁纸，不出现空白横幅或布局跳动；
- 修改图片列表为空或只有一张时，构建仍能安全完成，不会伪造多图轮播。

如果构建失败或横幅变成空白，先检查桌面/移动图片数组是否仍有有效路径，以及 `<source media>` 是否被误删；恢复最近一次布局修改后重跑专项测试和 `pnpm build`，不要为了“只显示一张”删除其余壁纸资源。

scoped re-review 已确认媒体条件、`fallbackFormat` 和布局契约均保持；回滚时移除布局中的 `getRenderableBackgroundImages` 调用即可，不需要删除壁纸资源。

回滚时移除布局中的 `getRenderableBackgroundImages` 调用，恢复直接使用 `getBackgroundImages()` 即可，壁纸配置与资源无需回滚。
