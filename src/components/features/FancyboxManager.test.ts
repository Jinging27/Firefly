import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { selectAll } from "css-select";
import { parseDocument } from "htmlparser2";
import {
	FANCYBOX_IMAGE_SELECTOR,
	FANCYBOX_LINK_SELECTOR,
} from "./fancybox-targets";

const managerSource = readFileSync(
	new URL("./FancyboxManager.astro", import.meta.url),
	"utf8",
);

type SelectorElement = {
	attribs: Record<string, string | undefined>;
};

test("全局 Fancybox 的生产选择器不会接管动态目标", () => {
	const document = parseDocument(`
		<div class="custom-md">
			<img id="article-image" src="/article.jpg">
			<div class="dynamic-content"><img id="dynamic-content-image" src="/dynamic.jpg"></div>
		</div>
		<dynamic-gallery>
			<img id="dynamic-gallery-image" src="/gallery.jpg">
			<button id="dynamic-gallery-lightbox" data-fancybox data-gallery-lightbox></button>
		</dynamic-gallery>
		<a id="article-link" data-fancybox href="/article.jpg"></a>
	`);
	const selectedIds = [
		...selectAll<unknown, SelectorElement>(FANCYBOX_IMAGE_SELECTOR, document),
		...selectAll<unknown, SelectorElement>(FANCYBOX_LINK_SELECTOR, document),
	]
		.map((element) => element.attribs.id)
		.sort();

	assert.deepEqual(selectedIds, ["article-image", "article-link"]);
	assert.match(managerSource, /from "\.\/fancybox-targets"/);
	assert.doesNotMatch(
		managerSource,
		/document\.addEventListener\("dynamic-gallery:ready", setup\)/,
	);
});
