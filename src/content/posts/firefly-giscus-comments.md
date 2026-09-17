---
title: Firefly 魔改：用 Giscus 接入 GitHub 评论
published: 2026-09-17
updated: 2026-09-18
description: 以 GitHub Discussions 为存储，为 Firefly 文章、留言板和友链页面接入可回滚的 Giscus 评论，并给出完整的配置、验收和回滚步骤。
image: ""
tags: [Firefly, Giscus, GitHub, 评论]
category: Firefly
slug: firefly-giscus-comments
---

## 这次改造解决什么问题

Firefly 原来把评论服务设为 `type: "none"`，文章底部只能显示“评论系统尚未配置”。这次使用 GitHub Discussions 作为评论存储，并通过 Giscus 在页面中显示评论框。评论数据不放进博客仓库，也不需要自建数据库。

本教程按当前仓库实现编写：已有的 `Giscus.astro` 组件负责 Web Component、懒加载和亮暗主题同步；你只需要在配置文件中填入自己在 giscus.app 看到的公开标识。

## 先理解 Announcements 和 General

本项目选择 `Announcements`：访客可以在文章对应的讨论下评论，但不会把博客评论区变成任何人都能随意发起新主题的论坛。`General` 更适合开放讨论区，普通用户可能可以创建新的 Discussion。做文章评论时，`Announcements` 更容易保持内容结构清晰。

## 实施步骤

### 1. 准备仓库和本地副本

评论仓库必须公开，并且你需要有仓库管理员权限。先在项目根目录确认当前工作树没有未保存改动：

```powershell
git status --short
```

可以先创建独立分支，或把配置文件复制到系统临时目录，避免在仓库内留下 `.bak` 文件：

```powershell
git switch -c codex/giscus-comments
$backup = Join-Path $env:TEMP ("firefly-commentConfig-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".ts")
Copy-Item "src/config/commentConfig.ts" $backup
```

如果仓库还没有安装依赖，在项目根目录执行 `pnpm install`。本次改造只涉及评论配置和组件加载，不要把备份文件、日志、`dist/` 或 `.env` 复制回仓库。

### 2. 开启 GitHub Discussions

进入评论仓库的 **Settings → General → Features**，勾选 **Discussions**。如果看不到该选项，先确认仓库是公开仓库并且当前账号拥有管理员权限。

### 3. 安装 Giscus GitHub App

