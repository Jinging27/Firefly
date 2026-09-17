<script module lang="ts">
import type { TimeGreeting } from "@/utils/time-greeting";

export type { TimeGreeting };
</script>

<script lang="ts">
import { onMount } from "svelte";
import {
	getTimeGreeting,
	setupTimeGreetingLifecycle,
} from "@/utils/time-greeting";

let greeting = $state(getTimeGreeting());
let root: HTMLDivElement;

onMount(() => {
	const widget = root.closest<HTMLElement>(".time-greeting-widget");
	if (!widget) return;

	const refresh = () => {
		greeting = getTimeGreeting();
	};

	return setupTimeGreetingLifecycle({
		windowRef: window,
		documentRef: document,
		widget,
		mediaQuery: window.matchMedia("(min-width: 1280px)"),
		refresh,
	});
});
</script>

<div
	bind:this={root}
	class="time-greeting-content flex flex-col gap-2 rounded-xl border px-4 py-3 text-neutral-700 dark:text-neutral-200"
	data-time-greeting
	data-greeting-key={greeting.key}
>
	<div class="flex items-center gap-2">
		<span
			class="time-greeting-mark size-2 shrink-0 rounded-full bg-(--primary)"
			aria-hidden="true"
		></span>
		<span class="text-sm font-medium text-(--primary)">{greeting.label}</span>
	</div>
	<p class="m-0 text-sm leading-6">{greeting.text}</p>
</div>

<style>
	.time-greeting-content {
		border-color: color-mix(in srgb, var(--primary) 24%, transparent);
		background: color-mix(in srgb, var(--primary) 8%, var(--card-bg));
	}

	@media (prefers-reduced-motion: reduce) {
		.time-greeting-content {
			transition: none;
		}
	}
</style>
