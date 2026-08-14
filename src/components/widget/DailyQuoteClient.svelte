<script module lang="ts">
import type { DailyQuote, DailyQuoteConfig, StorageLike } from "@/types/config";
import { createDailyQuoteLoader } from "@/utils/daily-quote";

let sharedLoader: (() => Promise<DailyQuote | null>) | null = null;

function getSharedLoader(config: DailyQuoteConfig) {
	if (sharedLoader) return sharedLoader;
	let storage: StorageLike | null = null;
	try {
		storage = window.localStorage;
	} catch {
		// localStorage 不可用时仍允许本次会话请求一次。
	}
	sharedLoader = createDailyQuoteLoader(config, {
		storage,
		now: Date.now,
		fetch: window.fetch.bind(window),
		setTimeout: (callback, ms) => window.setTimeout(callback, ms),
		clearTimeout: (handle) => window.clearTimeout(handle as number),
	});
	return sharedLoader;
}
</script>

<script lang="ts">
import { onMount } from "svelte";

interface Props {
	config: DailyQuoteConfig;
}

let { config }: Props = $props();
let quote: DailyQuote = $state(config.fallback);

onMount(() => {
	let active = true;
	void getSharedLoader(config)().then((loadedQuote) => {
		if (active && loadedQuote) quote = loadedQuote;
	});
	return () => {
		active = false;
	};
});
</script>

<div class="flex min-h-24 flex-col justify-center gap-2 py-1">
	<p class="daily-quote-text text-base leading-7 text-neutral-700 dark:text-neutral-200">
		{quote.text}
	</p>
	<p
		class:invisible={!quote.source && !quote.author}
		aria-hidden={!quote.source && !quote.author ? "true" : undefined}
		class="daily-quote-attribution text-sm leading-6 text-neutral-500 dark:text-neutral-400"
	>
			— {quote.source ?? quote.author}{quote.source && quote.author ? ` · ${quote.author}` : ""}
	</p>
</div>
