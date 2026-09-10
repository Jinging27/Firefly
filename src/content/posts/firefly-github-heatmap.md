---
title: Firefly：添加客户端缓存的 GitHub 贡献热力图
published: 2026-09-06
updated: 2026-09-09
description: 使用现有 GitHub 链接和公开数据，在 Firefly 右侧栏显示轻量贡献热力图。
image: ""
tags: [Firefly, GitHub, Astro, Svelte]
category: Firefly
slug: firefly-github-heatmap
---

GitHub 热力图适合放在侧栏，但不应该让静态博客在构建时冻结贡献数据，也不应该把 Token 放进浏览器。这个实现从现有个人资料链接提取用户名，客户端按需读取公开 JSON，并在失败时保持空状态。组件配置在右侧栏，默认只出现在宽屏非文章页。

## 安全边界

组件只请求固定 HTTPS 接口 `https://github-contributions-api.jogruber.de/v4`，使用 5 秒超时、`credentials: omit`、`referrerPolicy: no-referrer` 与 `redirect: error`。响应会检查数组长度、日期格式、计数、等级、重复日期、总数一致性和日期跨度，最早/最晚日期最多相隔 371 天；渲染前还会限制最多 54 个周列，异常数据直接降级，未经验证的数据不会进入 DOM。客户端不使用 GitHub Token、GraphQL 凭据或私有仓库权限，也不会跟随接口重定向。

## 性能边界

Astro 会先输出轻量外壳，外壳中的 `client:visible` 让客户端仅在宽屏非文章页且组件实际可见时水合并发出请求；移动端不会请求热力图数据。浏览器端只有一个共享请求，并使用 6 小时缓存；网络失败、接口限流和存储异常都只显示降级提示，不阻塞页面构建。热力图使用原生 CSS 网格，间距为 2px，格子可以压缩到侧栏内容宽度内，不新增依赖。

## 配置与验证

GitHub 用户名继续维护在 `src/config/profileConfig.ts` 的 GitHub 链接中，热力图本身不重复保存用户名。想关闭功能时，将 `src/config/sidebarConfig.ts` 中 `type: "githubHeatmap"` 的 `enable` 改为 `false`。本次实现已通过热力图数据测试 14/14、组件契约测试 5/5、开发服务器配置契约测试 1/1、Biome、`pnpm check`（224 文件）、`pnpm type-check` 和 `pnpm build`（47 页、Pagefind 29 页）。开发预览 `8789` 已验证滚动到组件后显示 9 次贡献且控制台无水合 403；生产预览已验证 1280px 真实接口返回 9 次贡献、53 周、376 格；1279px、390px 和文章页隐藏且无 GitHub 请求；1440px 亮暗主题下没有横向溢出。预览中的 Meting CORS 错误属于既有音乐接口，不影响热力图。

## 回滚

关闭右侧栏的 `githubHeatmap` 配置即可；若完全移除，删除热力图组件、工具、配置、测试和本文，并恢复侧栏映射即可。
