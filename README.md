# 喻锦权 / Space

一个可以静态部署的中文个人技术空间：19 个页面、3 个本站演示项目、3 篇功能说明文章、日志时间差分析器、CSV/TSV 数据绘图器和信号实验室。当前版本已获站长授权并发布至 [喻锦权 / Space](https://ankey1.github.io/jinquan-space/)。[首次部署](https://github.com/AnkeY1/jinquan-space/actions/runs/38704126532)与[完整 CI](https://github.com/AnkeY1/jinquan-space/actions/runs/38704918528)均已通过。

## 本地运行

安装 Node **24.19.0**（`.nvmrc`）与 npm 11 或以上。Windows PowerShell、macOS 与 Linux 使用相同命令：

```text
npm ci
npm run dev
```

终端给出的本地地址通常是 `http://127.0.0.1:4321/`。进入含 `package.json` 的项目目录再运行。构建与预览：

```text
npm run build
npm run preview
```

不需要域名、账号、Python、Docker、API key 或后端。依赖由锁文件固定；不要用随机 `latest` 替换它们。首次安装需要访问 npm registry。

## 检查命令

```text
npm run check
npm run lint
npm run format:check
npm run test:unit
npm run build
npm run test:e2e
npm run test:a11y
npm run test:basepath
npm run test:public
npm run test:links
npm run test:bundle
npm run verify
```

`verify` 串联以上主要检查，失败会退出。Playwright 检查生产静态构建，自动启动和关闭严格 404 服务器。Windows 检测已安装的 Chrome；也可设置 `CHROME_PATH`，其他系统使用 Playwright Chromium。需要安装测试浏览器时：

```text
npx playwright install chromium firefox webkit
```

`test:basepath` 单独构建 `/portfolio/`，验证路由、搜索、Worker、样例与下载。`test:public` 在 `.test-dist/public-source` 的合成资料副本中验证批准门禁、draft/preview 过滤、canonical 和 sitemap；不会批准正式资料，也不会覆盖正常 `dist/`。

## 修改内容

- 姓名、介绍、方向和可选联系方式：`src/data/profile.json`。
- 简历区块：`src/data/resume.json`；未填写的区块隐藏。默认只提供模板打印。
- 项目：`src/content/projects/*.md`；文章：`src/content/articles/*.md`。
- 样例均为合成：`public/samples/`；原始访客文件只保存在本页内存中。
- 完整新增范例、字段与图片规则：[内容维护指南](docs/CONTENT_GUIDE.md)。

## 实现与边界

Astro 7 静态多页、TypeScript strict、原生 CSS、按页 ECharts、Papa Parse 与本地 Worker。普通内容页不加载图表引擎。日志保留原始负差值、编号回退分段与重复键排除；CSV 缺失值不补零；FFT 通过 DFT、DC、奈奎斯特和周期 Hann 固定样例。

文件大小上限 10 MiB。日志每个 100,000 条候选、500,000 物理行；CSV 最多 100,000 行、100 列、2,000,000 单元格。信号最多 8192 点。统计和导出使用完整结果，显示抽样不会改写数据。浏览器 localStorage 只保存主题偏好。加载所需资源后，当前工具可离线计算；尚未加载的新页面与示例需要网络。

## 发布与迁移

本地默认 `SITE_MODE=preview`，预览 HTML 使用 noindex，预览不生成 sitemap。`.env.example` 提供 origin/base 设置。公开构建同时需要真实 HTTPS origin 和站长确认后的 `publicProfileApproved=true`，该字段已按本次授权设置为 true。本站正式配置是 `SITE_ORIGIN=https://ankey1.github.io`、`SITE_BASE=/jinquan-space/`。**noindex 不是权限控制。**

CI 不发布；GitHub Pages 工作流只能手动触发。当前仓库为 [AnkeY1/jinquan-space](https://github.com/AnkeY1/jinquan-space)，Pages 使用 GitHub Actions 和默认 HTTPS 域名。后续公开版本仍需明确发布授权。详见 [部署](docs/DEPLOYMENT.md) 与 [迁移](docs/MIGRATION.md)。

## 交付证据与许可

[测试报告](docs/TEST_REPORT.md)、[交接说明](docs/HANDOFF.md)、[设计系统](docs/DESIGN_SYSTEM.md)、[依赖](docs/DEPENDENCIES.md)、[决策](docs/DECISIONS.md)。截图与体积报告位于 `docs/evidence/`。浏览器的移动视口测试不等于真机验证；境内外网络、屏幕阅读器和线上响应头需后续实测。

本站原创代码和内容的对外许可由站长决定，未自动指定 MIT/CC0。客户端第三方完整许可证与 NOTICE 保留于 `public/third-party-notices.txt`，构建进入 `dist/`；开发依赖的许可证见各包及依赖文档。
