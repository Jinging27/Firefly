---
title: Firefly 魔改：加入安全的站点短链接
published: 2026-08-14
description: 用一份配置同时生成 Astro 静态跳转页和 Cloudflare 301，并限制短链路径与目标地址的安全边界。
image: ""
tags: [Firefly, Astro, Cloudflare, 短链接]
category: Firefly
slug: firefly-short-links
---

有些地址我会反复分享，例如 GitHub 主页、常用工具文章。直接复制完整 URL 没问题，但地址一长就不容易记，文章 slug 将来变化时，旧消息里的链接也很难统一迁移。

所以我给 Firefly 加了一层很薄的站点短链接：访客记住 `/go/github/`，实际目标仍由项目内的一份配置管理。它不依赖第三方短链服务，不新增客户端脚本，也不会在访问时发起远程查询。

这次实现刻意把范围收得很窄：只支持明确列出的静态短链，只允许永久重定向 `301`，并在构建前拒绝不规范或容易产生歧义的路径。

## 当前短链放在哪里

短链统一写在 `src/config/redirectsConfig.ts`。目前有一条站内跳转和一条站外跳转：

```ts
export const redirectsConfig: RedirectsConfig = defineRedirectsConfig({
	"/go/vscode/": {
		status: 301,
		destination: "/posts/vscode-settings-and-extensions/",
	},
	"/go/github/": {
		status: 301,
		destination: "https://github.com/Jinging27",
	},
});
```

对应关系是：

- `/go/vscode/` → `/posts/vscode-settings-and-extensions/`
- `/go/github/` → `https://github.com/Jinging27`

以后添加短链，只需要在这个对象里增加一项。例如给站内教程增加 `/go/guide/`：

```ts
"/go/guide/": {
	status: 301,
	destination: "/posts/example-guide/",
},
```

如果要跳到站外，可以写完整的 HTTPS 地址：

```ts
"/go/project/": {
	status: 301,
	destination: "https://example.com/project",
},
```

添加后不需要再手写 Astro 路由或 Cloudflare 规则；两种构建产物都从同一份配置生成。

## 短链源路径的规则

短链接的左侧，也就是 `source`，必须符合下面这些规则：

- 必须放在 `/go/` 下，并保留结尾的 `/`。
- `/go/` 后只能有一段 slug。
- slug 只能使用小写字母、数字和单个连字符。
- slug 不能以连字符开头或结尾，也不能出现连续连字符。

因此 `/go/vscode/`、`/go/my-tool/` 是合法的；下面这些会在配置加载或构建时直接报错：

```text
/go/Example/             # 含大写字母
/go/example              # 缺少尾斜杠
/go/example/subpath/     # 嵌套路径
/go/-example/            # 连字符位于开头
/go/example--link/       # 连续连字符
/go/*/                   # 动态匹配
/go/:slug/               # 动态参数
/go/example%2fpath/      # 编码分隔符
```

查询串、片段、点路径、反斜杠和空白同样不允许。这里不做“尽量猜测”的纠正，因为短链一旦公开，明确而稳定比宽松更重要。

## 站内目标和站外目标

站内目标必须是以 `/` 开头的规范绝对路径，并且同样保留尾斜杠。例如：

```ts
destination: "/posts/vscode-settings-and-extensions/"
```

它不能包含动态匹配、点路径、重复斜杠、编码分隔符、查询串或片段。`/posts/example` 少了尾斜杠，也会被拒绝。

站外目标必须是完整的 `https://` URL：

```ts
destination: "https://github.com/Jinging27"
```

HTTP、协议相对地址、带用户名或密码的 URL、查询串、片段都会被拒绝。当前实现也拒绝目标中的百分号编码，避免编码后的分隔符或控制字符混进生成文件。

这些规则只负责校验 URL 格式，没有配置域名白名单，也不会判断域名信誉。HTTPS 只能说明传输连接使用加密，不代表目标站点可信；每次新增站外短链，我仍然需要人工核对域名、拼写和实际归属。

此外，短链不能指向自身。例如 `/go/example/` 再跳回 `/go/example/` 会形成循环，校验会阻止它进入配置。

## 为什么只使用 301

这些短链代表我主动维护的稳定别名，不是登录后临时跳转，也不是按请求条件切换目标，因此只允许永久重定向 `301`。

这样做还有一个实际好处：配置语义只有一种，不会因为有人随手写成 `302`、`307` 或 `308`，让不同短链表现得不一致。代价是浏览器和中间缓存可能长期记住 `301`；修改已有目标后测试时，要注意旧缓存，必要时使用无痕窗口或直接检查响应头。

## 一份配置，两层跳转

`astro.config.mjs` 把同一个 `redirectsConfig` 交给 Astro：

```js
export default defineConfig({
	redirects: redirectsConfig,
	// 其他配置……
});
```

在当前静态构建模式下，Astro 会为短链生成类似下面的 HTML 文件：

```text
dist/go/vscode/index.html
dist/go/github/index.html
```

