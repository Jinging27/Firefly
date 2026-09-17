---
title: Firefly 魔改：添加零接口的本地时段问候
published: 2026-09-08
updated: 2026-09-17
description: 记录 Firefly 如何用北京时间和一个可清理的定时器实现轻量时段问候，不引入图片接口、第三方脚本或持续动画。
image: ""
tags: [Firefly, 侧栏, 性能]
category: Firefly
slug: firefly-time-greeting
---

很多博客会用随机图片接口做“早安”“晚安”卡片，但这会增加外部请求、图片加载和服务失效的可能。这个版本选择更克制的实现：只根据北京时间切换本地文案，使用现有主题颜色，不依赖任何外部内容。

## 小白跟做步骤

先备份项目或新建分支。依赖未安装时运行 `pnpm install`。这个功能不需要图片 API、定位权限或持续动画。

1. 在 `src/config/sidebarConfig.ts` 的右侧组件中确认 `type: "timeGreeting"` 且 `enable: true`；
2. 保留 `src/components/widget/TimeGreeting.astro`、`TimeGreetingClient.svelte` 和 `src/utils/time-greeting.ts` 的配套关系；
3. 不要把浏览器本地时间直接当作北京时间，也不要把 `setInterval` 改成永久轮询；
4. 运行时段问候专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用 `pnpm dev` 打开首页，在 1280px、1279px 和手机宽度检查页面表现。

## 最终效果

组件放在桌面端右侧栏顶部区域，文章页、移动端和窄屏不显示。问候时段为：

- 00:00–05:59：夜深；
- 06:00–08:59：清晨；
- 09:00–11:59：上午；
- 12:00–13:59：午间；
- 14:00–17:59：下午；
- 18:00–23:59：傍晚。

## 实现入口

`src/components/widget/TimeGreeting.astro` 负责 Firefly 的 `WidgetLayout` 外壳，并用 CSS 把组件限制在 `min-width: 1280px` 的桌面布局。客户端部分位于 `TimeGreetingClient.svelte`，文案和生命周期逻辑集中在 `src/utils/time-greeting.ts`。

## 为什么使用北京时间

博客面向中文读者，直接读取浏览器本地小时会让海外访客看到与站点语境不一致的问候。实现把时间戳换算到固定的 UTC+8，再根据 00:00、06:00、09:00、12:00、14:00、18:00 这些边界选取文案；它不依赖访客操作系统时区。

## 性能设计

这个组件没有 `fetch`、图片、WebSocket、`setInterval` 或 `requestAnimationFrame`。初始化后只会安排一个到下一个时段边界的 `setTimeout`。页面进入后台、侧栏隐藏、断点变化或 Swup 开始切页时，定时器都会被清理；重新满足显示条件后再建立一个新的定时器。

因此它不会像持续动画或每秒倒计时那样长期占用主线程，也不会在构建阶段请求第三方服务。

## 配置和关闭

右侧栏注册位于 `src/config/sidebarConfig.ts`：

```ts
{
    type: "timeGreeting",
    enable: true,
    position: "top",
    showOnPostPage: false,
}
```

如果不需要这个组件，将 `enable` 改为 `false` 即可。问候语、时段和生命周期不需要在侧栏配置中重复维护。

## 安全边界

实现没有远程地址、访问令牌、用户输入、HTML 注入或动态脚本。无效日期会降级为“愿你此刻安好”，不会因为系统时间异常而阻断页面。

## 验证与回滚

专项测试覆盖所有时段边界、北京时间换算、无效日期、下一个边界延迟、右侧栏/文章页/移动端约束以及定时器清理。本轮全量测试 **138/138 通过**；`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 1280px 以上的非文章页右侧顶部出现一条本地时段问候；文案按北京时间切换；
- 1279px、手机和文章页不显示组件，不产生图片请求、接口请求或持续轮询；
- 切换标签页、进入后台或通过 Swup 打开其他页面后，定时器会清理，不会越积越多；
- 系统时间异常时，组件显示中性 fallback，而不是阻塞页面。

回滚时只需把 `timeGreeting` 的 `enable` 改为 `false`，或者删除该配置项与组件文件；不要为了关闭它修改全局侧栏生命周期。
