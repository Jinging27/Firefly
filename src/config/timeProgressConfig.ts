import type { TimeProgressConfig } from "@/types/timeProgressConfig";

export const timeProgressConfig: TimeProgressConfig = Object.freeze({
	title: "时间进度",
	// 2026 年节假日安排以国务院官网公告为来源；组件仍会在运行时再次校验地址和年份覆盖范围。
	holidays: Object.freeze([
		{
			name: "中秋节",
			date: "2026-09-25",
			source: "国务院办公厅关于2026年部分节假日安排的通知",
			sourceUrl:
				"https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
			verified: true,
			coverageYears: Object.freeze([2026]),
		},
		{
			name: "国庆节",
			date: "2026-10-01",
			source: "国务院办公厅关于2026年部分节假日安排的通知",
			sourceUrl:
				"https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm",
			verified: true,
			coverageYears: Object.freeze([2026]),
		},
	]),
	// 春节日期是本地审核的农历换算结果，不在浏览器端发起请求；每年更新前需重新核对。
	springFestivals: Object.freeze([
		{
			name: "春节",
			date: "2027-02-06",
			source: "农历春节日期（本地审核数据）",
			verified: true,
			coverageYears: Object.freeze([2027]),
			kind: "springFestival" as const,
		},
	]),
});
