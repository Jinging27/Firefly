import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	getTimeProgressRefreshDelay,
	registerSwupVisitStart,
	setupTimeProgressLifecycle,
} from "./time-progress-lifecycle";

class FakeTimers {
	nextId = 1;
	readonly intervals = new Map<number, () => void>();
	readonly timeouts = new Map<number, () => void>();

	setInterval(callback: () => void): number {
		const id = this.nextId++;
		this.intervals.set(id, callback);
		return id;
	}

	clearInterval(id: number): void {
		this.intervals.delete(id);
	}

	setTimeout(callback: () => void): number {
		const id = this.nextId++;
		this.timeouts.set(id, callback);
		return id;
	}

	clearTimeout(id: number): void {
		this.timeouts.delete(id);
	}

	get activeCount(): number {
		return this.intervals.size + this.timeouts.size;
	}
}

class FakeMediaQuery extends EventTarget {
	matches = true;
}

class FakeMutationObserver {
	static latest: FakeMutationObserver | undefined;
	disconnected = false;
	private readonly callback: () => void;

	constructor(callback: MutationCallback) {
		this.callback = callback as unknown as () => void;
		FakeMutationObserver.latest = this;
	}

	observe(): void {}

	disconnect(): void {
		this.disconnected = true;
	}

	trigger(): void {
		this.callback();
	}
}

class FakeIntersectionObserver {
	static latest: FakeIntersectionObserver | undefined;
	disconnected = false;
	private readonly callback: IntersectionObserverCallback;

	constructor(callback: IntersectionObserverCallback) {
		this.callback = callback;
		FakeIntersectionObserver.latest = this;
	}

	observe(): void {}

	disconnect(): void {
		this.disconnected = true;
	}

	emit(isIntersecting: boolean): void {
		this.callback(
			[{ isIntersecting } as IntersectionObserverEntry],
			this as unknown as IntersectionObserver,
		);
	}
}

function createLifecycleHarness({
	withIntersectionObserver,
	initialRect = { top: 10, left: 10, right: 300, bottom: 300 },
}: {
	withIntersectionObserver: boolean;
	initialRect?: { top: number; left: number; right: number; bottom: number };
}) {
	const timers = new FakeTimers();
	const windowEvents = new EventTarget();
	const documentEvents = new EventTarget();
	const mediaQuery = new FakeMediaQuery();
	const swupHooks = new FakeHooks();
	let rect = initialRect;
	let hidden = false;
	let refreshes = 0;
	const windowRef = Object.assign(windowEvents, {
		innerWidth: 1280,
		innerHeight: 800,
		setInterval: timers.setInterval.bind(timers),
		clearInterval: timers.clearInterval.bind(timers),
		setTimeout: timers.setTimeout.bind(timers),
		clearTimeout: timers.clearTimeout.bind(timers),
		MutationObserver: FakeMutationObserver,
		swup: { hooks: swupHooks },
		...(withIntersectionObserver
			? { IntersectionObserver: FakeIntersectionObserver }
			: {}),
	});
	const documentRef = Object.assign(documentEvents, {
		visibilityState: "visible" as DocumentVisibilityState,
	});
	const widget = {
		classList: { contains: (name: string) => name === "hidden" && hidden },
		getClientRects: () => ({ length: hidden ? 0 : 1 }),
		getBoundingClientRect: () => rect,
	};

	const dispose = setupTimeProgressLifecycle({
		windowRef: windowRef as never,
		documentRef: documentRef as never,
		widget: widget as never,
		mediaQuery,
		refresh: () => {
			refreshes += 1;
		},
		hasHolidayCountdown: () => true,
		MutationObserverCtor: FakeMutationObserver as never,
		...(withIntersectionObserver
			? { IntersectionObserverCtor: FakeIntersectionObserver as never }
			: {}),
	});

	return {
		dispose,
		timers,
		mediaQuery,
		windowEvents,
		documentEvents,
		widget,
		setRect: (nextRect: typeof rect) => {
			rect = nextRect;
		},
		setHidden: (nextHidden: boolean) => {
			hidden = nextHidden;
		},
		setVisibility: (visibilityState: DocumentVisibilityState) => {
			(
				documentRef as { visibilityState: DocumentVisibilityState }
			).visibilityState = visibilityState;
		},
		swupHooks,
		get refreshes() {
			return refreshes;
		},
	};
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

	emitVisitStart() {
		for (const handler of this.handlers) handler();
	}
}

describe("时间进度 Swup 生命周期", () => {
	test("Swup 已初始化时只注册一次，并在清理后停止响应", () => {
		const documentRef = new EventTarget() as unknown as Document;
		const hooks = new FakeHooks();
		const windowRef = { swup: { hooks } };
		let calls = 0;
		const dispose = registerSwupVisitStart(windowRef, documentRef, () => {
			calls += 1;
		});

		assert.equal(hooks.onCalls, 1);
		hooks.emitVisitStart();
		assert.equal(calls, 1);
		dispose();
		dispose();
		hooks.emitVisitStart();
		assert.equal(calls, 1);
		assert.equal(hooks.offCalls, 1);
	});

	test("Swup 延迟启用时等待 swup:enable，重复事件不会重复注册", () => {
		const documentRef = new EventTarget() as unknown as Document;
		const windowRef: { swup?: { hooks?: FakeHooks } } = {};
		let calls = 0;
		const dispose = registerSwupVisitStart(windowRef, documentRef, () => {
			calls += 1;
		});

		assert.equal(windowRef.swup, undefined);
		const hooks = new FakeHooks();
		windowRef.swup = { hooks };
		documentRef.dispatchEvent(new Event("swup:enable"));
		documentRef.dispatchEvent(new Event("swup:enable"));
		assert.equal(hooks.onCalls, 1);
		hooks.emitVisitStart();
		assert.equal(calls, 1);
		dispose();
		assert.equal(hooks.offCalls, 1);
	});

	test("清理发生在 Swup 启用前时，不会留下延迟监听器", () => {
		const documentRef = new EventTarget() as unknown as Document;
		const windowRef: { swup?: { hooks?: FakeHooks } } = {};
		const dispose = registerSwupVisitStart(
			windowRef,
			documentRef,
			() => undefined,
		);
		dispose();
		const hooks = new FakeHooks();
		windowRef.swup = { hooks };
		documentRef.dispatchEvent(new Event("swup:enable"));
		assert.equal(hooks.onCalls, 0);
	});
});

