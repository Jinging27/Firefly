import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import {
	createFancyboxLoader,
	openDynamicGalleryLightbox,
} from "./dynamic-gallery";

const gallerySource = readFileSync(
	new URL("./dynamic-gallery.ts", import.meta.url),
	"utf8",
);

function findTopLevelStaticFancyboxImports(source: string): ts.Statement[] {
	const file = ts.createSourceFile(
		"dynamic-gallery.ts",
		source,
		ts.ScriptTarget.Latest,
		true,
	);
	return file.statements.filter((statement) => {
		if (ts.isImportDeclaration(statement)) {
			return (
				ts.isStringLiteral(statement.moduleSpecifier) &&
				statement.moduleSpecifier.text === "@fancyapps/ui"
			);
		}
		if (ts.isImportEqualsDeclaration(statement)) {
			return (
				ts.isExternalModuleReference(statement.moduleReference) &&
				ts.isStringLiteral(statement.moduleReference.expression) &&
				statement.moduleReference.expression.text === "@fancyapps/ui"
			);
		}
		if (ts.isVariableStatement(statement)) {
			return statement.declarationList.declarations.some(
				(declaration) =>
					declaration.initializer !== undefined &&
					containsTopLevelFancyboxRequire(declaration.initializer),
			);
		}
		return (
			ts.isExpressionStatement(statement) &&
			containsTopLevelFancyboxRequire(statement.expression)
		);
	});
}

function containsTopLevelFancyboxRequire(node: ts.Node): boolean {
	if (ts.isFunctionLike(node)) return false;
	if (
		ts.isCallExpression(node) &&
		ts.isIdentifier(node.expression) &&
		node.expression.text === "require" &&
		node.arguments.length === 1 &&
		ts.isStringLiteral(node.arguments[0]) &&
		node.arguments[0].text === "@fancyapps/ui"
	)
		return true;
	return ts.forEachChild(node, containsTopLevelFancyboxRequire) ?? false;
}

test("动态列表不把 Fancybox 静态依赖作为水合前置条件", () => {
	assert.deepEqual(findTopLevelStaticFancyboxImports(gallerySource), []);
	assert.equal(
		findTopLevelStaticFancyboxImports('import Fancybox from "@fancyapps/ui";')
			.length,
		1,
	);
	assert.equal(
		findTopLevelStaticFancyboxImports(
			'import { Fancybox } from "@fancyapps/ui";',
		).length,
		1,
	);
	assert.equal(
		findTopLevelStaticFancyboxImports(
			'import * as FancyboxModule from "@fancyapps/ui";',
		).length,
		1,
	);
	assert.equal(
		findTopLevelStaticFancyboxImports(
			'import FancyboxModule = require("@fancyapps/ui");',
		).length,
		1,
	);
	assert.equal(
		findTopLevelStaticFancyboxImports(
			'const Fancybox = require("@fancyapps/ui").Fancybox;',
		).length,
		1,
	);
	assert.equal(
		findTopLevelStaticFancyboxImports('require("@fancyapps/ui");').length,
		1,
	);
	assert.deepEqual(
		findTopLevelStaticFancyboxImports(
			'async function load() { return import("@fancyapps/ui"); }',
		),
		[],
	);
});

test("动态画廊的灯箱入口仍保留异步加载", () => {
	assert.match(gallerySource, /loadFancybox/);
	assert.match(gallerySource, /Fancybox\.show/);
});

test("Fancybox 导入失败后会清除缓存，使下一次点击可重新加载", async () => {
	let attempts = 0;
	const fancybox = { show: () => undefined };
	const loadFancybox = createFancyboxLoader(async () => {
		attempts += 1;
		if (attempts === 1) throw new Error("temporary import failure");
		return fancybox;
	});

	const firstAttempt = loadFancybox();
	assert.equal(loadFancybox(), firstAttempt);
	await assert.rejects(firstAttempt, /temporary import failure/);
	assert.equal(attempts, 1);
	assert.equal(await loadFancybox(), fancybox);
	assert.equal(attempts, 2);
});

test("灯箱加载失败只记录错误，不让点击处理返回 rejected Promise", async () => {
	const errors: unknown[] = [];
	const result = await openDynamicGalleryLightbox(
		async () => {
			throw new Error("temporary import failure");
		},
		[{ alt: "示例图片", src: "/example.jpg" }],
		0,
		(error) => errors.push(error),
	);

	assert.equal(result, undefined);
	assert.equal(errors.length, 1);
	assert.match(String(errors[0]), /temporary import failure/);
});
