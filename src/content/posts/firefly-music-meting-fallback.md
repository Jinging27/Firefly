---
title: Firefly 魔改：让 Meting 音乐接口超时后自动降级
published: 2026-09-17
updated: 2026-09-18
description: 记录 Firefly 音乐播放器如何限制 Meting 请求等待时间、自动切换备用接口，并在全部失败时结束加载态。
image: ""
tags: [Firefly, 音乐, Meting, 性能]
category: Firefly
slug: firefly-music-meting-fallback
---

## 先说现象：为什么音乐卡片会一直转圈

Firefly 的 `mode: "meting"` 会让浏览器请求第三方 Meting API。如果主接口连接建立后一直没有响应，原来的 `fetch()` 会一直等待，备用接口也不会开始请求。音乐卡片只有收到初始化事件才会关闭加载遮罩，所以页面看起来像“音乐坏了”，实际是请求没有结束。

这次改造给每个接口增加了超时取消：主接口在限定时间内没有完成，就中止请求并继续尝试备用接口；所有接口都失败时，播放器结束加载态并显示错误，不会把整页卡住。

## 实施步骤

先复制项目目录或新建分支。依赖未安装时在项目根目录运行 `pnpm install`。本教程只改音乐配置和音乐管理器，不要把第三方 Token、Cookie 或代理扩展写进博客。

1. 打开 `src/types/musicConfig.ts`，确认 `meting` 类型包含 `requestTimeoutMs?: number`；
2. 打开 `src/config/musicConfig.ts`，在 `meting` 中设置请求超时和备用接口；
3. 保留 `src/components/features/MusicManager.astro` 中的 `AbortController`、`signal` 和 `clearTimeout`；
4. 运行专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 启动 `pnpm dev`，打开首页，在浏览器 Network 面板观察 Meting 请求。

## 配置入口

示例配置如下，歌单 ID 和接口地址要换成你自己确认过的内容：

```ts
// src/config/musicConfig.ts
meting: {
  api: "https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
  requestTimeoutMs: 5000,
  server: "netease",
  type: "playlist",
  id: "你的歌单 ID",
  auth: "",
  fallbackApis: [
    "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
    "https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
  ],
},
```

`requestTimeoutMs` 的有效范围会被限制在 1000 到 15000 毫秒之间。默认值 5000 毫秒适合侧栏小组件：不会让主接口无限等待，也给接口足够的正常响应时间。

## 代码做了什么

`MusicManager.astro` 会按 `api`、`fallbackApis` 的顺序逐个请求。每次请求都创建独立的 `AbortController`，计时器到期后调用 `controller.abort()`，并把 `signal` 传给 `fetch()`。无论成功、HTTP 错误、JSON 错误还是超时，`finally` 都会清理计时器，然后继续下一个接口。

成功返回非空数组后，播放器照常显示歌名、歌手、封面和播放列表；全部失败时，原有的 `fm:init` 空状态和错误文案仍会执行，加载遮罩会关闭。

## 改完后应该看到什么

- 正常情况下：首页音乐卡片显示歌名和歌手，加载图标很快消失；
- 主接口不可用时：Network 中先看到主接口失败或被取消，随后看到备用接口请求；备用接口返回 `200` JSON 后，音乐卡片显示播放列表；
- 全部接口不可用时：最多等待每个接口的超时时间，之后卡片显示错误文案，文章、导航、搜索和其他侧栏组件仍可用；
- 点击播放按钮才会播放，不会因为初始化请求成功而自动播放；
- 控制台中的第三方 CORS 或网络错误只影响音乐数据，不应阻塞 Astro 构建和其他页面。

不要只看“请求返回 200”就判定音乐可播。歌单接口、歌曲地址、封面和歌词可能由不同域名提供，仍需点击播放按钮检查实际音频是否能播放。

## 失败处理与本地模式

如果 Network 中所有接口都失败，先检查歌单 ID、接口是否仍公开、浏览器是否允许跨域请求。公共 Meting 服务可能临时限流、维护或改变响应格式，不能通过浏览器扩展绕过 CORS。

需要完全摆脱第三方接口时，把 `src/config/musicConfig.ts` 的 `mode` 改为 `"local"`，并在 `local.playlist` 填写自己拥有的音频、封面和歌词文件。这样不会发起 Meting 请求，但需要自己维护媒体文件。

## 安全与性能边界

- 请求只读取公开歌单，不发送 Cookie、授权头或站点数据；
- 超时只影响当前接口，不会阻塞构建、Swup 切页或其他组件；
- 不新增运行时依赖，不增加常驻轮询和定时器；
- 每个请求结束后都会清理计时器，避免页面长时间运行产生残留；
- 不要把访问令牌写入 `src/config/musicConfig.ts` 的公开前端配置。

## 验证命令

```powershell
pnpm exec tsx --test src/components/features/MusicManager.test.ts
pnpm check
pnpm type-check
pnpm exec biome check src/components/features/MusicManager.astro src/components/features/MusicManager.test.ts src/config/musicConfig.ts src/types/musicConfig.ts
pnpm build
```

本次回归测试会检查每个 Meting 请求都有取消信号和计时器清理，并确认备用接口仍按原顺序尝试。

## 回滚

只想恢复配置时，删除 `requestTimeoutMs` 即可，代码会使用内置的 5 秒默认值。要整体撤销本次改造，应同时恢复 `MusicManager.astro`、`musicConfig.ts`、`musicConfig` 类型和专项测试；不要只删除计时器而保留半套取消逻辑。
