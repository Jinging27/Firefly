---
title: Firefly：用北京时间显示时间进度与节假日倒计时
published: 2026-09-06
description: 在 Firefly 左侧栏加入不依赖网络的年、月、周进度，并为经过核验的年度数据保留安全的节假日倒计时入口。
image: ""
tags: [Firefly, Astro, Svelte, 时间进度]
category: Firefly
slug: firefly-time-progress
---

时间进度是一个适合放在侧栏的小功能，但日期计算不能交给浏览器本地时区。本文实现固定使用北京时间的年、月、周进度，并让节假日数据在缺失时安全隐藏。

## 代码入口

`src/utils/time-progress.ts` 提供可注入 `Date` 的纯函数：`getBeijingYearProgress`、`getBeijingMonthProgress`、`getBeijingWeekProgress` 和 `getNextHolidayCountdown`。它们通过 UTC 时间戳加八小时计算北京时间，因此服务器和访客时区不同也不会改变结果。

三个进度函数返回的 `currentDay` 含义与周期一致：年度和月度表示对应周期内的日期编号，周进度表示周内第几天（周一为 1、周日为 7）。当前页面只展示百分比，但这个约定能避免后续调用者把周进度误当成当月日期。

节假日配置位于 `src/config/timeProgressConfig.ts`。每条记录都有名称、日期、来源、`verified` 与 `coverageYears`，并可提供 `sourceUrl`。只有 `verified: true` 且 `sourceUrl` 解析后满足 HTTPS、无端口、无用户名/密码，并严格使用国务院官网主机 `www.gov.cn` 时才参与倒计时；日期不合法、来源未核验、任意第三方域名或年份不在覆盖范围内时返回 `null`。2026 年国庆数据已核对国务院办公厅公告，使用 `https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm`，因此 2026 年会显示距国庆节的倒计时；未核验年度仍只显示三项本地进度。

2026 年 9 月 6 日已核对国务院官网《国务院办公厅关于2026年部分节假日安排的通知》。配置使用有效官方来源 `https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm`，所以 2026 年国庆数据会参与倒计时；来源未核验或年份不在覆盖范围内时仍会安全隐藏。

## 侧栏与刷新

Astro 外壳先输出 SSR 进度，Svelte 客户端使用 `client:visible` 在宽屏可见时才启动。侧栏只注册一次，顺序固定为音乐、每日一言、时间进度、分类；文章页和移动端不会启动刷新。存在有效节日倒计时时，客户端用唯一每秒定时器更新；没有倒计时时，仅对齐下一分钟边界刷新，避免无意义的秒级唤醒。它通过仓库实际的 `window.swup.hooks.on("visit:start")` 在切页前停止定时器，并在卸载时注销 hook；组件隐藏、离开视口、标签页隐藏和断点变化也会停止刷新。支持 `IntersectionObserver` 时由观察器给出交叉状态；旧浏览器没有该 API 时，`setupTimeProgressLifecycle` 通过 `getBoundingClientRect()` 加 `scroll/resize` 事件检查视口，滚出视口后立即清除定时器，无法取得可信几何状态时默认不刷新。该回退路径还会在 `astro:page-load` 和组件 `class/style` 属性变化时重新计算几何位置，避免页面切换或布局变化后沿用过期的视口状态。

## 验证、安全与回滚

专项测试覆盖闰年、月末、周边界、周内日期编号、北京时间午夜、未核验来源、国务院官网白名单、Swup 延迟初始化/重复事件/清理以及刷新频率；运行时测试还驱动可用和不可用 `IntersectionObserver`、滚动离开/回到视口、`astro:page-load`、布局属性变化、页面可见性、媒体断点、隐藏属性、Swup 切页和卸载清理。组件测试确认没有 `fetch`、WebSocket，并检查隐藏暂停和 ARIA 进度条。当前专项命令为 `pnpm exec tsx --test src/utils/time-progress.test.ts src/utils/time-progress-lifecycle.test.ts src/components/widget/TimeProgress.test.ts`，结果 16/16 通过；`pnpm check`、`pnpm type-check`、Biome 和 `pnpm build` 均已通过，生产预览已完成桌面、移动、文章页、亮暗色和无横向溢出检查。

回滚时删除时间进度组件、工具、配置、测试和本文，并撤销侧栏映射与配置导出即可，不影响每日一言或音乐组件。
