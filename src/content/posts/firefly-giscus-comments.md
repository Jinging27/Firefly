---
title: Firefly 魔改：用 Giscus 接入 GitHub 评论
published: 2026-09-17
updated: 2026-09-17
description: 以 GitHub Discussions 为存储，为 Firefly 文章、留言板和友链页面接入可回滚的 Giscus 评论，并给出适合小白复刻的配置和验收步骤。
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

## 小白跟做步骤

### 1. 准备 GitHub 仓库

评论仓库必须公开。进入仓库 **Settings → General → Features**，勾选 **Discussions**。如果看不到这个选项，先确认你对仓库有管理员权限。

### 2. 在 giscus.app 获取公开配置

打开 [giscus.app 中文页面](https://giscus.app/zh-CN)，登录 GitHub，在“仓库”中选择自己的仓库，在“Discussion 分类”中选择 `Announcements`。页面下方会生成类似这样的代码：

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

这里的 `repo`、`repoId`、`category`、`categoryId` 都是公开标识，不是密码。不要把整段脚本直接复制进 Astro 页面，因为本项目的组件已经封装了加载和主题切换。

### 3. 修改一个配置文件

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

以后迁移到自己的仓库时，只替换四个仓库/分类字段；映射策略和语言可以先保持不变。

### 4. 本地验证

在项目根目录的 PowerShell 中执行：

```powershell
pnpm exec tsx --test src/config/commentConfig.test.ts
pnpm check
pnpm type-check
pnpm exec biome check src/config/commentConfig.ts src/config/commentConfig.test.ts src/components/comment/Giscus.astro
pnpm build
pnpm dev
```

打开终端显示的本地地址，再进入一篇文章和 `/guestbook/`。构建检查不会替你登录 GitHub，所以最后的 iframe 和评论提交必须用浏览器确认。

## 改完后应该看到什么

- 文章页底部出现评论卡片、GitHub 登录按钮和输入框，不再显示“评论系统尚未配置”；
- `/guestbook/` 底部出现同一套评论区；友链、赞赏或动态页面若开启了页面评论，也会复用该配置；
- Network 面板会看到 Giscus 的外部脚本/iframe 请求，评论加载失败时文章主体仍能打开；
- 切换亮色/暗色主题，评论区域会跟着切换；
- 打开另一篇文章，评论讨论随 `pathname` 变化，两个页面不会共用同一条讨论。

若页面没有评论区，优先检查 `commentConfig.type` 是否拼成 `giscus`、仓库是否公开、Discussions 是否开启，以及四个 ID 是否来自同一个 giscus.app 配置页面。

## 安全、兼容与性能

- Giscus 使用公开仓库和公开 Discussion 标识；源码中不需要 GitHub Token、密码或 Cookie。
- Giscus 是外部脚本和 iframe，第三方服务故障只会让评论区加载失败，不会阻塞 Astro 构建和文章阅读。
- `loading: "lazy"` 让评论不抢占首屏；项目没有新增 npm 依赖，也没有构建期请求 GitHub。
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