这是一层浏览器跳转兜底。它保证静态文件被直接托管时仍有页面可以把访客带到目标地址，但它本身不能等同于服务器返回的 HTTP `301`。

为了让 Cloudflare 在边缘直接返回真正的重定向响应，我又加了一个 `astro:build:done` 钩子。构建完成后，它调用 `serializeCloudflareRedirects`，再由 `writeFile` 写出 `dist/_redirects`：

```text
/go/github/ https://github.com/Jinging27 301
/go/vscode/ /posts/vscode-settings-and-extensions/ 301
```

这里的 `writeFile` 会覆盖整个 `dist/_redirects`，当前这个文件由短链接配置独占生成。如果以后还要增加其他 Cloudflare 重定向规则，必须把它们合并进同一个序列化和生成流程，再统一写出最终文件。不要直接编辑 `dist/_redirects`，因为下次构建会覆盖它；也不要另放一份 `public/_redirects` 并期待两份规则自动合并。

序列化函数会再次校验配置，并按 source 排序，所以生成结果稳定，也不会因为对象书写顺序不同而产生无意义的差异。

`defineRedirectsConfig` 还会复制配置并深冻结返回的顶层对象和每条规则，避免后续代码意外修改已验证的数据；传入的原对象不会被冻结。

## 本地怎么验证

先运行短链配置测试：

```bash
pnpm exec tsx --test src/config/redirectsConfig.test.ts
```

再运行 Astro 检查和正式构建：

```bash
pnpm check
pnpm build
```

构建完成后，可以检查两类产物：

```powershell
Get-Content dist/_redirects
```

macOS 或 Linux 也可以使用：

```bash
cat dist/_redirects
```

以及：

```text
dist/go/vscode/index.html
dist/go/github/index.html
```

本地看到 HTML 兜底和 `_redirects` 文件，只能证明构建产物正确。Cloudflare 是否实际读取规则、线上是否返回 HTTP `301`，仍要在部署完成后复核。例如使用：

Windows PowerShell 中要明确调用系统自带的可执行文件，避免 `curl` 别名造成差异：

```powershell
curl.exe -I https://你的域名/go/github/
```

macOS 或 Linux 使用：

```bash
curl -I https://你的域名/go/github/
```

重点检查状态码和 `Location` 响应头，不要只看浏览器最后是否到达目标页面。

## 常见错误

### 写了短链却构建失败

先检查 source 是否以 `/go/` 开头并以 `/` 结尾，slug 是否只有一段小写字母、数字和单连字符。像 `/go/MyLink/`、`/go/a--b/` 都不会通过。

### 站内文章地址看起来正确却被拒绝

Firefly 当前使用尾斜杠规范，站内目标也必须写成 `/posts/example/`，不能写成 `/posts/example`。查询参数和 `#章节` 也不能放进目标。

### 外链在浏览器能打开，配置却不接受

短链的安全边界比浏览器 URL 解析更严格。确认它是完整 HTTPS 地址，并且没有凭据、查询串、片段或百分号编码。

### 本地能跳转，线上却不是 301

本地静态 HTML 跳转不代表 Cloudflare 已返回 HTTP `301`。先确认部署产物中存在 `dist/_redirects`，再查看平台构建日志和线上响应头。

### 修改目标后仍跳到旧地址

`301` 可能被浏览器或缓存层记住。先确认新构建中的 `_redirects` 已更新，再换无痕窗口或在 Windows 使用 `curl.exe -I`（macOS/Linux 使用 `curl -I`）排除本地缓存影响。

## 修改、删除与回滚

修改短链目标时，直接编辑 `src/config/redirectsConfig.ts` 中对应规则，然后重新运行测试、检查和构建。由于 `301` 可能缓存，发布后要额外验证旧访客路径的表现。

删除短链时，从配置对象中删除对应条目并重新部署。需要注意，已经传播出去的短链会随之失效；如果只是文章迁移，通常更适合保留 source，只修改 destination。

如果整套功能需要回滚，当前仓库可回退核心提交 `f63a9f0c`。不过提交号可能在 rebase 或 squash 后变化，实际回滚时还要按接入点同步撤销：删除 `src/config/redirectsConfig.ts`、`src/types/redirectsConfig.ts` 和 `src/config/redirectsConfig.test.ts`；移除 `src/types/config.ts` 对 `./redirectsConfig` 的类型再导出；移除 `src/config/index.ts` 中 `RedirectRule`、`RedirectStatus`、`RedirectsConfig` 三个类型导出，以及 `redirectsConfig`、`defineRedirectsConfig`、`serializeCloudflareRedirects` 三个值导出；再从 `astro.config.mjs` 中移除短链配置导入、`redirects: redirectsConfig` 以及生成 `dist/_redirects` 的 `astro:build:done` 集成。完成后重新构建部署。不要只撤掉其中一层，否则 Astro HTML 兜底和 Cloudflare 规则会不一致。

这套实现没有短链后台，也不追踪点击数据。对个人博客来说，我更看重的是：规则集中、构建可验证、线上行为清楚，以及以后添加一个短链时不需要再碰第二套配置。
