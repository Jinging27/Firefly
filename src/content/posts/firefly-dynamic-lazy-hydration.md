---
title: Firefly 魔改：让动态侧栏进入视口后再加载
published: 2026-09-07
updated: 2026-09-18
description: 记录 Firefly 如何把动态侧栏从页面加载即水合调整为可见时水合，减少首屏客户端工作而不改变动态数据逻辑。
image: ""
tags: [Firefly, 性能, 动态侧栏]
category: Firefly
slug: firefly-dynamic-lazy-hydration
---

动态侧栏通常不是页面第一屏的核心内容，但使用 `client:load` 时，页面一打开就会初始化 Svelte 组件并请求动态数据。这个改造分成两个相互独立的边界：侧栏使用 `client:visible` 延迟水合；动态页中的图片画廊则只在用户真正打开灯箱时加载 Fancybox。这样灯箱依赖暂时不可用时，不会让动态数据组件停在“正在加载”。

## 实施前准备

这篇教程适合已经把 Firefly 项目跑起来、但不熟悉 Astro 水合指令的人。开始前先复制一份项目目录，或在自己的分支中操作；不要直接覆盖唯一的工作副本。项目根目录没有 `node_modules` 时先运行：

```powershell
pnpm install
```

然后按下面顺序做：

1. 打开 `src/components/widget/Dynamic.astro`，把动态组件的 `client:load` 改成下文的 `client:visible`；
2. 打开 `src/components/pages/dynamic/dynamic-gallery.ts`，确认 Fancybox 只在点击处理器中动态导入；
3. 不要修改 `/api/dynamic.json`、Memos 配置、搜索和分页代码；
4. 依次运行专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用 `pnpm dev` 启动预览，使用终端打印出的地址打开 `/dynamic/`。

如果项目中的文件结构与这里不同，先停止操作并以当前 Firefly 版本的组件入口为准，不要把整段旧代码强行覆盖进去。

## 改动位置

文件是 `src/components/widget/Dynamic.astro`，核心变化只有一处：

```astro
<DynamicSidebar client:visible apiUrl={apiUrl} limit={limit} {memos} />
```

原来的 `client:load` 会在页面加载时立即初始化；`client:visible` 则由 Astro 在组件可见时启动。`apiUrl`、`limit` 和 `memos` 三个参数没有改变。

动态页的图片画廊入口是 `src/components/pages/dynamic/dynamic-gallery.ts`。它不再在模块顶层静态导入 `@fancyapps/ui`，也不会被全局 `FancyboxManager` 在画廊渲染时接管；只有点击灯箱按钮后才会动态导入。同时点击时会共用一个进行中的请求，成功后继续复用缓存的结果；若加载失败则清空缓存，下次点击可以重试：

```ts
function createFancyboxLoader(importFancybox = () =>
	import("@fancyapps/ui").then((module) => module.Fancybox),
) {
	let fancyboxPromise: Promise<FancyboxApi> | undefined;
	return () => {
		if (!fancyboxPromise) {
			fancyboxPromise = importFancybox().catch((error) => {
				fancyboxPromise = undefined;
				throw error;
			});
		}
		return fancyboxPromise;
	};
}
```

动态页本身仍按原流程请求 `/api/dynamic.json`，先渲染文本、筛选和分页；只有点击图片灯箱时才需要 Fancybox。导入失败时只会记录灯箱错误，不会产生未处理的 Promise 异常，也不会影响动态文本、搜索、年份筛选或分页。

## 为什么不重写动态组件

动态数据可能来自本地 `/api/dynamic.json`，也可能在未来通过已经加固的 Memos 适配器提供。为了避免引入新的请求策略或重复安全逻辑，本次只改变水合指令和画廊依赖的加载时机，`DynamicSidebar.svelte`/`DynamicFeed.svelte` 的数据、加载态、错误态、HTML 清洗后的文本摘要、图片懒加载和链接保持原样。

此前如果 Fancybox 的开发优化依赖请求失败，模块加载错误会在动态组件水合前抛出，导致 `loading` 状态无法结束。延迟导入后，动态列表不再依赖灯箱模块完成水合；灯箱单独失败时只影响图片放大，不影响文字动态、搜索或年份筛选。

## 对性能的影响

用户没有滚动到动态侧栏时，不会提前初始化这个 Svelte 岛，也不会提前执行它的首次请求。进入视口后仍然使用原有一次加载流程；动态页首屏也不会下载 Fancybox 灯箱代码。点击图片后才加载一次并复用结果，没有轮询、动画或新增运行时依赖。选择器契约测试使用开发期的 `css-select` 与 `htmlparser2`，它们不会进入网站运行时模块。这个改造不能替代真实性能监测，但它减少了非首屏组件的即时工作。

## 兼容性与降级

Astro 的 `client:visible` 负责侧栏可见性观察；动态组件自身仍保留加载中、空数据和请求失败状态。Fancybox 动态导入只在点击灯箱时执行，支持动态导入的现代浏览器可正常打开图片；如果灯箱依赖或网络失败，也只影响放大查看，不会阻断动态页面。即使本地 API 或未来 Memos 服务不可用，也只影响卡片内容，不会阻断其他页面。

## 验证与回滚

专项测试确认动态侧栏使用 `client:visible`、保留三个现有 props、动态页入口和 Memos 配置传递；画廊契约测试确认没有顶层 Fancybox 静态导入，并保留点击时的动态导入。本轮全量测试 **138/138 通过**，`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 打开 `/dynamic/` 后，动态文字、搜索、年份筛选和分页可以正常显示；页面不应一直停在“正在加载动态”。
- 在浏览器开发者工具的 Network 面板中，首次打开动态页不会下载 Fancybox 灯箱代码；点击一条动态里的图片后，才会出现对应的 `@fancyapps/ui` 异步块。
- 故意让灯箱依赖加载失败时，文字动态仍然可用，只是图片不能放大；控制台最多出现灯箱警告，不应出现未处理的 Promise rejection。
- 首页右侧动态卡片只有进入可见区域后才开始水合和请求数据；移动端或未滚动到卡片时不应提前下载动态客户端块。

回滚时可将侧栏指令改回 `client:load`，并把画廊的动态导入恢复为静态导入；不需要修改动态数据层。若回滚后仍停在加载态，先检查 `/api/dynamic.json` 的响应，再检查 Fancybox，而不是把加载文案永久隐藏。
