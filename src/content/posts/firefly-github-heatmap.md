---
title: Firefly 魔改：添加客户端缓存的 GitHub 贡献热力图
published: 2026-09-06
updated: 2026-09-18
description: 使用现有 GitHub 链接和公开数据，在 Firefly 右侧栏显示轻量贡献热力图。
image: ""
tags: [Firefly, GitHub, Astro, Svelte]
category: Firefly
slug: firefly-github-heatmap
---

GitHub 热力图适合放在侧栏，但不应该让静态博客在构建时冻结贡献数据，也不应该把 Token 放进浏览器。这个实现从现有个人资料链接提取用户名，客户端按需读取公开 JSON，并在失败时保持空状态。组件配置在右侧栏，默认只出现在宽屏非文章页。右侧日历中的年度文章热力图现在默认关闭，因此两者不会重复占用同一块信息空间。

## 实施步骤

先备份项目或新建分支。项目根目录没有依赖时运行 `pnpm install`。这项功能只需要公开 GitHub 用户名，不需要 Token，也不要把 Token 粘贴到浏览器代码里。

1. 确认 `src/config/profileConfig.ts` 中有你自己的 GitHub 链接，格式类似 `https://github.com/你的用户名`；
2. 打开 `src/config/sidebarConfig.ts`，确认右侧存在 `type: "githubHeatmap"`，并把 `enable` 设为 `true`；
3. 不要在组件里另写用户名，也不要改成 GitHub GraphQL 私有接口；
4. 运行专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用 `pnpm dev` 启动预览，分别打开首页和任意文章页，按下面的验收点检查。

如果你的 GitHub 链接不是标准用户主页，组件会安全地显示空状态；先修正链接，再重复验证，不要为了让格子出现而放宽 URL 校验。

## 安全边界

组件只请求固定 HTTPS 接口 `https://github-contributions-api.jogruber.de/v4`，使用 5 秒超时、`credentials: omit`、`referrerPolicy: no-referrer` 与 `redirect: error`。响应会检查数组长度、日期格式、计数、等级、重复日期、总数一致性和日期跨度，最早/最晚日期最多相隔 371 天；渲染前还会限制最多 54 个周列，异常数据直接降级，未经验证的数据不会进入 DOM。客户端不使用 GitHub Token、GraphQL 凭据或私有仓库权限，也不会跟随接口重定向。

## 性能边界

Astro 会先输出轻量外壳，外壳中的 `client:visible` 让客户端仅在宽屏非文章页且组件实际可见时水合并发出请求；移动端不会请求热力图数据。浏览器端只有一个共享请求，并使用 6 小时缓存；网络失败、接口限流和存储异常都只显示降级提示，不阻塞页面构建。热力图使用原生 CSS 网格，间距为 2px，格子可以压缩到侧栏内容宽度内，不新增依赖。

## 配置与验证

GitHub 用户名继续维护在 `src/config/profileConfig.ts` 的 GitHub 链接中，热力图本身不重复保存用户名。想关闭功能时，将 `src/config/sidebarConfig.ts` 中 `type: "githubHeatmap"` 的 `enable` 改为 `false`。本轮全量测试 **138/138 通过**，`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 在 **1280px 或更宽**的首页，滚动到右侧热力图后，应看到 GitHub 贡献格子或明确的空状态；数据只来自公开接口。
- 在 **1279px、390px、文章详情页**，热力图应隐藏，Network 面板不应出现 GitHub 贡献接口请求。
- 在 1440px 亮色和暗色主题下，格子应留在右侧栏宽度内，不出现横向滚动条，也不挤压文章主列。
- 接口超时、限流或返回错误时，热力图只显示降级提示；首页、文章和其他侧栏仍然可用。

预览端口由 `pnpm dev` 动态选择，以终端打印的地址为准，不要把旧端口写进自己的部署配置。浏览器控制台若出现 Meting CORS，它属于音乐接口的既有问题，不代表 GitHub 热力图失败；可单独把音乐改成本地模式再排查。

日历的文章热力图不是 GitHub 组件的一部分。若确实需要同时查看两种年度概览，可在 `src/config/sidebarConfig.ts` 的日历专属配置中把 `showHeatmap` 改为 `true`；默认值保持 `false`，以免右侧信息重复。

## 回滚

关闭右侧栏的 `githubHeatmap` 配置即可；若完全移除，删除热力图组件、工具、配置、测试和本文，并恢复侧栏映射即可。
