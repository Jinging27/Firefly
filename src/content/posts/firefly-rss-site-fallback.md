---
title: Firefly 魔改：让 RSS 域名统一跟随站点配置
published: 2026-09-07
description: 清理 Firefly RSS 路由中的上游演示域名兜底，让异常路径也统一读取本站 siteConfig.site_url，并用专项测试和构建产物验证结果。
image: ""
tags: [Firefly, Astro, RSS, 配置]
category: Firefly
slug: firefly-rss-site-fallback
---

给 Firefly 换成自己的域名后，大多数链接都会跟随 `siteConfig.site_url`。不过我在检查 RSS 路由时发现一个很隐蔽的残留：`context.site` 缺失时，代码仍会回退到 Firefly 上游演示站点。

正常生产构建通常不会触发这个回退，因为 `astro.config.mjs` 已经向 Astro 提供本站域名。但保留第二份硬编码地址会带来维护风险：以后域名迁移、路由被独立调用，或者测试没有提供完整上下文时，RSS 就可能重新带上错误域名。

这次魔改只做一件事：让 RSS 的正常路径和异常兜底都回到同一个站点配置源。

## 问题在哪里

RSS 由 `src/pages/rss.xml.ts` 生成。原来的写法是：

```ts
site: context.site ?? "https://firefly.cuteleaf.cn",
```

空值合并运算符 `??` 表示：只要 `context.site` 不是 `null` 或 `undefined`，就优先使用它；否则使用右边的字符串。

问题不在这个优先级，而在右边仍然是上游演示域名。本站的权威配置其实已经位于 `src/config/siteConfig.ts`：

```ts
export const siteConfig: SiteConfig = {
	// 其他配置……
	site_url: "https://blog.612300.xyz",
};
```

既然项目已有单一配置源，RSS 就没有必要再维护另一份字符串。

## 最小修改

`rss.xml.ts` 原本已经导入了 `siteConfig`，因此不需要增加依赖或新工具，只把兜底值改成：

```ts
site: context.site ?? siteConfig.site_url,
```

现在的规则很明确：

1. 正常构建继续优先使用 Astro 传入的 `context.site`；
2. 上下文缺失时读取 `siteConfig.site_url`；
3. 仓库中不再为 RSS 单独保存 Firefly 上游演示域名。

`astro.config.mjs` 本来就使用同一个配置：

```js
export default defineConfig({
	site: siteConfig.site_url,
	// 其他配置……
});
```

因此正常路径没有发生语义变化，只是异常兜底终于和正常配置保持一致。

## 为什么还要写专项测试

这是一行小改，但硬编码域名很容易在后续同步上游或解决冲突时被带回来。我增加了 `src/utils/rss-site-fallback.test.ts`，锁定两个契约。测试放在 `src/utils/` 而不是 `src/pages/`，因为 Astro 会把 `src/pages/` 下的 TypeScript 文件识别成路由：

- RSS 必须保留 `context.site` 优先、`siteConfig.site_url` 兜底；
- RSS 路由不得再次出现 `https://firefly.cuteleaf.cn`。

测试命令：

```powershell
pnpm exec tsx --test src/utils/rss-site-fallback.test.ts
```

测试之外还要运行正式构建，因为最终交付给订阅器的是生成后的 XML：

```powershell
pnpm check
pnpm type-check
pnpm build
```

构建完成后检查：

```powershell
$rss = Get-Content -Raw dist/rss.xml
$links = [regex]::Matches($rss, "<link>(.*?)</link>")
$links | ForEach-Object { $_.Groups[1].Value }
```

输出的频道链接和文章链接都应使用本站域名。不能简单要求整个 XML 不出现旧字符串，因为 RSS 会收录文章正文，而本文本身就需要展示被删除的旧代码；真正需要阻止的是 `<link>` 元素指向旧域名。

2026 年 9 月 7 日的实际验证结果是：专项测试 2/2 通过，`pnpm check` 检查 217 个文件且没有错误、警告或提示，`pnpm type-check` 和 `pnpm build` 退出码均为 0。构建生成 42 个页面，Pagefind 索引 24 页；`dist/rss.xml` 包含 22 个 `<link>` 元素，其中一个频道链接和 21 个文章链接全部使用 `blog.612300.xyz`，旧域名链接为 0。

## 安全与性能边界

这项修改不访问任何外部 API，也不向客户端增加 JavaScript、请求、Cookie 或身份信息。它不改变 RSS 的 HTML 清洗、密码文章保护、文章排序和内容生成逻辑。

运行时只读取已经导入的配置对象，没有循环、计时器、远程资源或新依赖，所以不会增加首页脚本、首屏请求或浏览器负担。对访客来说页面表现完全不变；受影响的只是 RSS 在异常上下文中的域名选择。

它也不是开放重定向或用户输入处理功能。`site_url` 仍由仓库维护者在受控配置文件中设置，不能由访客传入。

## 修改域名时怎么做

以后更换域名，只修改 `src/config/siteConfig.ts` 的 `site_url`，再重新构建。RSS、Astro Canonical、Sitemap 等读取同一配置的功能会一起更新。

部署后仍建议实际检查：

- `/rss.xml` 能否正常返回；
- XML 内频道和文章链接是否为新域名；
- `sitemap-index.xml` 与 `robots.txt` 是否同步；
- CDN 或部署平台是否仍缓存旧构建。

## 回滚方法

如果确实要撤销，可以恢复 `src/pages/rss.xml.ts` 原来的兜底表达式，并删除 `src/utils/rss-site-fallback.test.ts` 和本文。但旧写法会重新引入上游域名残留，更稳妥的回滚方式应该是换成另一份明确的站点配置源，而不是恢复演示地址。

这个调整很小，却解决了个性化博客常见的一类遗漏：表面配置已经换完，异常路径里还藏着模板作者的域名。对于静态博客，单一配置源往往比增加更多开关更可靠。
