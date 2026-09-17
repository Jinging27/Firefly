---
title: Firefly 魔改：加入轻量在线每日一言
published: 2026-08-13
updated: 2026-09-17
description: 为 Firefly 添加带本地兜底、每日缓存和按需加载的在线每日一言，并把它放到左侧栏音乐与分类之间。
image: ""
tags: [Firefly, Astro, Svelte, 每日一言]
category: Firefly
slug: firefly-daily-quote
---

我一直挺喜欢博客里的每日一言。它没什么“必须存在”的理由，但偶尔刷新页面看到一句刚好合心情的话，确实会让站点多一点活气。

不过这个功能很容易越做越重：为了十几个字加载字体、每次切页都请求接口，甚至因为接口挂了留下一张空卡片。我的要求比较简单——它可以有趣，但不能拖慢博客。

最后做出来的版本只在桌面端非文章页显示，位置是左侧栏的音乐播放器下面、分类上面。标题与音乐卡片一样使用站点系统字体，正文和出处使用系统正楷字体；在线接口不可用时显示本地文案，不会影响其他内容。

## 小白跟做步骤

先复制项目或新建分支。依赖未安装时在项目根目录执行 `pnpm install`。这项功能可以直连免密钥接口，但接口不是本站服务，不能把它当作稳定性保证。

1. 在 `src/config/dailyQuoteConfig.ts` 修改本地 `fallback` 文案、接口超时和缓存键；
2. 在 `src/config/sidebarConfig.ts` 保持组件顺序为 `music`、`dailyQuote`、`categories`，三者都使用 `position: "sticky"`；
3. 不要把外部返回内容改成 `{@html}`，正文必须继续使用普通文本插值；
4. 依次运行每日一言专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`；
5. 用 `pnpm dev` 打开首页，在 1280px 以上桌面宽度和手机宽度分别检查下面的验收点。

## 先确定位置

Firefly 的侧栏顺序在 `src/config/sidebarConfig.ts` 中配置。每日一言只注册在左栏一次：

```ts
{
	// 组件类型：音乐播放器
	type: "music",
	enable: true,
	position: "sticky",
	showOnPostPage: true,
},
{
	// 组件类型：每日一言组件
	type: "dailyQuote",
	enable: true,
	position: "sticky",
	showOnPostPage: false,
},
{
	// 组件类型：分类组件
	type: "categories",
	enable: true,
	position: "sticky",
	showOnPostPage: true,
},
```

这里有个不太显眼的坑。Firefly 会先收集全部 `top` 组件，再渲染 `sticky` 组件，所以三个卡片不仅要在数组里相邻，还要属于同一个分组。每日一言如果写成 `position: "top"`，代码顺序看着没错，页面位置却会跑到音乐上面。

我还把 `showOnPostPage` 设为 `false`。文章页已经有正文和目录，不需要再用一句随机文案分散注意力。

## 给组件准备本地内容

配置放在 `src/config/dailyQuoteConfig.ts`：

```ts
const fallback = Object.freeze({
	text: "不积跬步，无以至千里。",
	source: "荀子《劝学》",
});

export const dailyQuoteConfig = Object.freeze({
	title: "每日一言",
	fallback,
	timeoutMs: 2_000,
	storageKey: "firefly:daily-quote:v1",
});
```

本地文案不是装饰性的占位符，而是正式的降级内容。Astro 构建页面时就能输出它，所以即使访客关闭 JavaScript，或者第三方接口当天正好不可用，卡片仍然完整。

两秒超时也比较保守。每日一言不值得让浏览器一直等，慢了就继续显示本地文案。

## 请求在线一言

数据层在 `src/utils/daily-quote.ts`。当前使用免密钥的一言国际接口，并固定为文学、诗词和哲学分类：

```ts
export const DAILY_QUOTE_ENDPOINT =
	"https://international.v1.hitokoto.cn/?c=d&c=i&c=k&encode=json&max_length=40";
