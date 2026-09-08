import type { TimeProgressConfig } from "@/types/timeProgressConfig";

export const timeProgressConfig: TimeProgressConfig = Object.freeze({
	title: "时间进度",
	// 2026 年节假日安排以国务院官网公告为来源；组件仍会在运行时再次校验地址和年份覆盖范围。
	holidays: Object.freeze([
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
});