打开 [Giscus GitHub App](https://github.com/apps/giscus)，点击 **Install**（或 **Configure**），选择 **Only select repositories**，只勾选评论仓库，然后确认安装。Giscus 要同时满足“公开仓库、已开启 Discussions、已安装 Giscus App”三个条件；只填写四个 ID 不能替代 App 安装。

安装完成后回到仓库的 **Settings → Installed GitHub Apps**，确认列表中出现 Giscus。不要授予与评论无关的其他仓库权限。

### 4. 在 giscus.app 获取公开配置

打开 [giscus.app 中文页面](https://giscus.app/zh-CN)，登录 GitHub，在“仓库”中选择刚才安装 App 的仓库，在“Discussion 分类”中选择 `Announcements`。页面应显示仓库可用、分类可用，并在下方生成配置代码：

```html
<script
  src="https://giscus.app/client.js"
  data-repo="Jinging27/Firefly"
  data-repo-id="R_kgDOTyvXLQ"
  data-category="Announcements"
  data-category-id="DIC_kwDOTyvXLc4DFz6S"
  data-mapping="pathname"
  data-strict="0"
  data-reactions-enabled="1"
  data-emit-metadata="0"
  data-input-position="bottom"
  data-lang="zh-CN"
  data-loading="lazy"
></script>
```

这里的 `repo`、`repoId`、`category`、`categoryId` 都是公开标识，不是密码。四个值必须来自同一次 giscus.app 配置，不能把一个仓库的 `repoId` 与另一个仓库的 `categoryId` 混用。不要把整段脚本直接复制进 Astro 页面，因为本项目的组件已经封装了加载、懒加载和主题切换。

### 5. 修改评论配置

打开 `src/config/commentConfig.ts`，填入：

```ts
import type { CommentConfig } from "../types/commentConfig";

export const commentConfig: CommentConfig = {
  type: "giscus",
  giscus: {
    repo: "Jinging27/Firefly",
    repoId: "R_kgDOTyvXLQ",
    category: "Announcements",
    categoryId: "DIC_kwDOTyvXLc4DFz6S",
    mapping: "pathname",
    strict: "0",
    reactionsEnabled: "1",
    emitMetadata: "0",
    inputPosition: "bottom",
    lang: "zh-CN",
    loading: "lazy",
  },
};
```

迁移到自己的仓库时只替换 `repo`、`repoId`、`category`、`categoryId` 四个字段；`mapping: "pathname"`、语言和懒加载可以先保持不变。不要把 GitHub Token、密码、Cookie 或个人访问令牌写入此文件。

组件内部还会从固定版本的 `https://esm.sh/giscus@1.6.0?bundle` 加载 Web Component。若要升级版本，应先查看 [giscus-component 发布记录](https://github.com/giscus/giscus-component/releases)，同时修改 `src/components/comment/Giscus.astro` 和契约测试，再重新执行完整验证。

### 6. 本地验证

在项目根目录的 PowerShell 中执行：

```powershell
pnpm exec tsx --test src/config/commentConfig.test.ts
pnpm check
pnpm type-check
pnpm exec biome check src/config/commentConfig.ts src/config/commentConfig.test.ts src/components/comment/Giscus.astro
pnpm build
pnpm dev
```

打开终端显示的本地地址，再依次进入一篇文章和 `/guestbook/`。如果 `pnpm dev` 使用了其他端口，以终端实际输出为准，不要把旧端口写进部署配置。构建检查不会替你登录 GitHub，所以最后的 iframe、登录和评论提交必须用浏览器确认。

## 改完后应该看到什么

- 文章页底部出现评论卡片、GitHub 登录按钮和输入框，不再显示“评论系统尚未配置”；
- `/guestbook/` 底部出现同一套评论区；友链、赞赏或动态页面若开启了页面评论，也会复用该配置；
- Network 面板会看到 Giscus 的外部脚本/iframe 请求，评论加载失败时文章主体仍能打开；
- 切换亮色/暗色主题，评论区域会跟着切换；
- 打开另一篇文章，评论讨论随 `pathname` 变化，两个页面不会共用同一条讨论。

若页面没有评论区，优先检查 `commentConfig.type` 是否拼成 `giscus`、仓库是否公开、Discussions 是否开启，以及四个 ID 是否来自同一个 giscus.app 配置页面。

如果评论框显示“无法加载”或一直转圈，按以下顺序排查：

1. 在 GitHub 仓库中确认 Discussions 仍开启；
2. 在 **Settings → Installed GitHub Apps** 确认 Giscus App 已安装到当前仓库；
3. 回到 giscus.app 重新选择仓库和 `Announcements`，核对四个 ID；
4. 在浏览器 Network 中查看 `esm.sh`、`giscus.app`、GitHub API 和 iframe 请求是否被拦截；
5. 用无痕窗口重新测试 GitHub 登录。国内网络无法访问 CDN 时，主体页面仍应可阅读，但评论功能会暂时不可用。

## 安全、兼容与性能

- Giscus 使用公开仓库和公开 Discussion 标识；源码中不需要 GitHub Token、密码或 Cookie。
- Giscus 的评论身份来自 GitHub 登录；当前方案不会提供邮箱匿名评论或访客昵称登录。后续若需要降低登录门槛，应另建 Waline/Twikoo 等评论服务评估，不在本次改造中混用。
- Giscus 是外部脚本和 iframe，第三方服务故障只会让评论区加载失败，不会阻塞 Astro 构建和文章阅读。
- `loading: "lazy"` 让评论不抢占首屏；项目没有新增 npm 依赖，也没有构建期请求 GitHub。
- Web Component 通过固定的 `giscus@1.6.0` ESM bundle 加载，减少无意升级造成的行为漂移；固定版本仍不能保证 `esm.sh` 在中国大陆网络稳定可达。
- `mapping: "pathname"` 简单可靠，但更改文章路径会产生新的评论映射；改 slug 前应先记录旧路径。

## 回滚

将 `src/config/commentConfig.ts` 的 `type` 改为 `"none"`，然后重新执行 `pnpm check`、`pnpm type-check` 和 `pnpm build`。回滚只隐藏博客中的评论入口，不会删除 GitHub Discussions 里已有的评论。

## 相关代码

- 配置：`src/config/commentConfig.ts`
- 类型：`src/types/commentConfig.ts`
- 渲染入口：`src/components/comment/index.astro`
- Giscus 封装：`src/components/comment/Giscus.astro`
- 配置契约测试：`src/config/commentConfig.test.ts`

这篇教程记录的是当前 Firefly 实现，不是把 giscus.app 生成的脚本原样贴进任何 Astro 项目。不同 Firefly/Fuwari 版本的组件入口可能不同，复刻时应以自己的仓库源码为准。
