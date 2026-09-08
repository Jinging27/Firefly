---
title: Firefly 魔改：从模板默认值到自己的博客身份
published: 2026-09-07
description: 记录 Firefly 博客基础个性化的配置入口、来源保留、验证方法和安全边界。
image: ""
tags: [Firefly, Astro, 博客配置, 个性化]
category: Firefly
slug: firefly-basic-personalization
---

Firefly 提供了完整的博客骨架，但第一次部署后，站点标题、头像、友链、赞赏页和首页横幅仍可能带着模板示例。基础个性化的目标不是重写主题，而是把这些身份信息集中替换为本站真实资料，同时保留 Firefly/Fuwari 的开源来源。

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

## 回滚

基础个性化的核心提交为：

```text
5c1cbd1e feat: 完成博客基础个性化
```

可以使用 `git revert 5c1cbd1e` 回滚整批改动；如果只是更换一项资料，应修改对应配置并单独验证，避免把上游示例服务和作者身份整体恢复。
