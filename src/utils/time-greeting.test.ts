import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { sidebarLayoutConfig } from "../config/sidebarConfig";
import {
	getTimeGreeting,
	getTimeGreetingBoundaries,
	getTimeGreetingRefreshDelay,
	setupTimeGreetingLifecycle,
} from "./time-greeting";

const greetingAstro = readFileSync(
	new URL("../components/widget/TimeGreeting.astro", import.meta.url),
	"utf8",
);
const greetingClient = readFileSync(
	new URL("../components/widget/TimeGreetingClient.svelte", import.meta.url),
	"utf8",
);

function beijingDate(hour: number, minute = 0, second = 0): Date {
	return new Date(Date.UTC(2026, 0, 1, hour - 8, minute, second));
}

describe("本地纯色版时段问候", () => {
	test("固定使用北京时间，并覆盖所有规划边界", () => {
		assert.deepEqual(getTimeGreetingBoundaries(), [0, 6, 9, 12, 14, 18]);
		assert.equal(getTimeGreeting(beijingDate(0)).key, "night");
		assert.equal(getTimeGreeting(beijingDate(5, 59, 59)).key, "night");
		assert.equal(getTimeGreeting(beijingDate(6)).key, "morning");
		assert.equal(getTimeGreeting(beijingDate(9)).key, "forenoon");
		assert.equal(getTimeGreeting(beijingDate(12)).key, "noon");
		assert.equal(getTimeGreeting(beijingDate(14)).key, "afternoon");
		assert.equal(getTimeGreeting(beijingDate(18)).key, "evening");
		assert.equal(getTimeGreeting(beijingDate(23, 59, 59)).key, "evening");
	});

	test("北京午夜和非北京本地时区不会改变时段判断", () => {
		assert.equal(
			getTimeGreeting(new Date("2026-01-01T16:00:00.000Z")).key,
			"night",
		);
		assert.equal(
			getTimeGreeting(new Date("2026-01-01T23:00:00.000Z")).key,
			"morning",
		);
	});

	test("每个边界只安排到下一个边界的正向延迟", () => {
		assert.equal(getTimeGreetingRefreshDelay(beijingDate(5, 59)), 60_000);
		assert.equal(
			getTimeGreetingRefreshDelay(beijingDate(6)),
			3 * 60 * 60 * 1_000,
		);
		assert.equal(getTimeGreetingRefreshDelay(beijingDate(23, 59, 59)), 1_000);
		assert.ok(getTimeGreetingRefreshDelay(new Date("invalid")) > 0);
	});

	test("无效日期降级为中性本地文案", () => {
		const greeting = getTimeGreeting(new Date("invalid"));
		assert.equal(greeting.label, "此刻");
		assert.equal(greeting.text, "愿你此刻安好。");
	});

	test("组件只注册在右栏、非文章页和桌面可见，不进入移动端", () => {
		const leftTypes = sidebarLayoutConfig.leftComponents.map(
			(component) => component.type,
		);
		const rightTypes = sidebarLayoutConfig.rightComponents.map(
			(component) => component.type,
		);
		const mobileTypes = sidebarLayoutConfig.mobileBottomComponents.map(
			(component) => component.type,
		);
		assert.equal(leftTypes.includes("timeGreeting"), false);
		assert.equal(
			rightTypes.filter((type) => type === "timeGreeting").length,
			1,
		);
		assert.equal(mobileTypes.includes("timeGreeting"), false);
		const config = sidebarLayoutConfig.rightComponents.find(
			(component) => component.type === "timeGreeting",
		);
		assert.ok(config);
		assert.equal(config?.position, "top");
		assert.equal(config?.showOnPostPage, false);
		assert.match(greetingAstro, /client:visible/);
		assert.match(greetingAstro, /min-width: 1280px/);
		assert.match(
			greetingAstro,
			/Astro\.url\.pathname\.includes\("\/posts\/"\)/,
		);
		assert.match(greetingAstro, /!isPostPage/);
	});

	test("实现没有图片、接口、动画或持续轮询", () => {
		assert.match(greetingClient, /setupTimeGreetingLifecycle/);
		assert.doesNotMatch(greetingClient, /fetch\(|XMLHttpRequest|WebSocket/);
		assert.doesNotMatch(
			greetingClient,
			/setInterval|requestAnimationFrame|animate-/,
		);
		assert.doesNotMatch(greetingAstro, /https?:\/\//);
	});
});

class FakeTimers {
	nextId = 1;
	readonly timers = new Map<number, () => void>();
	setTimeout(callback: () => void): number {
		const id = this.nextId++;
		this.timers.set(id, callback);
		return id;
	}
	clearTimeout(id: number): void {
		this.timers.delete(id);
	}
	triggerNext(): void {
		const entry = this.timers.entries().next().value as
			| [number, () => void]
			| undefined;
		if (!entry) return;
		this.timers.delete(entry[0]);
		entry[1]();
	}
}

class FakeMediaQuery extends EventTarget {
	matches = true;
}

class FakeHooks {
	readonly handlers = new Set<() => void>();
	onCalls = 0;
	offCalls = 0;
	on(_event: "visit:start", handler: () => void): undefined {
		this.onCalls += 1;
		this.handlers.add(handler);
		return undefined;
	}
	off(_event: "visit:start", handler: () => void): void {
		this.offCalls += 1;
		this.handlers.delete(handler);
	}
	emitVisitStart(): void {
		for (const handler of this.handlers) handler();
	}
}

function createLifecycleHarness() {
	const timers = new FakeTimers();
	const windowEvents = new EventTarget();
	const documentEvents = new EventTarget();
	const mediaQuery = new FakeMediaQuery();
	const hooks = new FakeHooks();
	let hidden = false;
	let refreshes = 0;
	const windowRef = Object.assign(windowEvents, {
		setTimeout: timers.setTimeout.bind(timers),
		clearTimeout: timers.clearTimeout.bind(timers),
		swup: { hooks },
	});
	const documentRef = Object.assign(documentEvents, {
		visibilityState: "visible" as DocumentVisibilityState,
	});
	const widget = {
		classList: { contains: (name: string) => name === "hidden" && hidden },
		getClientRects: () => ({ length: hidden ? 0 : 1 }),
	};
	const dispose = setupTimeGreetingLifecycle({
		windowRef: windowRef as never,
		documentRef: documentRef as never,
		widget: widget as never,
		mediaQuery,
		refresh: () => {
			refreshes += 1;
		},
	});
	return {
		dispose,
		timers,
		mediaQuery,
		windowEvents,
		documentEvents,
		hooks,
		setHidden: (nextHidden: boolean) => {
			hidden = nextHidden;
		},
		setVisibility: (value: DocumentVisibilityState) => {
			(
				documentRef as { visibilityState: DocumentVisibilityState }
			).visibilityState = value;
		},
		get refreshes() {
			return refreshes;
		},
	};
}

describe("时段问候生命周期", () => {
	test("只保留一个定时器，并在边界后继续安排下一个边界", () => {
		const harness = createLifecycleHarness();
		assert.equal(harness.timers.timers.size, 1);
		assert.equal(harness.refreshes, 1);
		harness.timers.triggerNext();
		assert.equal(harness.timers.timers.size, 1);
		assert.equal(harness.refreshes, 2);
		harness.dispose();
		assert.equal(harness.timers.timers.size, 0);
	});

	test("页面隐藏、断点变化、Swup 切页和销毁都会清理定时器", () => {
		const harness = createLifecycleHarness();
		harness.setVisibility("hidden");
		harness.documentEvents.dispatchEvent(new Event("visibilitychange"));
		assert.equal(harness.timers.timers.size, 0);
		harness.setVisibility("visible");
		harness.documentEvents.dispatchEvent(new Event("visibilitychange"));
		assert.equal(harness.timers.timers.size, 1);
		harness.mediaQuery.matches = false;
		harness.mediaQuery.dispatchEvent(new Event("change"));
		assert.equal(harness.timers.timers.size, 0);
		harness.mediaQuery.matches = true;
		harness.mediaQuery.dispatchEvent(new Event("change"));
		assert.equal(harness.timers.timers.size, 1);
		harness.setHidden(true);
		harness.documentEvents.dispatchEvent(new Event("astro:page-load"));
		assert.equal(harness.timers.timers.size, 0);
		harness.setHidden(false);
		harness.documentEvents.dispatchEvent(new Event("astro:page-load"));
		assert.equal(harness.timers.timers.size, 1);
		harness.hooks.emitVisitStart();
		assert.equal(harness.timers.timers.size, 0);
		harness.dispose();
		assert.equal(harness.timers.timers.size, 0);
		assert.equal(harness.hooks.offCalls, 1);
	});
});
