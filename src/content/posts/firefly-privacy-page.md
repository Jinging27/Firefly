---
title: Firefly 魔改：添加隐私与第三方服务说明页
published: 2026-09-18
description: 为 Firefly 增加一个面向读者的隐私说明页，集中解释 Umami、Giscus、Memos、浏览器本地存储和第三方小组件的数据边界。
image: ""
tags: [Firefly, 隐私, Umami, Giscus, Astro]
category: Firefly
slug: firefly-privacy-page
---

## 功能目标

当博客启用统计、评论、音乐或其他在线小组件后，访客需要一个稳定、容易读懂的入口了解这些服务的作用和边界。本次改造增加 `/privacy/` 静态页面，并在所有带页脚的页面提供“隐私说明”链接。正文先给读者结论，再分别解释本站、浏览器本地存储和第三方服务的边界。

这项改造只增加说明文字，不新增统计脚本、评论脚本、Cookie、API、远程图片或 npm 依赖，也不改变已有功能的开关。

## 文件边界

本次涉及以下文件：

```text
src/content/spec/privacy.md       # 隐私说明正文
src/pages/privacy.astro           # /privacy/ 页面路由
src/components/layout/Footer.astro # 页脚入口
src/utils/privacy-page.test.ts    # 正文和入口契约测试
```

如果只是修改说明文字，通常只需要更新 `src/content/spec/privacy.md`。如果新增或移除了第三方服务，应同步调整正文、测试和本教程中的当前状态。

## 实施步骤

### 1. 准备项目并检查工作树

在项目根目录运行：

```powershell
git status --short --branch
```

确认没有把 `dist/`、日志、缓存、临时截图或 `.env` 当作源码文件处理。需要备份时，将备份放到系统临时目录，不要在项目内留下 `.bak` 文件。

### 2. 创建正文内容

新建 `src/content/spec/privacy.md`，建议按“先看结论—当前功能状态—数据边界—访客可以怎么做”的顺序说明：

1. 页面更新时间和说明范围；
2. Umami 当前开启的页面访问、外链点击和 Web Vitals；
3. 会话回放、Google Analytics、Clarity 和 51.la 当前关闭；
4. Giscus 使用 GitHub Discussions，评论需要 GitHub 登录；
5. 音乐、每日一言、GitHub 热力图和追番页可能请求第三方接口；
6. Memos 当前关闭，动态来自本地构建数据；
7. 主题、壁纸、音量和布局偏好使用浏览器 `localStorage`；
8. 加密文章/相册密码只在当前会话 `sessionStorage` 缓存并用于本地解密；
9. Giscus 评论公开显示，修改或删除需要在 GitHub Discussions 中操作；
10. 不要在评论和外链查询参数中填写敏感信息；
11. 服务变化时更新本页。

不要把 Umami 管理 Token、GitHub Token、Cookie、密码、API Key 或本机绝对路径写进正文。可以解释“这些信息不会写入博客”，但不能放入任何真实值。

### 3. 添加页面路由

新建 `src/pages/privacy.astro`，复用关于页的内容集合渲染方式：

```astro
---
import { getEntry, render } from "astro:content";
import Markdown from "@components/common/Markdown.astro";
import MainGridLayout from "@/layouts/MainGridLayout.astro";

const privacyPost = await getEntry("spec", "privacy");
if (!privacyPost) throw new Error("Privacy page content not found");
const { Content } = await render(privacyPost);
---

<MainGridLayout title="隐私说明" description="隐私与第三方服务说明">
  <div class="flex w-full rounded-(--radius-large) overflow-hidden relative min-h-32">
    <div class="card-base z-10 px-9 py-6 relative w-full">
      <Markdown class="mt-2"><Content /></Markdown>
    </div>
  </div>
</MainGridLayout>
```

项目实际实现使用 Biome 格式化后的同等结构。页面只在构建阶段读取 Markdown；页面组件本身不新增浏览器请求，生产布局中既有的全站 Umami 仍按当前配置门控加载。

### 4. 添加页脚入口

打开 `src/components/layout/Footer.astro`，在 RSS、Sitemap 附近添加：