```

请求参数也写死在代码里：

```ts
const response = await fetch(DAILY_QUOTE_ENDPOINT, {
	method: "GET",
	mode: "cors",
	credentials: "omit",
	referrerPolicy: "no-referrer",
	cache: "no-store",
	redirect: "error",
	signal: controller.signal,
});
```

这里不携带 Cookie，也不发送 Referer。浏览器直连第三方接口时，对方仍会看到建立连接所需的 IP、请求时间和 User-Agent；如果以后不希望访客直接连接第三方服务，可以换成自己的同源代理，或者干脆改成本地名言库。

## 外部文字不能拿来就用

接口返回 JSON 不等于内容一定适合直接显示。我给正文设了 40 个 Unicode 字符的上限，并拒绝控制字符、零宽字符和双向文本控制字符。来源与作者最多 80 个字符；它们有问题时只丢掉字段，不影响合法正文。

```ts
export function parseDailyQuote(value: unknown): DailyQuote | null {
	if (typeof value !== "object" || value === null) return null;

	const record = value as Record<string, unknown>;
	const text = normalizeValidText(record.hitokoto, 40);
	if (!text) return null;

	const quote: { text: string; source?: string; author?: string } = { text };
	const source = normalizeValidText(record.from, 80);
	const author = normalizeValidText(record.from_who, 80);
	if (source) quote.source = source;
	if (author) quote.author = author;
	return quote;
}
```

界面用 Svelte 的普通文本插值 `{quote.text}` 渲染，不使用 `{@html}`。即使接口返回一段看起来像 HTML 的字符串，它也只会作为文字出现，不会被浏览器执行。

## 一天请求一次就够了

成功取得内容后，我把它写入 `localStorage`，正常缓存到下一个北京时间零点。如果正好在零点前最后一小时访问，则至少保留一小时，避免刚请求完几分钟就失效。

```ts
export function calculateDailyQuoteExpiry(now: number): number {
	const beijingNow = new Date(now + BEIJING_OFFSET_MS);
	const nextBeijingMidnight =
		Date.UTC(
			beijingNow.getUTCFullYear(),
			beijingNow.getUTCMonth(),
			beijingNow.getUTCDate() + 1,
		) - BEIJING_OFFSET_MS;
	return Math.max(nextBeijingMidnight, now + MINIMUM_CACHE_TTL_MS);
}
```

Svelte 模块里还有一个共享 loader。同一会话中不管组件因为页面导航挂载多少次，都复用第一次的 Promise。缓存不能读取、接口失败或请求超时，也不会不停重试。

## 只在真的看得见时加载

Astro 外壳在 `src/components/widget/DailyQuote.astro`：

```astro
<WidgetLayout
	name={dailyQuoteConfig.title}
	id="daily-quote"
	class={widgetClass}
>
	<DailyQuoteClient client:visible config={dailyQuoteConfig} />
</WidgetLayout>
```

`client:visible` 的意思是组件接近可视区域时再加载客户端代码。它比页面一打开就水合更适合侧栏小组件。

这个卡片默认隐藏，只在宽度达到 1280 像素时显示：

```css
:global(.daily-quote-widget) {
	display: none;
}

