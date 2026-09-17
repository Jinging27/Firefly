---
title: Firefly 魔改：接入 Umami 页面访问、外链点击和 Web Vitals
published: 2026-09-17
updated: 2026-09-17
description: 在 Firefly 中以生产环境门控的方式接入 Umami 基础统计，记录页面访问、外部链接点击和 Web Vitals，同时保持会话回放及其他统计平台关闭。
image: ""
tags: [Firefly, Umami, 统计, Web Vitals]
category: Firefly
slug: firefly-umami-basic-analytics
---

## 这次只做三件事

本项目选择 Umami Cloud 作为唯一基础统计服务，开启：

1. 页面访问统计；
2. 外部链接点击；
3. Web Vitals（浏览器核心性能指标）。

会话回放、Google Analytics、Microsoft Clarity、51la 和公开浏览量暂时不启用。这样可以先得到必要的数据，又避免一次接入多个脚本或录制访客操作。

## Umami 是什么

Umami 是网站访问分析工具。它能告诉你哪些页面被访问、站外链接是否被点击，以及页面在真实浏览器中的性能表现。Website ID 只是公开站点标识，不是密码；不要把 Umami 登录密码、Cookie 或 API Token 写入博客。

## 小白跟做步骤

### 1. 创建 Umami Cloud 网站

打开 [Umami Cloud](https://cloud.umami.is/)，注册并登录。创建 Website 时填写自己最终部署的域名，例如：

```text
blog.example.com
```

创建后进入 Website 设置，复制 **Website ID**。每个人都必须使用自己的 ID；不要直接复制本文示例站点的 ID，否则访问数据会写入别人的统计面板。

### 2. 修改配置文件

打开 `src/config/analyticsConfig.ts`，将 `你的 Website ID` 替换为刚复制的值：

```ts
import type { AnalyticsConfig } from "../types/analyticsConfig";

export const analyticsConfig: AnalyticsConfig = {
  googleAnalyticsId: "",
  microsoftClarityId: "",
  umamiAnalytics: {
    websiteId: "你的 Website ID",
    scriptUrl: "https://cloud.umami.is/script.js",
    replaysScriptUrl: "https://cloud.umami.is/recorder.js",
    trackOutboundLinks: true,
    collectWebVitals: true,
    replays: {
      enabled: false,
    },
  },
  la51Analytics: {
    Id: "",
  },
};
```

当前示例仓库的实际 ID 已写入本项目配置，但复刻到自己的博客时必须换成自己的 ID。除了 Website ID，不需要任何账号密钥。

### 3. 理解生产环境门控

`src/layouts/Layout.astro` 中有：

```ts
const isProduction = import.meta.env.PROD;
```

统计组件只有在 `isProduction` 为 `true` 且 Website ID 非空时才输出。这样本地 `pnpm dev` 刷新页面不会污染正式数据，Cloudflare Pages 的正式构建仍会正常加载 Umami。

### 4. 运行检查

在项目根目录 PowerShell 中执行：

```powershell
pnpm exec tsx --test src/config/analyticsConfig.test.ts src/layouts/Layout.analytics.test.ts
pnpm check
pnpm type-check
pnpm exec biome check src/config/analyticsConfig.ts src/config/analyticsConfig.test.ts src/layouts/Layout.astro src/layouts/Layout.analytics.test.ts
pnpm build
pnpm dev
```

## 改完后应该看到什么

### 本地开发验收

用 `pnpm dev` 打开首页，查看页面源代码或 DevTools Elements：不应出现 `https://cloud.umami.is/script.js`。这不是漏配，而是开发环境门控正在生效。

### 生产预览验收

执行：

```powershell
pnpm build
pnpm preview
```

打开终端显示的预览地址，应该看到：

- 页面 HTML 中存在 `cloud.umami.is/script.js`；
- `data-website-id` 是你在 Umami Cloud 复制的 ID；
- `<script>` 带 `defer`，不会同步阻塞 HTML 解析；
- 点击一个站外链接后，Umami 事件中稍后出现 `outbound-link-click`；
- 访问完成后，Web Vitals 数据会在控制台逐渐出现。

最后把代码部署到 Cloudflare Pages，访问首页和一篇文章，等待几分钟后在 Umami 控制台检查页面路径、访问次数、外链事件和 Web Vitals。构建成功不等于统计数据已经上报，必须做一次真实浏览器验收。

## 常见问题

| 现象 | 处理方法 |
| --- | --- |
| 控制台没有数据 | 核对 Website 域名、生产站域名和 Website ID；确认浏览器没有拦截 `cloud.umami.is` |
| 本地调试产生访问量 | 不要把开发页数据当正式数据；确认你运行的是 `pnpm dev`，并没有打开旧的 `dist` 文件 |
| 外链点击没有记录 | 确认链接是站外地址，并等待脚本加载和数据延迟；内站链接不会被标记为外链 |
| Web Vitals 为空 | 用真实浏览器完整打开页面，不要只用 `curl` 或极短的自动化请求 |
| 页面看起来变慢 | 统计脚本带 `defer` 且不参与构建；先检查 Network 中是否是 Umami 服务本身慢，再按回滚方法暂时关闭 |

## 安全、隐私与性能边界

- Website ID 可以出现在前端；密码、Cookie、API Token 和管理接口密钥不能出现在前端或 Git；
- Web Vitals 是性能数据，本阶段没有录制会话、输入框、页面文字或鼠标轨迹；
- 外链事件可能包含被点击的目标 URL，应在隐私说明中告知访客；
- 没有新增 npm 依赖和构建期网络请求，Umami 不可达不会阻塞文章、评论、音乐、动态或搜索；
- 只在生产环境加载，避免本地刷新污染正式报表。

## 暂时没有做什么

本次没有安装 Google Analytics、Clarity 或 51la，也没有开启 Umami 会话回放和 Share API 公开浏览量。等基础采集稳定，并明确隐私和展示需求后，再为每项能力单独建立计划，不要直接叠加多个统计脚本。

## 回滚

把 `umamiAnalytics.websiteId` 清空，或把三个开关改成 `false`，然后运行 `pnpm check`、`pnpm type-check` 和 `pnpm build`。回滚只停止新的统计上报，不会删除 Umami Cloud 中已有数据，也不影响网站主体。

## 相关代码

- 配置：`src/config/analyticsConfig.ts`
- 生产门控：`src/layouts/Layout.astro`
- Umami 脚本和外链事件：`src/components/analytics/UmamiAnalytics.astro`
- 契约测试：`src/config/analyticsConfig.test.ts`、`src/layouts/Layout.analytics.test.ts`

本文按当前 Firefly 代码编写，其他 Astro/Fuwari 版本可能没有相同的配置入口。复刻时先搜索自己的 `analyticsConfig` 和布局文件，再按实际源码调整。
