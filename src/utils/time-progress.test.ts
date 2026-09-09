import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	getBeijingMonthProgress,
	getBeijingWeekProgress,
	getBeijingYearProgress,
	getNextHolidayCountdown,
	getNextSpringFestivalCountdown,
	hasOfficialHolidaySource,
} from "./time-progress";

const BEIJING_OFFSET = 8 * 60 * 60 * 1000;

function beijingDate(year: number, month: number, day: number, hour = 0): Date {
	return new Date(Date.UTC(year, month - 1, day, hour) - BEIJING_OFFSET);
}

describe("北京时间进度", () => {
	test("闰年首日与末日使用正确的年度总时长", () => {
		assert.equal(getBeijingYearProgress(beijingDate(2024, 1, 1)).percent, 0);
		assert.equal(
			getBeijingYearProgress(beijingDate(2024, 12, 31, 23)).percent,
			99.9,
		);
		assert.equal(getBeijingYearProgress(beijingDate(2025, 1, 1)).percent, 0);
	});

	test("月末使用该月的实际天数", () => {
		assert.equal(
			getBeijingMonthProgress(beijingDate(2024, 2, 29, 23)).percent,
			99.9,
		);
		assert.equal(
			getBeijingMonthProgress(beijingDate(2025, 2, 28, 23)).percent,
			99.9,
		);
	});

	test("周一和周日遵循周一开始的一周", () => {
		const monday = getBeijingWeekProgress(beijingDate(2026, 9, 7));
		assert.equal(monday.percent, 0);
		assert.equal(monday.currentDay, 1);
		const sunday = getBeijingWeekProgress(beijingDate(2026, 9, 13, 23));
		assert.equal(sunday.percent, 99.4);
		assert.equal(sunday.currentDay, 7);
	});

	test("北京时间午夜切换到新日期", () => {
		const beforeMidnight = new Date("2026-09-06T15:59:59.999Z");
		const atMidnight = new Date("2026-09-06T16:00:00.000Z");
		assert.equal(getBeijingMonthProgress(beforeMidnight).currentDay, 6);
		assert.equal(getBeijingMonthProgress(atMidnight).currentDay, 7);
	});
});

describe("节日倒计时", () => {
	test("优先选择当前年份距离最近的已核验公共节日", () => {
		const countdown = getNextHolidayCountdown(beijingDate(2026, 9, 9), [
			{
				name: "中秋节",
				date: "2026-09-25",
				source: "国务院办公厅关于2026年部分节假日安排的通知",
				sourceUrl:
					"https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
				verified: true,
				coverageYears: [2026],
			},
			{
				name: "国庆节",
				date: "2026-10-01",
				source: "国务院办公厅关于2026年部分节假日安排的通知",
				sourceUrl:
					"https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
				verified: true,
				coverageYears: [2026],
			},
		]);
		assert.equal(countdown?.holiday.name, "中秋节");
		assert.equal(countdown?.milliseconds, 16 * 24 * 60 * 60 * 1000);
	});

	test("只从覆盖当前年份的可审计数据中选择下一节日", () => {
		const countdown = getNextHolidayCountdown(beijingDate(2026, 9, 6), [
			{
				name: "国庆节",
				date: "2026-10-01",
				source: "国务院办公厅关于2026年部分节假日安排的通知",
				verified: true,
				sourceUrl: "https://www.gov.cn/",
				coverageYears: [2026],
			},
		]);
		assert.equal(countdown?.holiday.name, "国庆节");
		assert.equal(countdown?.milliseconds, 25 * 24 * 60 * 60 * 1000);
	});

	test("当前和下一年份数据不足时安全隐藏倒计时", () => {
		assert.equal(getNextHolidayCountdown(beijingDate(2026, 12, 31), []), null);
		assert.equal(
			getNextHolidayCountdown(beijingDate(2026, 12, 31), [
				{
					name: "元旦",
					date: "2027-01-01",
					source: "测试数据",
					verified: true,
					sourceUrl: "https://example.com/holiday",
					coverageYears: [2026],
				},
			]),
			null,
		);
		assert.equal(
			getNextHolidayCountdown(beijingDate(2026, 9, 6), [
				{
					name: "未核验节日",
					date: "2026-10-01",
					source: "待核验",
					verified: false,
					coverageYears: [2026],
				},
			]),
			null,
		);
	});

	test("只接受国务院官网白名单内的 HTTPS 来源", () => {
		const invalidSources = [
			"https://",
			"http://www.gov.cn/zhengce/",
			"https://example.com/holiday",
			"https://www.example.gov.cn/holiday",
			"https://gov.cn/holiday",
			"https://www.gov.cn:8443/holiday",
			"https://user:password@www.gov.cn/holiday",
			"not-a-url",
		];
		for (const sourceUrl of invalidSources) {
			assert.equal(
				getNextHolidayCountdown(beijingDate(2026, 9, 6), [
					{
						name: "无效来源节日",
						date: "2026-10-01",
						source: "测试来源",
						verified: true,
						sourceUrl,
						coverageYears: [2026],
					},
				]),
				null,
			);
		}
		assert.equal(
			hasOfficialHolidaySource({
				name: "国务院公告",
				date: "2026-10-01",
				source: "国务院办公厅公告",
				verified: true,
				sourceUrl:
					"https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
				coverageYears: [2026],
			}),
			true,
		);
	});

	test("春节使用本地审核日期，并与最近公共节日分开计算", () => {
		const springFestival = {
			name: "春节",
			date: "2027-02-06",
			source: "农历春节日期（本地审核数据）",
			verified: true,
			coverageYears: [2027],
			kind: "springFestival" as const,
		};
		assert.equal(
			getNextHolidayCountdown(beijingDate(2026, 9, 9), [springFestival]),
			null,
		);
		const countdown = getNextSpringFestivalCountdown(beijingDate(2026, 9, 9), [
			springFestival,
		]);
		assert.equal(countdown?.holiday.name, "春节");
		assert.equal(countdown?.milliseconds, 150 * 24 * 60 * 60 * 1000);
	});
});
