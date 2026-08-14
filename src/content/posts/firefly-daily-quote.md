---
title: Firefly 魔改：加入轻量在线每日一言
published: 2026-08-13
description: 为 Firefly 添加带本地兜底、每日缓存和按需加载的在线每日一言，并把它放到左侧栏音乐与分类之间。
image: ""
tags: [Firefly, Astro, Svelte, 每日一言]
category: Firefly
slug: firefly-daily-quote
---

我一直挺喜欢博客里的每日一言。它没什么“必须存在”的理由，但偶尔刷新页面看到一句刚好合心情的话，确实会让站点多一点活气。

不过这个功能很容易越做越重：为了十几个字加载字体、每次切页都请求接口，甚至因为接口挂了留下一张空卡片。我的要求比较简单——它可以有趣，但不能拖慢博客。

最后做出来的版本只在桌面端非文章页显示，位置是左侧栏的音乐播放器下面、分类上面。卡片使用系统行楷字体；在线接口不可用时显示本地文案，不会影响其他内容。

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

## 行楷不必再下载一套字体

我希望每日一言有一点手写感，但不想为了一个侧栏卡片增加 Web Font。最后用了系统字体栈：

```css
:global(widget-layout[data-id="daily-quote"]) {
	font-family:
		"STXingkai", "华文行楷", "Xingkai SC", "Kaiti SC", "STKaiti",
		"KaiTi", "楷体", "DFKai-SB", "BiauKai", serif;
}
```

Windows、macOS 和其他系统会依次寻找本机已有字体。好处是零下载、零额外请求；缺点也很直接，不同设备上的字形不会完全一致。对这个小组件来说，我更愿意接受这种差异。

## 测试哪些东西

数据测试覆盖内容长度、Unicode、危险控制字符、缓存损坏、超时、错误 MIME、HTTP 失败和会话去重。布局测试专门锁定下面三件事：

- `dailyQuote` 在所有侧栏配置中只出现一次；
- 左栏顺序必须是音乐、每日一言、分类；
- 三者同属 `sticky` 分组，每日一言不进入文章页。

本地验证命令：

```powershell
pnpm exec tsx --test src/components/widget/DailyQuote.test.ts src/utils/daily-quote.test.ts
pnpm check
pnpm type-check
pnpm build
```

最后再用浏览器检查桌面亮色、暗色、文章页和平板宽度。尤其要在首次加载时检查 1279 与 1280 像素的分界：前者不应加载组件，后者才开始显示；如果先在宽屏加载再缩窄，资源已经加载属于正常现象。

## 想改内容或关闭怎么办

修改默认句子和出处，编辑 `src/config/dailyQuoteConfig.ts` 里的 `fallback`。

暂时关闭功能则去 `src/config/sidebarConfig.ts` 找到 `type: "dailyQuote"`，把 `enable` 改成 `false`。关闭后组件不会渲染，在线请求自然也不会发生。

这次没有加刷新按钮、切换动画和多接口轮询。每日一言只需要安静地待在音乐下面，偶尔换一句话，就够了。
