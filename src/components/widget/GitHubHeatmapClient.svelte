<script module lang="ts">
import type {
	GitHubContributionData,
	GitHubHeatmapConfig,
	StorageLike,
} from "@/types/githubHeatmapConfig";
import { createGitHubHeatmapLoader } from "@/utils/github-heatmap";

let sharedLoader: {
	username: string;
	config: GitHubHeatmapConfig;
	load: () => Promise<GitHubContributionData | null>;
} | null = null;

function getSharedLoader(config: GitHubHeatmapConfig, username: string) {
	if (
		sharedLoader?.username === username &&
		sharedLoader.config.endpoint === config.endpoint &&
		sharedLoader.config.cacheKey === config.cacheKey &&
		sharedLoader.config.cacheTtlMs === config.cacheTtlMs &&
		sharedLoader.config.requestTimeoutMs === config.requestTimeoutMs &&
		sharedLoader.config.maxDays === config.maxDays
	)
		return sharedLoader.load;
	let storage: StorageLike | undefined;
	try {
		storage = window.localStorage;
	} catch {
		// 浏览器存储被禁用时仍允许本次会话请求一次。
	}
	const load = createGitHubHeatmapLoader(config, username, {
		storage,
		now: () => Date.now(),
		fetchImpl: window.fetch.bind(window),
	});
	sharedLoader = { username, config, load };
	return load;
}
</script>

<script lang="ts">
import { onMount } from "svelte";
import type {
	GitHubContributionData,
	GitHubHeatmapConfig,
} from "@/types/githubHeatmapConfig";
import { buildGitHubContributionWeeks } from "@/utils/github-heatmap";

interface Props {
	config: GitHubHeatmapConfig;
	username: string | null;
}

type State =
	| { status: "loading"; data: null }
	| { status: "ready"; data: GitHubContributionData }
	| { status: "empty"; data: null };

let { config, username }: Props = $props();
let state: State = $state({ status: "loading", data: null });
let weeks = $derived(state.data ? buildGitHubContributionWeeks(state.data) : []);

function formatDate(date: string): string {
	const [year, month, day] = date.split("-");
	return `${year}年${month}月${day}日`;
}

onMount(() => {
	if (!username) {
		state = { status: "empty", data: null };
		return;
	}
	let active = true;
	void getSharedLoader(config, username)().then((data) => {
		if (!active) return;
		state = data ? { status: "ready", data } : { status: "empty", data: null };
	});
	return () => {
		active = false;
	};
});
</script>

<div class="github-heatmap-content flex flex-col gap-2 py-1 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
	{#if state.status === "loading"}
		<p class="text-neutral-500 dark:text-neutral-400">正在加载贡献记录…</p>
	{:else if state.status === "ready"}
		<div class="flex items-center justify-between gap-2">
			<span>{state.data.total.toLocaleString("zh-CN")} 次贡献</span>
			<span class="text-xs text-neutral-500 dark:text-neutral-400">近一年</span>
		</div>
		<div
			class="github-heatmap-grid"
			role="grid"
			aria-label="GitHub 最近一年的贡献记录"
		>
			{#each weeks as week}
				<div class="github-heatmap-week" role="row">
					{#each week as day}
						<span
							class="github-heatmap-cell"
							data-level={day?.level ?? 0}
							role="gridcell"
							aria-label={day ? `${formatDate(day.date)}：${day.count} 次贡献` : "无记录日期"}
							aria-hidden={day ? undefined : "true"}
						></span>
					{/each}
				</div>
			{/each}
		</div>
		<div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
			<span>少</span>
			<div class="github-heatmap-legend" aria-hidden="true">
				{#each [0, 1, 2, 3, 4] as level}
					<span class="github-heatmap-cell" data-level={level}></span>
				{/each}
			</div>
			<span>多</span>
		</div>
	{:else}
		<p class="text-neutral-500 dark:text-neutral-400">暂时无法显示贡献记录</p>
	{/if}
</div>

<style>
	.github-heatmap-grid {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: 2px;
		min-height: 84px;
		overflow: hidden;
		width: 100%;
	}

	.github-heatmap-week {
		display: grid;
		grid-template-rows: repeat(7, minmax(0, 1fr));
		gap: 2px;
	}

	.github-heatmap-cell {
		width: 100%;
		min-width: 0;
		aspect-ratio: 1;
		border-radius: 2px;
		background: color-mix(in srgb, var(--primary) 10%, transparent);
	}

	.github-heatmap-cell[data-level="1"] {
		background: color-mix(in srgb, var(--primary) 30%, transparent);
	}

	.github-heatmap-cell[data-level="2"] {
		background: color-mix(in srgb, var(--primary) 50%, transparent);
	}

	.github-heatmap-cell[data-level="3"] {
		background: color-mix(in srgb, var(--primary) 70%, transparent);
	}

	.github-heatmap-cell[data-level="4"] {
		background: var(--primary);
	}

	.github-heatmap-legend {
		display: flex;
		align-items: center;
		gap: 3px;
	}

	.github-heatmap-legend .github-heatmap-cell {
		width: 10px;
		min-width: 10px;
		height: 10px;
	}
</style>
