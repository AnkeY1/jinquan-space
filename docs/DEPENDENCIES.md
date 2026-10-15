# 依赖、版本与复现

核对日期：2026-10-15（Asia/Shanghai）。本表记录项目实际安装的版本，不代表各上游项目永远的最新版本。版本以 `package.json`、`package-lock.json` 和已安装包的 `package.json` 三方核对；许可证读取已安装包的声明及许可证文件。

## 运行环境

| 项目    | 本次实际环境                           | 仓库约束                                                   |
| ------- | -------------------------------------- | ---------------------------------------------------------- |
| Node.js | 24.19.0                                | `.nvmrc` 固定 `24.19.0`；`engines.node` 为 `>=24.19.0 <25` |
| npm     | 12.2.0                                 | `engines.npm` 为 `>=11`                                    |
| 锁文件  | `package-lock.json`，lockfileVersion 3 | 只使用 npm 锁文件；直接依赖均固定精确版本                  |

本次工作环境原先没有可直接调用的 npm，开发时在任务临时目录引导了 npm 12.2.0，通过 Node 执行其 CLI。它没有被安装为全局依赖，也不属于网站源码或部署产物。用户在标准 Node/npm 环境中使用下列命令即可，不依赖开发机器的绝对路径：

```sh
npm ci
npm run dev
```