```astro
<span aria-hidden="true">/</span>
<a class="transition link text-(--primary) font-medium" href={url("privacy/")}
  >隐私说明</a
>
```

继续保留 `Powered by Astro & Firefly` 致谢，不要用外部 URL 替代站内 `/privacy/` 路径。

### 5. 运行专项验证

```powershell
pnpm exec tsx --test src/utils/privacy-page.test.ts
pnpm exec biome check src/pages/privacy.astro src/utils/privacy-page.test.ts src/components/layout/Footer.astro
pnpm check
pnpm type-check
pnpm exec biome check src
pnpm build
```

构建后检查：

```powershell
Test-Path dist/privacy/index.html
Select-String -Path dist/privacy/index.html -Pattern "隐私说明|Umami|Giscus|Memos"
```

## 改完后应该看到什么

- 打开 `/privacy/` 后，页面卡片标题为“隐私说明”；
- 正文开头先看到“先看结论”和当前功能状态表；
- 正文还应说明浏览器 `localStorage` 偏好、加密内容的 `sessionStorage` 会话缓存、Giscus 公开评论和 Memos 关闭状态；
- 首页、文章页、留言页等带页脚的页面都能看到“隐私说明”；
- 点击链接后地址为 `/privacy/`，不是外部站点；
- 隐私页组件不会新增 Umami、Giscus、音乐或其他第三方请求；生产布局仍可能按全站门控加载既有 Umami，这不是本页面新增行为；
- 首页原有音乐、每日一言、评论和统计行为不发生变化。

## 常见问题

### 页面能打开，但页脚没有链接

确认访问的是包含 `Footer.astro` 的布局页面，并检查构建产物是否是最新构建。不要只刷新旧的 `dist/` 目录；先重新运行 `pnpm build`。

### 为什么页面写了第三方会看到 IP 和 User-Agent

这是浏览器建立网络连接时的基础请求信息，不代表本站获得了第三方服务的管理权限。页面的目的，是把这种请求边界告诉访客，而不是声称第三方服务完全不处理网络元数据。

### 是否需要给页面加统计或评论

不需要。隐私说明页应该尽量保持静态和低依赖，避免访客为了查看隐私说明又触发一组新的统计或第三方请求。

### 是否需要弹出 Cookie 同意框

本次没有实现同意弹窗或偏好管理。是否需要这类机制要结合实际服务、访客地域和适用法律另行评估，不能因为增加了说明页就宣称已经完成全部合规工作。

### 为什么要说明 localStorage 和 sessionStorage

它们是浏览器本地存储，不等同于本站服务器数据库。主题、壁纸、音量和布局偏好会保存在访客自己的浏览器中；访问加密文章或相册时，密码会在当前会话中短暂缓存，用于本地解密。清除站点数据或关闭会话后，相关本地状态会被清除或失效。

### Giscus 评论可以怎么修改或删除

Giscus 把评论映射到 GitHub Discussions。评论发布后属于 GitHub 的公开讨论内容，修改或删除应登录 GitHub，在对应的 Discussion 中操作，而不是把 GitHub 密码交给博客。

## 安全、性能与隐私边界

- 页面只输出静态 Markdown，不新增页面专属远程脚本或请求；生产布局中既有的 Umami 仍按全站配置运行；
- 本站不保存登录 Cookie；界面偏好使用访客浏览器的 `localStorage`，加密内容密码只在当前会话的 `sessionStorage` 中用于本地解密；
- 公开 UID、Umami Website ID 和 Giscus ID 是服务所需的公开标识，不是登录凭据；
- 不要在外链查询参数、公开评论或动态内容中放入 Token、密码、手机号、邮箱验证码或其他敏感信息；
- 第三方服务的可达性和保存期限以其自身政策为准，本站不能用静态说明替代服务商的隐私政策；
- 当前 Memos 仍关闭，不能根据这篇教程直接填写未经核验的实例地址或 Token。

## 回滚

删除 `src/pages/privacy.astro`、`src/content/spec/privacy.md`、`src/utils/privacy-page.test.ts`，并移除 `Footer.astro` 中的隐私说明链接，再重新执行 `pnpm check`、`pnpm type-check` 和 `pnpm build`。回滚不会影响已有 Umami 数据或 GitHub Discussions 评论。
