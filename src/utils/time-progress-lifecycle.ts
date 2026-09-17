export type SwupVisitStartHandler = () => void;

type LifecycleEventTarget = Pick<
	EventTarget,
	"addEventListener" | "removeEventListener"
>;

export type TimeProgressLifecycleWindow = LifecycleEventTarget &
	Pick<
		Window,
		| "setInterval"
		| "clearInterval"
		| "setTimeout"
		| "clearTimeout"
		| "innerWidth"
		| "innerHeight"
	> &
	SwupWindow & {
		MutationObserver?: MutationObserverConstructor;
		IntersectionObserver?: IntersectionObserverConstructor;
	};

export type TimeProgressLifecycleDocument = LifecycleEventTarget &
	Pick<Document, "visibilityState">;

export type TimeProgressLifecycleWidget = Pick<
	HTMLElement,
	"classList" | "getClientRects" | "getBoundingClientRect"
>;

export type TimeProgressLifecycleMediaQuery = Pick<
	MediaQueryList,
	"matches" | "addEventListener" | "removeEventListener"
>;

export type TimeProgressLifecycleOptions = {
	windowRef: TimeProgressLifecycleWindow;
	documentRef: TimeProgressLifecycleDocument;
	widget: TimeProgressLifecycleWidget;
	mediaQuery: TimeProgressLifecycleMediaQuery;
	refresh: () => void;
	hasHolidayCountdown: () => boolean;
	MutationObserverCtor?: MutationObserverConstructor;
	IntersectionObserverCtor?: IntersectionObserverConstructor;
};

type MutationObserverConstructor = new (
	callback: MutationCallback,
) => MutationObserver;
type IntersectionObserverConstructor = new (
	callback: IntersectionObserverCallback,
) => IntersectionObserver;

type SwupHooks = {
	on(
		event: "visit:start",
		callback: SwupVisitStartHandler,
	): undefined | (() => void);
	off?(event: "visit:start", callback: SwupVisitStartHandler): void;
};

type SwupWindow = {
	swup?: { hooks?: SwupHooks };
};

type SwupDocument = Pick<Document, "addEventListener" | "removeEventListener">;

/**
 * 注册一次真实的 Swup `visit:start` hook。
 * Swup 晚于 Svelte 岛初始化时，等待项目实际派发的 `swup:enable` 事件。
 */
export function registerSwupVisitStart(
	windowRef: SwupWindow,
	documentRef: SwupDocument,
	handler: SwupVisitStartHandler,
): () => void {
	let disposed = false;
	let hooks: SwupHooks | undefined;
	let unregister: (() => void) | undefined;

	const register = () => {
		if (disposed || hooks) return;
		const candidate = windowRef.swup?.hooks;
		if (!candidate) return;
		hooks = candidate;
		const result = candidate.on("visit:start", handler);
		if (typeof result === "function") unregister = result;
		documentRef.removeEventListener("swup:enable", register);
	};

	register();
	if (!hooks) documentRef.addEventListener("swup:enable", register);

	return () => {
		if (disposed) return;
		disposed = true;
		documentRef.removeEventListener("swup:enable", register);
		if (unregister) unregister();
		else hooks?.off?.("visit:start", handler);
	};
}

function isWidgetInViewport(
	windowRef: Pick<Window, "innerWidth" | "innerHeight">,
	widget: TimeProgressLifecycleWidget,
): boolean {
	try {
		const rect = widget.getBoundingClientRect();
		return (
			rect.bottom > 0 &&
			rect.right > 0 &&
			rect.top < windowRef.innerHeight &&
			rect.left < windowRef.innerWidth
		);
	} catch {
		return false;
	}
}

/**
 * 协调时间进度组件的刷新与页面生命周期。旧浏览器没有 IntersectionObserver 时，
 * 使用视口几何检查和 scroll/resize 事件作为保守降级；无法判断视口时保持停止。
 */
