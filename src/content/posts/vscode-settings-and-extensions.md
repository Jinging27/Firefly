---
title: VS Code 使用体验优化：我的设置与插件清单
published: 2026-08-10
description: "整理一份自己在用的 VS Code 配置与插件，附上每一项的取舍理由。"
image: ""
tags: [VSCode, 工具链, 效率]
category: "建站记录"
slug: vscode-settings-and-extensions
---

VS Code 开箱可用，但默认配置相当保守——不少体验明显更好的选项默认是关闭的。这篇整理一下我实际在用的设置和插件，重点写清楚每一项**为什么**开，以及哪些看着诱人实际会拖后腿。

参考了 CSDN 上 [一篇 VS Code 优化文](https://blog.csdn.net/qq_51173321/article/details/126287293)，但我按自己的技术栈（前端 / Astro / TypeScript / 嵌入式）做了增删。

## 设置

打开方式：`Ctrl + Shift + P` → 输入 `Preferences: Open User Settings (JSON)`。

### 文件与保存

```json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000,
  "files.autoGuessEncoding": true,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
```

`autoSave` 配合热更新（HMR）非常顺手，改完抬手就能看到浏览器刷新。但有个坑要提前说：**开了自动保存后，`editor.formatOnSave` 会跟着频繁触发**。如果格式化工具配置有问题，光标会在你打字过程中被格式化打乱。所以这两项要么一起配好，要么都别开。

`autoGuessEncoding` 对中文用户实用——接手别人的 GBK 文件时不至于开出一屏乱码。

后两项是提交礼仪层面的：去掉行尾空格、文件末尾留一个换行，能省掉大量无意义的 diff 噪音。

### 编辑器

```json
{
  "editor.formatOnSave": true,
  "editor.formatOnPaste": true,
  "editor.wordWrap": "on",
  "editor.guides.bracketPairs": true,
  "editor.stickyScroll.enabled": true,
  "editor.linkedEditing": true,
  "editor.suggestSelection": "recentlyUsed",
  "editor.acceptSuggestionOnEnter": "smart"
}
```

`stickyScroll` 是我觉得最被低估的一个。往下滚长文件时，当前所在的函数名、类名会钉在编辑器顶部，不用再反复往上翻找"我现在在哪个函数里"。

`linkedEditing` 写 HTML/JSX 时改开标签，闭标签自动同步，不用再手动改两遍。

`formatOnType` 我**没有**开。它会在你还没写完一行时就介入调整，反而打断思路，`formatOnSave` 已经够用。

### 视觉与动效

```json
{
  "editor.smoothScrolling": true,
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.cursorBlinking": "smooth",
  "workbench.list.smoothScrolling": true,
  "editor.mouseWheelZoom": true
}
```

纯体感项，不影响功能。`mouseWheelZoom` 是 `Ctrl + 滚轮` 缩放字号，演示或投屏时很方便。

> [!TIP] 关于动效
> 这些平滑动画在低配机器或远程开发（Remote SSH）场景下会让人感觉"发飘"甚至掉帧。如果你的 VS Code 本来就不快，第一个该关的就是这几项。

### 终端与其他

```json
{
  "terminal.integrated.defaultProfile.windows": "Git Bash",
  "terminal.integrated.cursorBlinking": true,
  "window.dialogStyle": "custom",
  "debug.showBreakpointsInOverviewRuler": true,
  "explorer.compactFolders": false
}
```

`explorer.compactFolders: false` 值得单独说。VS Code 默认会把只有一个子目录的层级压缩成 `a / b / c` 一行显示，看着简洁，但点击时容易点错层级。关掉之后目录树回归常规展开方式。

Windows 上我把默认终端设成 Git Bash，因为大部分构建脚本和 Unix 命令都能直接用，不必在 PowerShell 语法和 POSIX 语法之间来回切换。

## 插件

插件不是越多越好——每个插件都要吃启动时间和内存。下面按"我是否真的每天在用"来分类。

### 基础必备

| 插件 | 作用 | 备注 |
|---|---|---|
| Chinese (Simplified) | 官方简体中文语言包 | 装完需重启 |
| Error Lens | 把报错内联显示在出错那一行右侧 | 见下方说明 |
| Path Intellisense | 输入路径时自动补全 | 支持项目里的路径别名 |
| Image Preview | 悬停预览引用的图片 | 排查图片路径写错很快 |
| GitLens | 行级 Git 责任人与历史 | 功能多，建议关掉部分侧栏视图 |

**Error Lens** 是这批里最改变习惯的一个。它把原本要悬停才看到的错误信息直接贴在代码行末尾，红色高亮，无法忽略。副作用是屏幕会变得很吵——如果你在改一个类型错误很多的老项目，满屏红字会让人焦虑。它支持配置只显示 error 级别、忽略 warning：

```json
{
  "errorLens.enabledDiagnosticLevels": ["error"]
}
```

### 格式化与代码质量

我用的是 **Biome**，而不是原文推荐的 Prettier + ESLint 组合。这个博客项目本身就用 Biome（见 `biome.json`），格式化和 lint 一个工具搞定，速度是 Prettier 的数倍。

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

如果项目已经用了 Prettier，就别硬换——两个格式化工具同时装在一个项目上，保存时会互相打架，产生反复变动的 diff。**跟着项目的既有选择走**，比用自己偏好的工具重要。

### 前端相关

- **Astro** — 官方插件，`.astro` 文件的语法高亮与类型提示，写这个博客的必需品
- **Svelte for VS Code** — 同上，Svelte 组件支持
- **Tailwind CSS IntelliSense** — 类名补全和悬停展开实际 CSS，Tailwind 项目必装
- **Auto Rename Tag** — 如果你没开上面的 `editor.linkedEditing`，用这个插件替代

### 按需安装

- **CodeSnap** — 生成代码截图，写文章或做分享时用
- **Remote - SSH** — 连远程服务器或虚拟机开发，嵌入式和服务器调试离不开
- **Hex Editor** — 查看文件的十六进制内容，排查编码问题或看二进制格式时有用
- **Code Runner** — 单文件快速运行，刷算法题方便。语言运行环境需自己装好

Code Runner 建议改一下默认行为，让它在集成终端里跑而不是只输出到"输出"面板（后者不能交互输入）：

```json
{
  "code-runner.runInTerminal": true,
  "code-runner.saveFileBeforeRun": true
}
```

### 不推荐的

**背景模糊类插件**（Vibrancy Continued 等）。原理是改写 VS Code 的安装文件，会带来三个问题：VS Code 每次更新后失效需要重装、启动时会弹"安装已损坏"警告、性能开销明显。想要视觉效果，换个好看的主题成本低得多。

**各种 AI 补全插件同时装多个**。它们会同时抢占补全弹窗，结果是两家的建议交替闪现，一个都用不利索。选一个就好。

## 主题

主题这事纯个人偏好，列几个我轮换着用的：

- **One Dark Pro** — 经久耐用的暗色主题，对比度适中不刺眼
- **GitHub Theme** — GitHub 官方，亮暗都有，适合截图给别人看（观感熟悉）
- **Material Icon Theme** — 图标主题，文件类型覆盖全，目录图标会按名称变化

配色之外，字体也值得一提。开了连字（ligature）的等宽字体会把 `=>`、`!==` 渲染成单个符号，代码更紧凑：

```json
{
  "editor.fontFamily": "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  "editor.fontLigatures": true
}
```

不过连字并非人人喜欢——它让 `!=` 和 `!==` 长得更像，有人觉得反而增加了误读风险。装好字体后自己看两天再决定。

## 一点经验

配置这件事容易走进一个误区：收集大量设置项塞进 `settings.json`，然后忘记每一项是干什么的。等某天遇到诡异行为，翻出两百行配置完全不知道该怀疑谁。

我现在的做法是**每加一项都写清理由**，并且定期删掉那些"当初觉得会用、后来一直没用"的插件。配置文件应该是能读懂的，不是攒出来的。

另外，团队项目里的格式化规则应该放进项目自己的配置文件（`.editorconfig`、`biome.json`、`.prettierrc`），而不是各人的用户设置——否则每个人保存一次，diff 里就多一堆和功能无关的改动。