@media (min-width: 1280px) {
	:global(.daily-quote-widget:not(.hidden)) {
		display: block;
	}
}
```

因此首次直接打开平板、手机或文章页时，岛组件不可见，不会水合，也不会发起在线请求或下载 `DailyQuoteClient` 的客户端代码。如果此前已在宽屏非文章页加载，已经下载的资源不会因切换页面或缩窄窗口而撤销。

## 标题和正文各司其职

每日一言的标题属于侧栏导航层级，应当和音乐卡片标题保持一致，因此不再给它设置专属字体、字号或字重，而是继续继承站点系统样式。只有 `WidgetLayout` 的内容容器使用系统正楷字体栈：

```css
:global(widget-layout[data-id="daily-quote"] #daily-quote) {
	font-family:
		"Kaiti SC", "STKaiti", "KaiTi", "楷体", "DFKai-SB", "BiauKai", serif;
}
```

主句和出处另加语义类，并直接使用 Tailwind 的排版尺度：

```svelte
<p class="daily-quote-text text-base leading-7 ...">{quote.text}</p>
<p class="daily-quote-attribution text-sm leading-6 ...">...</p>
```

在组件实际显示的 1280 像素及以上宽度，主句是 16px 字号、28px 行高，出处是 14px 字号、24px 行高。Windows、macOS 和其他系统会依次寻找本机已有正楷字体，好处是零下载、零额外请求；不同设备字形可能略有差异，最后回退到衬线字体。

## 测试哪些东西

数据测试覆盖内容长度、Unicode、危险控制字符、缓存损坏、超时、错误 MIME、HTTP 失败和会话去重。布局与排版测试专门锁定下面这些约束：

- `dailyQuote` 在所有侧栏配置中只出现一次；
- 左栏顺序必须是音乐、每日一言、分类；
- 三者同属 `sticky` 分组，每日一言不进入文章页。
- 正楷字体只作用于 `widget-layout[data-id="daily-quote"] #daily-quote`，不影响标题；
- 字体栈不再包含行楷字体，并固定使用系统正楷回退顺序；
- 主句固定为 `text-base leading-7`，出处固定为 `text-sm leading-6`。

本地验证命令：

```powershell
pnpm exec tsx --test src/components/widget/DailyQuote.test.ts src/utils/daily-quote.test.ts
pnpm check
pnpm type-check
pnpm build
```

本轮全量测试 **138/138 通过**，`pnpm check` 检查 **229 个文件且为 0 errors、0 warnings、0 hints**，`pnpm type-check` 和 `pnpm build` 通过；生产构建生成 **48 个页面**，Pagefind 索引 **30 个页面**。

### 改完后应该看到什么

- 在 **1280px 或更宽**的非文章页，左栏顺序应为音乐、每日一言、分类；“每日一言”标题的字体应和“音乐”标题一致。
- 正文应比旧版本更易读，使用系统正楷字体；在线请求成功时显示接口内容，失败或超时时仍显示本地 fallback。
- 首次直接打开 **1279px、手机或文章页** 时，每日一言卡片应隐藏，不应额外发起接口请求；如果先在宽屏加载过，再缩窄窗口，已下载资源不会被浏览器撤销，这是正常现象。
- 浏览器 Network 面板中，同一个北京时间日期只应成功请求一次；刷新后命中本地缓存时不应重复请求。

如果接口在控制台显示 CORS、超时或非 2xx，先确认页面仍显示 fallback。只有 fallback 也消失时才检查 `dailyQuoteConfig.ts` 的字段，不能为了消除控制台错误而关闭文本安全校验。

## 修改、关闭与回滚

修改默认句子和出处，编辑 `src/config/dailyQuoteConfig.ts` 里的 `fallback`。

暂时关闭功能则去 `src/config/sidebarConfig.ts` 找到 `type: "dailyQuote"`，把 `enable` 改成 `false`。关闭后组件不会渲染，在线请求自然也不会发生。

如果要回滚整项功能，先把 `enable` 改回 `false`，再删除 `src/components/widget/DailyQuote.astro`、`src/components/widget/DailyQuoteClient.svelte`、`src/config/dailyQuoteConfig.ts` 和 `src/utils/daily-quote.ts`，同时移除 `sidebarConfig.ts` 中的 `dailyQuote` 条目。删除后重新运行专项测试、`pnpm check`、`pnpm type-check` 和 `pnpm build`，不要只删组件而留下配置引用。

这次没有加刷新按钮、切换动画和多接口轮询。标题安静地融入侧栏，正文保留正楷阅读感，每日一言偶尔换一句话，就够了。
