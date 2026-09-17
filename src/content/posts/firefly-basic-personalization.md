---
title: Firefly 魔改：从模板默认值到自己的博客身份
published: 2026-09-07
updated: 2026-09-17
description: 记录 Firefly 博客基础个性化的配置入口、来源保留、验证方法和安全边界。
image: ""
tags: [Firefly, Astro, 博客配置, 个性化]
category: Firefly
slug: firefly-basic-personalization
---

Firefly 提供了完整的博客骨架，但第一次部署后，站点标题、头像、友链、赞赏页和首页横幅仍可能带着模板示例。基础个性化的目标不是重写主题，而是把这些身份信息集中替换为本站真实资料，同时保留 Firefly/Fuwari 的开源来源。

## 小白跟做步骤

先复制项目目录或新建分支。依赖未安装时在项目根目录运行 `pnpm install`。这篇文章只修改配置和个人内容，不需要先改组件源码。

1. 先改 `src/config/siteConfig.ts` 的标题、描述、正式域名和时区；
2. 再改 `src/config/profileConfig.ts` 的头像、姓名、简介和你确实拥有的链接；
3. 按需修改 `src/config/backgroundWallpaper.ts` 与 `src/content/spec/about.md`；
4. 删除或关闭没有真实账号的友链、音乐、赞赏和番组入口，不要把模板示例改名后继续使用；
5. 运行 `pnpm check`、`pnpm type-check` 和 `pnpm build`，再打开首页、关于页、友链页和移动端预览。

每次只改一组配置，保存后立即构建；这样出错时能准确知道是哪一个文件导致的。

## 先改配置，不急着改组件

本站的核心身份位于 `src/config/siteConfig.ts`：

```ts
title: "无效的博客",
subtitle: "寸进",
site_url: "https://blog.612300.xyz",
timezone: "Asia/Shanghai",
```

站点描述和关键词也在同一文件中维护。描述保留 Firefly、Astro 和 Fuwari 的来源含义，同时说明本站记录编程学习、嵌入式、Agent 工具、Vibe Coding 和 IDE 工具等内容。

个人资料位于 `src/config/profileConfig.ts`：

```ts
avatar: "assets/images/avatar.jpg",
name: "无效",
bio: "Hello, 欢迎来到无效的博客。",
```

QQ、GitHub、邮箱、网易云音乐和 RSS 都从这里生成。QQ 使用 `tencent://AddContact` 入口，网页打不开时不会伪装成普通站内链接；网易云音乐保留网页地址，并为支持客户端的环境提供 `orpheus://` 回退。

## 首页横幅与关于页

首页横幅文案位于 `src/config/backgroundWallpaper.ts`，继续使用 Firefly 原有的打字机组件，只替换主标题和动态句子。这样不会额外引入轮询、远程脚本或新的动画循环。

关于页位于 `src/content/spec/about.md`。个人介绍和博客网址使用本站资料，Firefly、Fuwari、官方文档和上游仓库链接继续保留。开源来源不是模板残留，而是项目许可证和致谢边界的一部分。

## 同步清理入口

导航栏已经移除了原作者 QQ 群和 Gitee 入口，只保留 Firefly 文档与上游仓库链接。友链、赞赏页、歌单和番组页面也分别使用本站资料或明确的关闭状态：没有真实账号的功能先关闭，不把第三方示例账号当成自己的账号。

## 安全与性能边界

本批次没有新增外部 API、统计脚本、远程图片或依赖。头像使用 `src/assets` 的本地图片管线；个人链接只指向用户明确提供的地址。没有把任何 Token、Cookie 或部署密钥写入公开配置。

基础配置改动不会阻塞首屏，也不会改变 Firefly 的侧栏生命周期。后续要加入每日一言、GitHub 热力图或 Memos 时，应该为每个功能建立独立计划，不能把外部请求顺手塞进基础配置。

### 音乐接口出现 Meting CORS 是什么

当前音乐配置的 `mode: "meting"` 会让浏览器直连第三方 Meting API。如果对方响应没有允许本站来源的 `Access-Control-Allow-Origin` 响应头，浏览器会拦截响应并在控制台显示 CORS 错误。它通常只影响歌单、歌词或封面加载，不会阻塞 Astro 构建、文章、日历、每日一言或动态页，也不代表 Token 泄露。

如果音乐必须稳定，最简单的回退是把 `src/config/musicConfig.ts` 的 `mode` 改成 `"local"`，并填写 `local.playlist`；这会停止 Meting 请求，但需要自己准备音频、封面和歌词文件。不要在浏览器端加入绕过 CORS 的代理扩展，也不要把陌生的公共代理地址直接写进生产配置。

## 验证方法

至少检查以下页面：

- 首页和文章页
- 关于页
- 友链页
- 打赏页
- 追番页和 404 页面

然后运行：

```powershell
pnpm check
pnpm type-check
pnpm build
```

检查站点标题、正式域名、头像、个人入口、横幅文案和来源链接是否一致，并确认移动端没有图片溢出或链接遮挡。

### 改完后应该看到什么

- 首页标题、浏览器标签页和 RSS 域名使用 `siteConfig.site_url`；
- 头像、简介和个人链接显示的是自己的资料；
- 关于页、友链页、赞赏页和 404 页没有原作者的账号或模板推广入口；
- 1440px 和 390px 预览都没有横向滚动条；音乐接口若 CORS 失败，其他页面仍能正常加载。

## 回滚

基础个性化的核心提交为：

```text
5c1cbd1e feat: 完成博客基础个性化
```

可以使用 `git revert 5c1cbd1e` 回滚整批改动；如果只是更换一项资料，应修改对应配置并单独验证，避免把上游示例服务和作者身份整体恢复。
