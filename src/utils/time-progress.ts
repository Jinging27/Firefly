import type { Holiday } from "@/types/timeProgressConfig";

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const OFFICIAL_HOLIDAY_SOURCE_HOSTS = new Set(["www.gov.cn"]);

export type TimeProgress = {
	currentDay: number;
	percent: number;
};

export type HolidayCountdown = {
	holiday: Holiday;
	milliseconds: number;
};

function toBeijingTimestamp(date: Date): number {
	return date.getTime() + BEIJING_OFFSET_MS;
}

function getBeijingParts(date: Date) {
	const beijingDate = new Date(toBeijingTimestamp(date));
	return {
		year: beijingDate.getUTCFullYear(),
		month: beijingDate.getUTCMonth(),
		day: beijingDate.getUTCDate(),
		weekday: beijingDate.getUTCDay(),
	};
}

function toBeijingMidnight(year: number, month: number, day: number): number {
	return Date.UTC(year, month, day) - BEIJING_OFFSET_MS;
}

function getProgress(
	date: Date,
	start: number,
	end: number,
	currentDay: number,
): TimeProgress {
	const ratio = Math.min(
		1,
		Math.max(0, (date.getTime() - start) / (end - start)),
	);
	const percent =
		ratio >= 1 ? 100 : Math.min(99.9, Number((ratio * 100).toFixed(1)));
	return {
		currentDay,
		percent,
	};
}

export function getBeijingYearProgress(date: Date = new Date()): TimeProgress {
	const { year, day } = getBeijingParts(date);
	return getProgress(
		date,
		toBeijingMidnight(year, 0, 1),
		toBeijingMidnight(year + 1, 0, 1),
		day,
	);
}

export function getBeijingMonthProgress(date: Date = new Date()): TimeProgress {
	const { year, month, day } = getBeijingParts(date);
	return getProgress(
		date,
		toBeijingMidnight(year, month, 1),
		toBeijingMidnight(year, month + 1, 1),
		day,
	);
}

export function getBeijingWeekProgress(date: Date = new Date()): TimeProgress {
	const { year, month, day, weekday } = getBeijingParts(date);
	const daysFromMonday = (weekday + 6) % 7;
	const currentMidnight = toBeijingMidnight(year, month, day);
	const weekStart = currentMidnight - daysFromMonday * DAY_MS;
	return getProgress(
		date,
		weekStart,
		weekStart + 7 * DAY_MS,
		daysFromMonday + 1,
	);
}

function parseHolidayDate(date: string): number | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	const [year, month, day] = date.split("-").map(Number);
	const timestamp = toBeijingMidnight(year, month - 1, day);
	const parsed = new Date(timestamp + BEIJING_OFFSET_MS);
	if (
		parsed.getUTCFullYear() !== year ||
		parsed.getUTCMonth() !== month - 1 ||
		parsed.getUTCDate() !== day
	) {
		return null;
	}
	return timestamp;
}

export function hasOfficialHolidaySource(holiday: Holiday): boolean {
	if (holiday.verified !== true || typeof holiday.sourceUrl !== "string")
		return false;
	try {
		const url = new URL(holiday.sourceUrl);
		return (
			url.protocol === "https:" &&
			url.port === "" &&
			url.username === "" &&
			url.password === "" &&
			OFFICIAL_HOLIDAY_SOURCE_HOSTS.has(url.hostname.toLowerCase())
		);
	} catch {
		return false;
	}
}

export function getNextHolidayCountdown(
	now: Date = new Date(),
	holidays: readonly Holiday[] = [],
): HolidayCountdown | null {
	const { year } = getBeijingParts(now);
	const candidates = holidays
		.filter(
			(holiday) =>
				hasOfficialHolidaySource(holiday) &&
				(holiday.coverageYears.includes(year) ||
					holiday.coverageYears.includes(year + 1)),
		)
		.map((holiday) => ({ holiday, timestamp: parseHolidayDate(holiday.date) }))
		.filter(
			(candidate): candidate is { holiday: Holiday; timestamp: number } =>
				candidate.timestamp !== null,
		)
		.filter((candidate) => candidate.timestamp >= now.getTime())
		.filter((candidate) =>
			candidate.holiday.coverageYears.includes(
				new Date(candidate.timestamp + BEIJING_OFFSET_MS).getUTCFullYear(),
			),
		)
		.sort((left, right) => left.timestamp - right.timestamp);
	const next = candidates[0];
	return next
		? { holiday: next.holiday, milliseconds: next.timestamp - now.getTime() }
		: null;
}
