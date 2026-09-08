---
title: Firefly 魔改：让动态侧栏进入视口后再加载
published: 2026-09-07
description: 记录 Firefly 如何把动态侧栏从页面加载即水合调整为可见时水合，减少首屏客户端工作而不改变动态数据逻辑。
image: ""
tags: [Firefly, 性能, 动态侧栏]
category: Firefly
slug: firefly-dynamic-lazy-hydration
---

动态侧栏通常不是页面第一屏的核心内容，但使用 `client:load` 时，页面一打开就会初始化 Svelte 组件并请求动态数据。这个改造只调整 Astro 的加载时机：把动态组件改为进入视口后再水合，保留所有原有数据和错误处理。

## 改动位置

文件是 `src/components/widget/Dynamic.astro`，核心变化只有一处：

```astro
<DynamicSidebar client:visible apiUrl={apiUrl} limit={limit} {memos} />
```

原来的 `client:load` 会在页面加载时立即初始化；`client:visible` 则由 Astro 在组件可见时启动。`apiUrl`、`limit` 和 `memos` 三个参数没有改变。

## 为什么不重写动态组件

动态数据可能来自本地 `/api/dynamic.json`，也可能在未来通过已经加固的 Memos 适配器提供。为了避免引入新的请求策略或重复安全逻辑，本次只改变水合指令，`DynamicSidebar.svelte` 的加载态、错误态、HTML 清洗后的文本摘要、图片懒加载和链接全部保持原样。

## 对性能的影响

用户没有滚动到动态侧栏时，不会提前初始化这个 Svelte 岛，也不会提前执行它的首次请求。进入视口后仍然使用原有一次加载流程，没有轮询、动画或新增依赖。这个改造不能替代真实性能监测，但它减少了非首屏组件的即时工作。

## 兼容性与降级

Astro 的 `client:visible` 负责可见性观察；动态组件自身仍保留加载中、空数据和请求失败状态。即使本地 API 或未来 Memos 服务不可用，也只影响卡片内容，不会阻断其他页面。

## 验证与回滚

专项测试确认动态侧栏使用 `client:visible`、保留三个现有 props、动态页入口和 Memos 配置传递，并且没有新增网络代码。回滚时将指令改回 `client:load` 即可，不需要修改数据层。