`.nvmrc` 选择的是本次验证过的 Node 24 补丁版本。核对当日，Node 官方发布表将 24 分支列为 LTS；Astro 安装文档要求 Node 22.12.0 或更高版本，并排除奇数分支。项目进一步固定 Node 24，兼容当前 ESLint、Astro 插件和 Vitest 的引擎约束。[Node 发布周期](https://nodejs.org/en/about/previous-releases)、[Astro 安装前提](https://docs.astro.build/en/install-and-setup/)

## 构建与运行依赖

| 包                         | 精确版本 | 声明许可证 | 用途与上游                                                                                                          |
| -------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `astro`                    | 7.3.8    | MIT        | 静态页面、内容集合和构建；[Astro](https://github.com/withastro/astro)                                               |
| `@astrojs/markdown-remark` | 7.3.2    | MIT        | 显式 unified Markdown 管线；[Astro Markdown](https://github.com/withastro/astro/tree/main/packages/markdown/remark) |
| `echarts`                  | 6.1.0    | Apache-2.0 | 工具与实验页图表；[Apache ECharts](https://github.com/apache/echarts)                                               |
| `papaparse`                | 5.7.0    | MIT        | CSV/TSV 标准转义、引号和多行记录解析；[Papa Parse](https://github.com/mholt/PapaParse)                              |

`dependencies` 表示 npm 的安装分类；Astro 和 Markdown 处理器用于构建，不会因此整体进入访客浏览器。图表按需使用 `echarts/core`、line/scatter、所需组件与 Canvas renderer，再由工具页动态加载，普通内容页没有全量图表导入。[ECharts 按需导入](https://echarts.apache.org/handbook/en/basics/import/)

## 开发与验证依赖

| 包                      | 精确版本 | 声明许可证 | 用途与上游                                                                                                               |
| ----------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| `@astrojs/check`        | 0.9.10   | MIT        | Astro 类型检查；[Astro language tools](https://github.com/withastro/astro/tree/main/packages/language-tools/astro-check) |
| `typescript`            | 6.0.3    | Apache-2.0 | 严格类型检查；[TypeScript](https://github.com/microsoft/TypeScript)                                                      |
| `eslint`                | 10.12.0  | MIT        | 静态检查；[ESLint](https://github.com/eslint/eslint)                                                                     |
| `eslint-plugin-astro`   | 3.2.1    | MIT        | Astro 模板检查；[插件源码](https://github.com/ota-meshi/eslint-plugin-astro)                                             |
| `typescript-eslint`     | 8.71.2   | MIT        | TypeScript ESLint 配置与规则；[typescript-eslint](https://github.com/typescript-eslint/typescript-eslint)                |
| `prettier`              | 3.9.10   | MIT        | 格式化；[Prettier](https://github.com/prettier/prettier)                                                                 |
| `prettier-plugin-astro` | 1.1.1    | MIT        | Astro 格式化；[Astro Prettier 插件](https://github.com/withastro/prettier-plugin-astro)                                  |
| `vitest`                | 5.0.4    | MIT        | 纯函数与固定数学样例测试；[Vitest](https://github.com/vitest-dev/vitest)                                                 |
| `@playwright/test`      | 1.64.1   | Apache-2.0 | 生产构建浏览器测试；[Playwright](https://github.com/microsoft/playwright)                                                |
| `@axe-core/playwright`  | 4.13.0   | MPL-2.0    | 自动化可访问性检查；[axe-core npm](https://github.com/dequelabs/axe-core-npm)                                            |
| `@types/node`           | 24.19.2  | MIT        | Node API 类型；[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node)              |
| `@types/papaparse`      | 5.5.2    | MIT        | Papa Parse 类型；[DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/papaparse)       |

## 已落地的兼容性决定

1. **固定 TypeScript 6.0.3。** 已安装的 `@astrojs/check` 接受 `^5.0.0 || ^6.0.0`，`typescript-eslint` 接受 `>=4.8.4 <6.1.0`。因此没有直接升级到 TypeScript 7，也没有使用忽略 peer 冲突的安装参数。这些范围来自本次已安装包的 `peerDependencies`。
2. **显式选择 unified。** Astro 7 的默认 Markdown 管线已改变。项目安装 `@astrojs/markdown-remark`，在 `astro.config.mjs` 中使用 `unified({ remarkPlugins: ... })`，使 `scripts/safe-markdown.mjs` 确实执行原始 HTML 移除、链接协议校验、base 路径变换和标题层级校验。[Astro 7 Markdown 迁移说明](https://docs.astro.build/en/guides/upgrade-to/v7/#new-default-markdown-processor-s%C3%A4tteri)
3. **Worker 随工具代码内联。** `?worker&inline` 是 Vite 支持的导入方式，用于已经加载的工具在断网后重新计算，也避免把待取用 Worker 的 URL 当作已缓存能力。任务替换或取消仍通过 `terminate()` 实际终止 Worker；这不提供整站离线首次打开能力。[Vite Worker 导入](https://vite.dev/guide/features#web-workers)
4. **不添加前端框架或服务端适配器。** 页面使用 Astro 静态输出，交互使用按页 TypeScript；没有服务端运行环境、数据库、账户 SDK 或分析 SDK。

## 传递依赖与许可证范围

完整传递依赖由锁文件固定；不能只看上表就推断整个安装目录使用同一种许可证。核对时锁文件有 594 个 package 条目，包含根项目及各平台可选条目，并不意味着当前操作系统实际安装了 594 个包。

已核实的例子：ECharts 使用 `zrender@6.1.0`（BSD-3-Clause）；测试工具 `axe-core` 使用 MPL-2.0；构建工具 `lightningcss` 及其平台包使用 MPL-2.0；`sharp` 的若干可选平台二进制和 `libvips` 条目声明 LGPL-3.0-or-later 或组合许可证。后两类是构建工具链依赖，不能直接把它们列为本网站浏览器资源。实际发布的前端依赖以构建图和发布包中保留的许可证公告为准。

所有直接包均包含许可证文件；ECharts 与 Playwright 还带有 `NOTICE`。首次安装报告为 0 个已知漏洞；最终审计状态与执行命令以 `TEST_REPORT.md` 的实际记录为准。npm 审计结果会随公告库更新而变化。

## 升级与复现

复现使用 `npm ci`，不要删除锁文件后再安装 `latest`。升级时同时检查 Node 引擎、TypeScript peer 范围、Astro 迁移说明和图表/Worker 构建行为，再运行：

```sh
npm run check
npm run lint
npm run test:unit
npm run build
npm run test:e2e
npm run test:basepath
npm run test:public
```

这些是维护命令；本次哪些命令实际通过、哪些受环境限制，应阅读 `TEST_REPORT.md`，不由本页的命令清单代替。
