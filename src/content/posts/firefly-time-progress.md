---
title: Firefly 魔改：用北京时间显示时间进度与节假日倒计时
published: 2026-09-06
updated: 2026-09-17
description: 将北京时间的年度、本月进度和节日倒计时整合到 Firefly 右侧日历，保留轻量、安全和无外部请求的实现。
image: ""
tags: [Firefly, Astro, Svelte, 时间进度]
category: Firefly
slug: firefly-time-progress
---

时间进度适合与日历放在一起：用户看日期时，也能同时看到本月和年度进度，以及最近节日和春节倒计时。本文将原本左栏独立卡片改为右侧日历内的紧凑信息区，日期计算固定使用北京时间，并让所有倒计时在数据缺失时安全降级。

这次调整是对原有 Firefly 时间进度魔改的完善，不改变日历切月和文章列表。为了避免右侧信息重复，年度文章热力图现在默认关闭；实现仍保留，之后可在日历专属配置中显式开启。

## 小白跟做步骤

先备份项目或新建分支。依赖未安装时，在项目根目录执行 `pnpm install`。本功能不需要节日 API，也不需要在浏览器保存密钥。

1. 打开 `src/config/sidebarConfig.ts`，确认右侧 `calendar` 的 `specificConfig.calendar.showHeatmap` 为 `false`；
2. 保留 `src/components/widget/Calendar.astro`、`src/components/widget/TimeProgress.astro` 和 `src/utils/time-progress.ts` 的整体结构，不要只复制某一段 HTML；
3. 如需增加节日，只在 `src/config/timeProgressConfig.ts` 添加已核验的日期、来源和覆盖年份，来源必须是允许的 HTTPS 官方地址；
4. 运行时间进度专项测试，再运行 `pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用 `pnpm dev` 打开首页，在 1280px 和 1279px 两个宽度分别检查下面的结果。

不要把春节或节假日日期写成“每年固定某一天”的 JavaScript 常量；日期变化时应更新配置并重新验证。

## 代码入口

`src/utils/time-progress.ts` 提供可注入 `Date` 的纯函数：`getBeijingYearProgress`、`getBeijingMonthProgress`、`getBeijingWeekProgress`、`getNextHolidayCountdown` 和 `getNextSpringFestivalCountdown`。它们通过 UTC 时间戳加八小时计算北京时间，因此服务器和访客时区不同也不会改变结果。

三个进度函数返回的 `currentDay` 含义与周期一致：年度和月度表示对应周期内的日期编号，周进度表示周内第几天（周一为 1、周日为 7）。当前页面只展示百分比，但这个约定能避免后续调用者把周进度误当成当月日期。

节假日配置位于 `src/config/timeProgressConfig.ts`。每条记录都有名称、日期、来源、`verified` 与 `coverageYears`，并可提供 `sourceUrl`。只有 `verified: true` 且 `sourceUrl` 解析后满足 HTTPS、无端口、无用户名/密码，并严格使用国务院官网主机 `www.gov.cn` 时才参与倒计时；日期不合法、来源未核验、任意第三方域名或年份不在覆盖范围内时返回 `null`。2026 年中秋节和国庆节均使用同一份国务院办公厅公告核验，因此 2026 年 9 月 9 日页面会优先显示距中秋节的倒计时，过了中秋节后再显示距国庆节的倒计时。

春节单独放在 `timeProgressConfig.springFestivals`，通过 `kind: "springFestival"` 标识。春节日期使用本地人工核对数据，不在浏览器端请求接口；当前配置的 2027 年春节为 `2027-02-06`。缺少下一年度数据时，春节行会保留但显示“暂无数据”，不会伪造倒计时。

2026 年 9 月 6 日已核对国务院官网《国务院办公厅关于2026年部分节假日安排的通知》。配置使用有效官方来源 `https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm`，所以 2026 年国庆数据会参与倒计时；来源未核验或年份不在覆盖范围内时仍会安全隐藏。

## 侧栏与刷新

Astro 外壳先输出 SSR 进度，Svelte 客户端使用 `client:visible` 在宽屏日历进入视口时才启动。时间进度不再占用左栏独立卡片，而是放在右侧日历下方；左栏顺序为音乐、每日一言、分类。日历默认只显示日期、时间进度和当月文章列表，年度文章热力图不会额外占用空间。文章页和移动端不会启动刷新。存在有效节日倒计时时，客户端用唯一每秒定时器更新；没有倒计时时，仅对齐下一分钟边界刷新，避免无意义的秒级唤醒。它通过仓库实际的 `window.swup.hooks.on("visit:start")` 在切页前停止定时器，并在卸载时注销 hook；组件隐藏、离开视口、标签页隐藏和断点变化也会停止刷新。支持 `IntersectionObserver` 时由观察器给出交叉状态；旧浏览器没有该 API 时，`setupTimeProgressLifecycle` 通过 `getBoundingClientRect()` 加 `scroll/resize` 事件检查视口，滚出视口后立即清除定时器，无法取得可信几何状态时默认不刷新。该回退路径还会在 `astro:page-load` 和组件 `class/style` 属性变化时重新计算几何位置，避免页面切换或布局变化后沿用过期的视口状态。

## 日历热力图的显示策略

右侧日历仍保留年度文章热力图代码，但当前推荐配置是关闭它：

```ts
// src/config/sidebarConfig.ts
calendar: {
	showHeatmap: false,
},
```

这样 GitHub 贡献热力图与日历文章列表不会和另一张年度文章热力图重复。需要查看年度文章发布概览时，可将 `showHeatmap` 改为 `true`；这只恢复日历内部的可选区块，不会改变时间进度的计算或刷新策略。

## 验证、安全与回滚

专项测试覆盖闰年、月末、周边界、周内日期编号、北京时间午夜、最近公共节日选择、春节日期、未核验来源、国务院官网白名单、Swup 延迟初始化/重复事件/清理以及刷新频率；运行时测试还驱动可用和不可用 `IntersectionObserver`、滚动离开/回到视口、`astro:page-load`、布局属性变化、页面可见性、媒体断点、隐藏属性、Swup 切页和卸载清理。组件测试确认没有 `fetch`、WebSocket，并检查隐藏暂停和 ARIA 进度条。本轮全量测试 **138/138 通过**，`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 在 **1280px 或更宽**的首页右侧日历中，日期导航下方应同时出现本月进度、年度进度、距离最近节日和距离春节的信息；年度文章热力图默认不出现。
- 切换日历月份时，文章列表仍能切换，时间进度不会重复生成第二个独立卡片。
- 在 **1279px、移动端和文章页**，不应看到这块桌面时间信息，也不应有倒计时定时器持续刷新。
- 系统时区改成海外时，页面仍按北京时间计算；没有经过核验的节日配置应显示“暂无数据”或隐藏倒计时，而不是猜一个日期。

只想恢复年度文章热力图时，把 `showHeatmap` 改回 `true`；若要撤销整套时间进度，再按计划删除日历信息区和对应配置，不能只删除页面文字留下孤立定时器。

回滚本次日历整合时，删除 `Calendar.astro` 中的时间信息区和春节配置，恢复 `sidebarConfig.ts` 中的左栏 `timeProgress` 注册即可；如果只想恢复年度文章热力图，将同一文件中的 `showHeatmap` 改回 `true` 即可。如需完全移除时间进度功能，再按原计划删除时间组件、工具、生命周期协调器、配置、测试和本文，不影响每日一言或音乐组件。