export function setupTimeProgressLifecycle({
	windowRef,
	documentRef,
	widget,
	mediaQuery,
	refresh,
	hasHolidayCountdown,
	MutationObserverCtor = windowRef.MutationObserver,
	IntersectionObserverCtor = windowRef.IntersectionObserver,
}: TimeProgressLifecycleOptions): () => void {
	let timer: number | undefined;
	let timerMode: "interval" | "timeout" | undefined;
	let intersectsViewport = false;
	const supportsIntersectionObserver = Boolean(IntersectionObserverCtor);

	const isVisible = () =>
		mediaQuery.matches &&
		documentRef.visibilityState === "visible" &&
		intersectsViewport &&
		!widget.classList.contains("hidden") &&
		widget.getClientRects().length > 0;
	const stop = () => {
		if (timer === undefined) return;
		if (timerMode === "interval") windowRef.clearInterval(timer);
		else windowRef.clearTimeout(timer);
		timer = undefined;
		timerMode = undefined;
	};
	const schedule = () => {
		stop();
		if (!isVisible()) return;
		if (hasHolidayCountdown()) {
			timerMode = "interval";
			timer = windowRef.setInterval(() => {
				refresh();
				if (!hasHolidayCountdown()) schedule();
			}, getTimeProgressRefreshDelay(true));
		} else {
			timerMode = "timeout";
			const delay = getTimeProgressRefreshDelay(false);
			timer = windowRef.setTimeout(() => {
				refresh();
				schedule();
			}, delay);
		}
	};
	const start = () => {
		if (timer !== undefined || !isVisible()) return;
		refresh();
		schedule();
	};
	const syncTimer = () => {
		if (isVisible()) start();
		else stop();
	};

	const handleViewportChange = () => {
		if (!supportsIntersectionObserver) {
			intersectsViewport = isWidgetInViewport(windowRef, widget);
		}
		syncTimer();
	};
	const handleLayoutChange = supportsIntersectionObserver
		? syncTimer
		: handleViewportChange;
	const mutationObserver = MutationObserverCtor
		? new MutationObserverCtor(handleLayoutChange)
		: undefined;
	mutationObserver?.observe(widget as HTMLElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});

	const intersectionObserver = IntersectionObserverCtor
		? new IntersectionObserverCtor(([entry]) => {
				intersectsViewport = entry?.isIntersecting ?? false;
				syncTimer();
			})
		: undefined;
	if (intersectionObserver) intersectionObserver.observe(widget as HTMLElement);
	else {
		windowRef.addEventListener("scroll", handleViewportChange);
		windowRef.addEventListener("resize", handleViewportChange);
		handleViewportChange();
	}

	const handleMediaChange = () => syncTimer();
	const handleVisibilityChange = () => syncTimer();
	mediaQuery.addEventListener("change", handleMediaChange);
	documentRef.addEventListener("visibilitychange", handleVisibilityChange);
	documentRef.addEventListener("astro:page-load", handleLayoutChange);
	const swupVisitStart = () => stop();
	const unregisterSwup = registerSwupVisitStart(
		windowRef,
		documentRef,
		swupVisitStart,
	);
	if (intersectionObserver) syncTimer();

	return () => {
		stop();
		mutationObserver?.disconnect();
		intersectionObserver?.disconnect();
		if (!intersectionObserver) {
			windowRef.removeEventListener("scroll", handleViewportChange);
			windowRef.removeEventListener("resize", handleViewportChange);
		}
		mediaQuery.removeEventListener("change", handleMediaChange);
		documentRef.removeEventListener("visibilitychange", handleVisibilityChange);
		documentRef.removeEventListener("astro:page-load", handleLayoutChange);
		unregisterSwup();
	};
}

/** 无倒计时时只在下一分钟边界刷新，避免无意义的秒级唤醒。 */
export function getTimeProgressRefreshDelay(
	hasHolidayCountdown: boolean,
	now: number = Date.now(),
): number {
	if (hasHolidayCountdown) return 1000;
	const remainder = now % 60000;
	return remainder === 0 ? 60000 : 60000 - remainder;
}