describe("时间进度刷新频率", () => {
	test("有倒计时时每秒更新，无倒计时时对齐下一分钟边界", () => {
		assert.equal(getTimeProgressRefreshDelay(true, 12345), 1000);
		assert.equal(getTimeProgressRefreshDelay(false, 12345), 47655);
		assert.equal(getTimeProgressRefreshDelay(false, 60000), 60000);
	});
});

describe("时间进度客户端生命周期运行时行为", () => {
	test("IntersectionObserver 可用时，交叉、可见性、断点、隐藏和 Swup 都能启停定时器", () => {
		const harness = createLifecycleHarness({ withIntersectionObserver: true });
		assert.equal(harness.timers.activeCount, 0);
		assert.equal(harness.refreshes, 0);

		FakeIntersectionObserver.latest?.emit(true);
		assert.equal(harness.timers.activeCount, 1);
		assert.equal(harness.refreshes, 1);

		FakeIntersectionObserver.latest?.emit(false);
		assert.equal(harness.timers.activeCount, 0);
		harness.mediaQuery.matches = false;
		harness.mediaQuery.dispatchEvent(new Event("change"));
		FakeIntersectionObserver.latest?.emit(true);
		assert.equal(harness.timers.activeCount, 0);

		harness.mediaQuery.matches = true;
		harness.mediaQuery.dispatchEvent(new Event("change"));
		assert.equal(harness.timers.activeCount, 1);
		harness.setHidden(true);
		FakeMutationObserver.latest?.trigger();
		assert.equal(harness.timers.activeCount, 0);
		harness.setHidden(false);
		FakeMutationObserver.latest?.trigger();
		assert.equal(harness.timers.activeCount, 1);

		harness.setVisibility("hidden");
		(harness.documentEvents as EventTarget).dispatchEvent(
			new Event("visibilitychange"),
		);
		assert.equal(harness.timers.activeCount, 0);
		harness.setVisibility("visible");
		(harness.documentEvents as EventTarget).dispatchEvent(
			new Event("visibilitychange"),
		);
		assert.equal(harness.timers.activeCount, 1);
		harness.swupHooks.emitVisitStart();
		assert.equal(harness.timers.activeCount, 0);
		(harness.documentEvents as EventTarget).dispatchEvent(
			new Event("astro:page-load"),
		);
		assert.equal(harness.timers.activeCount, 1);
		harness.dispose();
		assert.equal(harness.timers.activeCount, 0);
		assert.equal(FakeMutationObserver.latest?.disconnected, true);
		assert.equal(FakeIntersectionObserver.latest?.disconnected, true);
	});

	test("不支持 IntersectionObserver 时，滚出视口会停止，回到视口会恢复", () => {
		const harness = createLifecycleHarness({ withIntersectionObserver: false });
		assert.equal(harness.timers.activeCount, 1);
		assert.equal(harness.refreshes, 1);

		harness.setRect({ top: -500, left: 10, right: 300, bottom: -100 });
		harness.windowEvents.dispatchEvent(new Event("scroll"));
		assert.equal(harness.timers.activeCount, 0);

		harness.setRect({ top: 100, left: 10, right: 300, bottom: 400 });
		harness.windowEvents.dispatchEvent(new Event("resize"));
		assert.equal(harness.timers.activeCount, 1);
		assert.equal(harness.refreshes, 2);

		harness.dispose();
		assert.equal(harness.timers.activeCount, 0);
	});

	test("不支持 IntersectionObserver 时，页面加载和布局变化会重新计算视口", () => {
		const harness = createLifecycleHarness({ withIntersectionObserver: false });
		assert.equal(harness.timers.activeCount, 1);

		harness.setRect({ top: -500, left: 10, right: 300, bottom: -100 });
		harness.documentEvents.dispatchEvent(new Event("astro:page-load"));
		assert.equal(harness.timers.activeCount, 0);

		harness.setRect({ top: 100, left: 10, right: 300, bottom: 400 });
		FakeMutationObserver.latest?.trigger();
		assert.equal(harness.timers.activeCount, 1);

		harness.setRect({ top: -500, left: 10, right: 300, bottom: -100 });
		FakeMutationObserver.latest?.trigger();
		assert.equal(harness.timers.activeCount, 0);

		harness.setRect({ top: 100, left: 10, right: 300, bottom: 400 });
		harness.documentEvents.dispatchEvent(new Event("astro:page-load"));
		assert.equal(harness.timers.activeCount, 1);

		harness.dispose();
	});
});
