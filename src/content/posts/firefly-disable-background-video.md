---
title: Firefly 魔改：关闭远程背景视频，优先保证加载稳定
published: 2026-09-07
updated: 2026-09-18
description: 记录 Firefly 如何关闭第三方远程背景视频，保留静态壁纸与播放器能力，并用配置契约和生产构建验证性能边界。
image: ""
tags: [Firefly, 性能, 背景视频]
category: Firefly
slug: firefly-disable-background-video
---

背景视频很有氛围，但它也会带来额外的网络请求、流量消耗和加载不确定性。对一个希望“不要卡顿”的博客来说，默认关闭第三方远程背景视频，是比继续依赖陌生视频地址更稳妥的选择。

## 实施步骤

先备份项目或新建分支。依赖未安装时运行 `pnpm install`。这项改动只处理背景播放器，不删除静态壁纸，也不需要安装新的播放器依赖。

1. 打开 `src/config/backgroundWallpaper.ts`，将 `playerEnable` 设为 `false`；
2. 删除当前配置里的第三方 `playerUrl`，不要换成另一个未经核验的远程地址；
3. 保留 `BackgroundPlayer.astro`、类型定义和静态桌面/移动壁纸配置；
4. 运行背景视频专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用 `pnpm dev` 打开首页，在桌面和手机宽度分别检查背景与导航栏。

## 改了什么

配置入口是 `src/config/backgroundWallpaper.ts`：

```ts
playerEnable: false,
```

同时移除了当前配置中的第三方 `playerUrl`。这不是删除 Firefly 的播放器，而是让播放器在默认配置下不参与页面渲染；类型定义和 `BackgroundPlayer.astro` 仍保留，未来可以单独配置本地视频。

静态桌面壁纸和移动壁纸没有改变，首页横幅文字、每日一言、时间进度、音乐和其他侧栏功能也没有改动。

## 为什么不直接换成另一个视频

换一个远程地址并不能解决根本问题：来源稳定性、跨域、带宽、版权和服务条款都可能变化。当前改造不把新的第三方地址写进配置，也不加入自动播放脚本，避免为了视觉效果扩大运行时风险。

如果以后确实需要视频，可以先在项目根目录用 PowerShell 创建目录并复制自己拥有的视频：

```powershell
New-Item -ItemType Directory -Force public/assets/videos
Copy-Item .\你的文件名.mp4 public/assets/videos/firefly.mp4
```

然后在 `src/config/backgroundWallpaper.ts` 中填写 `playerUrl: "/assets/videos/firefly.mp4"` 并显式启用。重新检查移动端、亮暗主题、减少动态效果和网络失败场景。

## 性能与安全边界

关闭后，导航栏不会出现背景视频播放按钮，首页不会请求当前远程视频地址。静态壁纸仍然正常生成，因此页面不会从横幅壁纸退化成空白背景。

这项改造没有新增依赖、脚本、Cookie、令牌或访客数据。它只减少一个外部资源依赖，不能替代真实的性能监测；上线后仍应关注首屏请求、LCP 和移动端流量。

## 如何验证

项目加入了 `src/utils/background-video-config.test.ts`，验证播放器默认关闭、当前配置不含远程视频地址、播放器类型与组件能力仍保留，以及桌面/移动静态壁纸仍存在。专项测试 **4/4 通过**；`pnpm check`、`pnpm type-check`、`pnpm build` 和目标文件 Biome 检查也通过。生产构建首页未生成 `#bg-player-toggle` 按钮或 `#bg-player` 容器，且静态壁纸仍被打包。

本轮全量测试 **138/138 通过**；`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 首页仍有静态桌面/移动壁纸，但导航栏不出现背景视频播放按钮；
- Network 面板不再请求原第三方视频地址；
- 1440px、390px、亮色和暗色模式都没有空白横幅或横向溢出；
- 如果未来重新启用播放器，必须使用本地视频并重新完成移动端、减少动态效果和失败网络验收。

## 回滚

不要直接把旧远程地址复制回来。若确有需要，先准备本地视频，再将 `playerEnable` 改为 `true` 并配置本地 `playerUrl`，完成完整验证后再决定是否发布。
