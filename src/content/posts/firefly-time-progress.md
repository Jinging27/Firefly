---
title: Firefly：用北京时间显示时间进度与节假日倒计时
published: 2026-09-06
updated: 2026-09-09
description: 将北京时间的年度、本月进度和节日倒计时整合到 Firefly 右侧日历，保留轻量、安全和无外部请求的实现。
image: ""
tags: [Firefly, Astro, Svelte, 时间进度]
category: Firefly
slug: firefly-time-progress
---

时间进度适合与日历放在一起：用户看日期时，也能同时看到本月和年度进度，以及最近节日和春节倒计时。本文将原本左栏独立卡片改为右侧日历内的紧凑信息区，日期计算固定使用北京时间，并让所有倒计时在数据缺失时安全降级。

这次调整是对原有 Firefly 时间进度魔改的完善，不改变日历切月、文章列表和年度文章热力图。

## 代码入口

`src/utils/time-progress.ts` 提供可注入 `Date` 的纯函数：`getBeijingYearProgress`、`getBeijingMonthProgress`、`getBeijingWeekProgress`、`getNextHolidayCountdown` 和 `getNextSpringFestivalCountdown`。它们通过 UTC 时间戳加八小时计算北京时间，因此服务器和访客时区不同也不会改变结果。

三个进度函数返回的 `currentDay` 含义与周期一致：年度和月度表示对应周期内的日期编号，周进度表示周内第几天（周一为 1、周日为 7）。当前页面只展示百分比，但这个约定能避免后续调用者把周进度误当成当月日期。

节假日配置位于 `src/config/timeProgressConfig.ts`。每条记录都有名称、日期、来源、`verified` 与 `coverageYears`，并可提供 `sourceUrl`。只有 `verified: true` 且 `sourceUrl` 解析后满足 HTTPS、无端口、无用户名/密码，并严格使用国务院官网主机 `www.gov.cn` 时才参与倒计时；日期不合法、来源未核验、任意第三方域名或年份不在覆盖范围内时返回 `null`。2026 年中秋节和国庆节均使用同一份国务院办公厅公告核验，因此 2026 年 9 月 9 日页面会优先显示距中秋节的倒计时，过了中秋节后再显示距国庆节的倒计时。

春节单独放在 `timeProgressConfig.springFestivals`，通过 `kind: "springFestival"` 标识。春节日期使用本地人工核对数据，不在浏览器端请求接口；当前配置的 2027 年春节为 `2027-02-06`。缺少下一年度数据时，春节行会保留但显示“暂无数据”，不会伪造倒计时。

2026 年 9 月 6 日已核对国务院官网《国务院办公厅关于2026年部分节假日安排的通知》。配置使用有效官方来源 `https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm`，所以 2026 年国庆数据会参与倒计时；来源未核验或年份不在覆盖范围内时仍会安全隐藏。

## 侧栏与刷新

Astro 外壳先输出 SSR 进度，Svelte 客户端使用 `client:visible` 在宽屏日历进入视口时才启动。时间进度不再占用左栏独立卡片，而是放在右侧日历下方；左栏顺序恢复为音乐、每日一言、分类。日历自身仍保留切月、文章列表和年度文章热力图。文章页和移动端不会启动刷新。存在有效节日倒计时时，客户端用唯一每秒定时器更新；没有倒计时时，仅对齐下一分钟边界刷新，避免无意义的秒级唤醒。它通过仓库实际的 `window.swup.hooks.on("visit:start")` 在切页前停止定时器，并在卸载时注销 hook；组件隐藏、离开视口、标签页隐藏和断点变化也会停止刷新。支持 `IntersectionObserver` 时由观察器给出交叉状态；旧浏览器没有该 API 时，`setupTimeProgressLifecycle` 通过 `getBoundingClientRect()` 加 `scroll/resize` 事件检查视口，滚出视口后立即清除定时器，无法取得可信几何状态时默认不刷新。该回退路径还会在 `astro:page-load` 和组件 `class/style` 属性变化时重新计算几何位置，避免页面切换或布局变化后沿用过期的视口状态。

## 验证、安全与回滚

专项测试覆盖闰年、月末、周边界、周内日期编号、北京时间午夜、最近公共节日选择、春节日期、未核验来源、国务院官网白名单、Swup 延迟初始化/重复事件/清理以及刷新频率；运行时测试还驱动可用和不可用 `IntersectionObserver`、滚动离开/回到视口、`astro:page-load`、布局属性变化、页面可见性、媒体断点、隐藏属性、Swup 切页和卸载清理。组件测试确认没有 `fetch`、WebSocket，并检查隐藏暂停和 ARIA 进度条。当前专项命令为 `pnpm exec tsx --test src/utils/time-progress.test.ts src/utils/time-progress-lifecycle.test.ts src/components/widget/TimeProgress.test.ts src/components/widget/Calendar.test.ts`，结果 22/22 通过；全量测试 127/127 通过。`pnpm check`（224 文件零错误/警告/提示）、`pnpm type-check`、Biome 和 `pnpm build`（47 页面、Pagefind 29 页面）均已通过，生产预览已完成桌面、移动、文章页、亮暗色和无横向溢出检查。

回滚本次日历整合时，删除 `Calendar.astro` 中的时间信息区和春节配置，恢复 `sidebarConfig.ts` 中的左栏 `timeProgress` 注册即可；如需完全移除时间进度功能，再按原计划删除时间组件、工具、生命周期协调器、配置、测试和本文，不影响每日一言或音乐组件。
