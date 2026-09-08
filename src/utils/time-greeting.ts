import { registerSwupVisitStart } from "./time-progress-lifecycle";

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1_000;
const MINUTE_MS = 60 * 1_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const FALLBACK_DELAY_MS = 60 * 1_000;

export type TimeGreeting = {
	key: "night" | "morning" | "forenoon" | "noon" | "afternoon" | "evening";
	startHour: number;
	label: string;
	text: string;
};

export type TimeGreetingLifecycleWindow = EventTarget &
	Pick<Window, "setTimeout" | "clearTimeout"> & {
		swup?: {
			hooks?: {
				on(
					event: "visit:start",
					callback: () => void,
				): undefined | (() => void);
				off?(event: "visit:start", callback: () => void): void;
			};
		};
	};

export type TimeGreetingLifecycleDocument = EventTarget &
	Pick<Document, "visibilityState">;

export type TimeGreetingLifecycleWidget = Pick<
	HTMLElement,
	"classList" | "getClientRects"
>;

export type TimeGreetingLifecycleMediaQuery = Pick<
	MediaQueryList,
	"matches" | "addEventListener" | "removeEventListener"
>;

export type TimeGreetingLifecycleOptions = {
	windowRef: TimeGreetingLifecycleWindow;
	documentRef: TimeGreetingLifecycleDocument;
	widget: TimeGreetingLifecycleWidget;
	mediaQuery: TimeGreetingLifecycleMediaQuery;
	refresh: () => void;
};

const GREETINGS: readonly TimeGreeting[] = [
	{
		key: "night",
		startHour: 0,
		label: "夜深",
		text: "夜深了，愿你安稳入梦。",
	},
	{
		key: "morning",
		startHour: 6,
		label: "清晨",
		text: "早上好，愿你从容启程。",
	},
	{
		key: "forenoon",
		startHour: 9,
		label: "上午",
		text: "上午好，专注当下，稳步向前。",
	},
	{
		key: "noon",
		startHour: 12,
		label: "午间",
		text: "中午好，记得稍作休息。",
	},
	{
		key: "afternoon",
		startHour: 14,
		label: "下午",
		text: "下午好，继续保持自己的节奏。",
	},
	{
		key: "evening",
		startHour: 18,
		label: "傍晚",
		text: "晚上好，今天也辛苦了。",
	},
];

function getBeijingDayMilliseconds(date: Date): number | null {
	const timestamp = date.getTime();
	if (!Number.isFinite(timestamp)) return null;
	const beijingDate = new Date(timestamp + BEIJING_OFFSET_MS);
	return (
		beijingDate.getUTCHours() * 60 * MINUTE_MS +
		beijingDate.getUTCMinutes() * MINUTE_MS +
		beijingDate.getUTCSeconds() * 1_000 +
		beijingDate.getUTCMilliseconds()
	);
}

/** 根据固定的北京时间解析当前时段，不读取访客本地时区。 */
export function getTimeGreeting(date: Date = new Date()): TimeGreeting {
	const dayMilliseconds = getBeijingDayMilliseconds(date);
	if (dayMilliseconds === null) {
		return {
			key: "night",
			startHour: 0,
			label: "此刻",
			text: "愿你此刻安好。",
		};
	}

	const hour = Math.floor(dayMilliseconds / (60 * MINUTE_MS));
	return (
		[...GREETINGS].reverse().find((greeting) => hour >= greeting.startHour) ??
		GREETINGS[0]
	);
}

export function getTimeGreetingBoundaries(): readonly number[] {
	return GREETINGS.map((greeting) => greeting.startHour);
}

/** 返回到下一个北京时间时段边界的毫秒数，始终为正数。 */
export function getTimeGreetingRefreshDelay(date: Date = new Date()): number {
	const dayMilliseconds = getBeijingDayMilliseconds(date);
	if (dayMilliseconds === null) return FALLBACK_DELAY_MS;

	const boundaryMilliseconds = GREETINGS.map(
		(greeting) => greeting.startHour * 60 * MINUTE_MS,
	);
	const nextBoundary =
		boundaryMilliseconds.find((boundary) => boundary > dayMilliseconds) ??
		DAY_MS + boundaryMilliseconds[0];
	const delay = nextBoundary - dayMilliseconds;
	return delay > 0 && delay <= DAY_MS ? delay : FALLBACK_DELAY_MS;
}

function isWidgetEligible(
	documentRef: TimeGreetingLifecycleDocument,
	widget: TimeGreetingLifecycleWidget,
	mediaQuery: TimeGreetingLifecycleMediaQuery,
): boolean {
	return (
		mediaQuery.matches &&
		documentRef.visibilityState === "visible" &&
		!widget.classList.contains("hidden") &&
		widget.getClientRects().length > 0
	);
}

/** 管理时段问候的单一定时器，并在页面生命周期变化时安全清理。 */
export function setupTimeGreetingLifecycle({
	windowRef,
	documentRef,
	widget,
	mediaQuery,
	refresh,
}: TimeGreetingLifecycleOptions): () => void {
	let timer: number | undefined;

	const stop = () => {
		if (timer === undefined) return;
		windowRef.clearTimeout(timer);
		timer = undefined;
	};

	const schedule = () => {
		stop();
		if (!isWidgetEligible(documentRef, widget, mediaQuery)) return;
		timer = windowRef.setTimeout(() => {
			timer = undefined;
			if (!isWidgetEligible(documentRef, widget, mediaQuery)) return;
			refresh();
			schedule();
		}, getTimeGreetingRefreshDelay());
	};

	const sync = () => {
		if (!isWidgetEligible(documentRef, widget, mediaQuery)) {
			stop();
			return;
		}
		if (timer === undefined) {
			refresh();
			schedule();
		}
	};

	const handleVisibilityChange = () => sync();
	const handleMediaChange = () => sync();
	const handlePageLoad = () => sync();
	const handleSwupVisitStart = () => stop();

	documentRef.addEventListener("visibilitychange", handleVisibilityChange);
	documentRef.addEventListener("astro:page-load", handlePageLoad);
	mediaQuery.addEventListener("change", handleMediaChange);
	const unregisterSwup = registerSwupVisitStart(
		windowRef,
		documentRef,
		handleSwupVisitStart,
	);
	sync();

	return () => {
		stop();
		documentRef.removeEventListener("visibilitychange", handleVisibilityChange);
		documentRef.removeEventListener("astro:page-load", handlePageLoad);
		mediaQuery.removeEventListener("change", handleMediaChange);
		unregisterSwup();
	};
}
