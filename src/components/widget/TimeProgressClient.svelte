<script module lang="ts">
import type { Holiday } from "@/types/timeProgressConfig";

export type InitialTimeProgress = {
	year: { currentDay: number; percent: number };
	month: { currentDay: number; percent: number };
	week: { currentDay: number; percent: number };
	holiday: { holiday: Holiday; milliseconds: number } | null;
};

function formatDurationValue(milliseconds: number): string {
	const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${days}天 ${String(hours).padStart(2, "0")}时 ${String(minutes).padStart(2, "0")}分 ${String(seconds).padStart(2, "0")}秒`;
}
</script>

<script lang="ts">
import { onMount } from "svelte";
import type { Holiday } from "@/types/timeProgressConfig";
import { getBeijingMonthProgress, getBeijingWeekProgress, getBeijingYearProgress, getNextHolidayCountdown } from "@/utils/time-progress";
import {
	setupTimeProgressLifecycle,
} from "@/utils/time-progress-lifecycle";
import type { InitialTimeProgress } from "./TimeProgressClient.svelte";

interface Props {
	initial: InitialTimeProgress;
	holidays: readonly Holiday[];
}

let { initial, holidays }: Props = $props();
let state = $state(initial);
let root: HTMLDivElement;

onMount(() => {
	const widget = root.closest<HTMLElement>(".time-progress-widget");
	if (!widget) return;

	const refresh = () => {
		const now = new Date();
		state = {
			year: getBeijingYearProgress(now),
			month: getBeijingMonthProgress(now),
			week: getBeijingWeekProgress(now),
			holiday: getNextHolidayCountdown(now, holidays),
		};
	};
	const mediaQuery = window.matchMedia("(min-width: 1280px)");
	return setupTimeProgressLifecycle({
		windowRef: window,
		documentRef: document,
		widget,
		mediaQuery,
		refresh,
		hasHolidayCountdown: () => state.holiday !== null,
	});
});
</script>

<div bind:this={root} class="flex flex-col gap-2 py-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200" data-time-progress>
	<div class="flex items-center justify-between"><span>年度</span><span>{state.year.percent.toFixed(1)}%</span></div>
	<div class="h-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-label="年度进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={state.year.percent}><div class="h-full bg-(--primary)" style={`width: ${state.year.percent}%`}></div></div>
	<div class="flex items-center justify-between"><span>本月</span><span>{state.month.percent.toFixed(1)}%</span></div>
	<div class="h-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-label="本月进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={state.month.percent}><div class="h-full bg-(--primary)" style={`width: ${state.month.percent}%`}></div></div>
	<div class="flex items-center justify-between"><span>本周</span><span>{state.week.percent.toFixed(1)}%</span></div>
	<div class="h-1 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-700" role="progressbar" aria-label="本周进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={state.week.percent}><div class="h-full bg-(--primary)" style={`width: ${state.week.percent}%`}></div></div>
	{#if state.holiday}
		<div class="mt-1 border-t border-neutral-200 pt-2 text-xs dark:border-neutral-700">
			<div class="sr-only">节日数据来源：{state.holiday.holiday.source}</div>
			<div class="flex items-center justify-between"><span>距{state.holiday.holiday.name}</span><span>{formatDurationValue(state.holiday.milliseconds)}</span></div>
		</div>
	{/if}
</div>
