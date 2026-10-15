# 内容与资料维护

本文对应当前代码的实际字段。内容在本地 Markdown / JSON 中维护，网站没有在线 CMS。修改后先预览、检查和构建；开发与预览不需要域名或平台账号。

## 维护入口

| 要修改的内容                                   | 文件                        |
| ---------------------------------------------- | --------------------------- |
| 姓名、首页介绍、关于页文字、联系方式与公开确认 | `src/data/profile.json`     |
| 简历简介、教育、经历、项目与公开成果           | `src/data/resume.json`      |
| 站名规则、首页标语、导航、简历索引开关         | `src/config/site.ts`        |
| 项目正文及列表资料                             | `src/content/projects/*.md` |
| 文章正文、日期、标签与参考资料                 | `src/content/articles/*.md` |
| 工具列表文字                                   | `src/data/tools.ts`         |
| 实验列表文字                                   | `src/data/experiments.ts`   |
| 内容字段校验                                   | `src/content.config.ts`     |
| 公开资料与简历字段校验                         | `src/lib/profile.ts`        |
| 可见性过滤                                     | `src/lib/visibility.ts`     |

显示名和联系方式只在 `profile.json` 维护，不在简历中再保存副本。初始三个项目是本次实际开发的本站演示，不是站长既往履历。

## 公开资料

`profile.json` 使用严格 schema：以下字段全部保留，未知字段也会报错。JSON 不支持注释；可空字段使用 `null`，不使用看似有效的占位邮箱或链接。

| 字段                    | 类型与用途                                                     |
| ----------------------- | -------------------------------------------------------------- |
| `displayName`           | 非空字符串；默认“喻锦权”                                       |
| `intro`                 | 字符串；首页介绍                                               |
| `about`                 | 字符串；关于页介绍                                             |
| `directions`            | 字符串数组；关注方向，不是能力评分                             |
| `contactEmail`          | 有效邮箱字符串或 `null`                                        |
| `phone`                 | 字符串或 `null`                                                |
| `location`              | 字符串或 `null`                                                |
| `githubUrl`             | 无账号密码的 HTTPS URL 或 `null`                               |
| `socialLinks`           | `{ "label": "名称", "url": "HTTPS 地址" }` 数组；未配置时 `[]` |
| `resumePdfPath`         | 站内逻辑路径或 `null`；另有下方 PDF 文件检查                   |
| `publicProfileApproved` | 布尔值；默认 `false`，只能由站长明确确认后改变                 |

学校、单位、学历、联系方式、照片、论文与获奖都需要站长提供可公开资料。不要从姓名、聊天记忆、其他磁盘项目或网络账号推断补齐。空资料可以继续留空，已有页面会隐藏对应入口。

上传真正获准公开的 PDF 时，先放到 `public/files/`，例如 `public/files/resume.pdf`，再把 `resumePdfPath` 设为 `/files/resume.pdf`。当前构建还要求路径符合 `/files/[英文数字下划线点横线].pdf` 且文件真实存在。文件名建议使用 `resume.pdf`；路径错误会使构建失败。未配置时只有网页打印入口，不生成假的下载。

## 简历数据

`resume.json` 同样使用严格 schema，结构如下。下面是资料模板示例，不应直接改写成未经确认的履历：

```json
{
  "summary": "填写已确认可公开的简介。",
  "education": [],
  "experience": [],
  "projects": [],
  "publications": [],
  "patents": [],
  "awards": []
}
```

- `education`、`experience`、`patents`、`awards` 的每项为 `{ "title": "标题", "subtitle": "可选副标题", "period": "可选时间", "description": "说明" }`。`title`、`description` 必填；两个可选字段可直接省略。
- `projects` 每项为 `{ "title": "标题", "description": "说明", "path": "/projects/已有项目-slug/" }`。`path` 是站内逻辑路径；必须指向实际可访问的页面。
- `publications` 每项为 `{ "title": "已确认公开的成果标题", "url": "HTTPS 地址" }`，`url` 可省略。不要填虚假 DOI。
- 任何空数组对应的区块都不显示。显示名和联系方式仍引用 `profile.json`。

`/resume/` 默认不被索引。`resumeIndexable` 位于 `src/config/site.ts`，需在站长确认简历可以公开索引后再改为 `true`。浏览器打印仍保留预览资料提示。

## 内容可见性

每个项目、文章都有两个独立字段：

| 字段         | 可用值     | 含义                                                 |
| ------------ | ---------- | ---------------------------------------------------- |
| `visibility` | `draft`    | 所有分发构建均排除，不进入路由、列表、搜索和 sitemap |
| `visibility` | `preview`  | 只进入预览构建                                       |
| `visibility` | `public`   | 预览和获准的公开构建均可包含                         |
| `kind`       | `demo`     | 本站演示内容，不等于既往成果                         |
| `kind`       | `personal` | 涉及真实个人经历，必须先确认资料与公开范围           |

默认 `SITE_MODE=preview`，页面输出 `noindex,nofollow`。预览内容如果被部署，仍然可以被他人读取；这些标记不提供保密能力。敏感材料不应进入源代码、公开仓库或任何分发产物。

公开构建还需要真实 HTTPS `SITE_ORIGIN` 和 `profile.publicProfileApproved=true`。改内容字段不等于批准推送、部署或修改 DNS；发布另按 `docs/DEPLOYMENT.md` 执行。

## 新增一篇文章

在 `src/content/articles/` 新建与 slug 一致的 Markdown 文件，例如 `numeric-data-notes.md`。复制以下完整起点，先保持 `draft`；正文写好后再决定可见性。

```markdown
---
slug: numeric-data-notes
title: 数值数据处理笔记
summary: 用一份合成数据说明缺失值与严格数值转换的口径。
tags: [数据处理, TypeScript]
visibility: draft
kind: demo
publishedAt: '2026-10-15'
relatedProjectSlugs: [csv-plotter]
references:
  - title: Papa Parse 官方文档
    url: https://www.papaparse.com/docs
---

## 问题与输入

说明具体问题、输入来源与适用范围。明确区分合成示例与实际测量。

## 方法与观察

解释实现机制，用可复现的数据支持结论。

### 缺失值的处理

给出一个简短例子，说明哪些记录参与统计。

## 实际使用

打开[数据绘图器](/tools/csv-plotter/)，使用合成示例核对处理结果。
```

`publishedAt` 填首次公开的真实日期；有实质更新时才增加 `updatedAt: 'YYYY-MM-DD'`。示例中的日期只是模板示范，不应作为所有新文章的日期。日期必须是真实日历日期。标题、摘要不能为空，slug 只用小写英文字母、数字与连字符。

必填文章字段是 `slug/title/summary/tags/visibility/kind/publishedAt/relatedProjectSlugs/references`；`updatedAt` 可省略。`relatedProjectSlugs` 和 `references` 可以是 `[]`。参考资料每项必须含 `title` 与 HTTPS `url`，应链接到直接支持正文的资料页。

## 新增一个项目

在 `src/content/projects/` 新建 `numeric-data-demo.md`，例如：

```markdown
---
slug: numeric-data-demo
title: 数值数据口径演示
summary: 解释一组可运行的数值数据处理示例及其测试边界。
category: data-tools
tags: [TypeScript, 数据处理]
visibility: draft
kind: demo
featured: false
createdAt: '2026-10-15'
demoPath: /tools/csv-plotter/
relatedArticleSlugs: []
---

## 解决的问题

说明用户的实际任务与完成后的行为。

## 实现与取舍

说明真实实现，不把计划中的功能写成已经完成。

## 验证与限制

列出实际执行的验证与可重复的固定样例。
```

项目必填字段是 `slug/title/summary/category/tags/visibility/kind/createdAt/demoPath/relatedArticleSlugs`；`featured` 默认 `false`。可选字段是 `featuredOrder`（数字）、`updatedAt`（真实日期）、`cover`（字符串）、`coverAlt`（字符串）、`repositoryUrl`（HTTPS URL）。

`category` 只能是 `data-tools/interactive-lab/embedded/research/other` 之一。`featured: true` 会使项目有资格进入首页精选，按 `featuredOrder` 升序排列，再按 slug；首页最多显示三个。填写 `demoPath` 前先实现对应路由，不能放空链接。未提供真实仓库地址时省略 `repositoryUrl`。

目前初始三个项目采用 `ProjectVisual.astro` 的原创工程示意图。提供 `cover: /images/my-project.webp` 和对应 `coverAlt` 后，项目卡片与详情首图会改用本地图片。文件必须存在于 `public/images/`，只允许受控的 SVG/PNG/JPEG/WebP/AVIF 路径；不允许外部 URL 或父目录跳转。模板统一添加 base，图片需保留适合阅读的比例。

关联关系使用 slug，不使用标题。当前可见内容引用的关联项目或文章也必须在同次构建中可见，否则构建会报错。例如公开文章不能引用仅预览可见的项目。修改 slug 会改变路由、关联项和旧链接，发布后应尽量保持稳定。

## 图片、代码、标题与链接

将获准公开的图片放在 `public/images/`，例如 `public/images/my-chart.webp`，正文引用：

```markdown
![图中数据、坐标和含义的简短说明](/images/my-chart.webp)
```

这里的图片路径是操作示例；先放入真实图片再引用，不要提交断链。推荐压缩的 WebP 或 SVG 示意图，写清替代文字。在 `docs/ASSETS.md` 记录来源、作者、许可证和修改方式。不要随意使用站长真人照片或复制他站视觉素材。

正文内使用逻辑路径 `/tools/csv-plotter/`、`/articles/已有-slug/`、`/images/实际文件.webp`。Markdown 构建流程会自动加部署 base；不要手工加 `/portfolio/`，否则切换部署路径时容易重复。Astro 模板中的站内链接使用 `withBase()`。外链只用 HTTPS，锚点用 `#标题锚点`；不使用 `javascript:`、`data:`、协议相对链接、假邮箱或 `href="#"` 占位。

正文从 `##`（H2）开始，不再写 H1；标题由页面模板生成。标题不可跳级，例如 H2 后接 H3，而不是 H4。H2/H3 会生成文章目录。代码使用带语言名的围栏代码块，例如三个反引号后写 `ts`；代码复制按钮由页面脚本提供。

Markdown 原始 HTML 会被构建处理器移除，不支持用 HTML 注入脚本、样式、iframe 或任意组件。HTML 示例要放进代码块才能作为文字保留。也不要在 Markdown 中执行用户输入。

## 修改工具、参数与共享组件

两个工具的算法上限分别集中在 `src/lib/log.ts` 与 `src/lib/csv-data.ts`；信号参数和预设在 `src/data/experiments.ts`（算法在 `src/lib/signal.ts`）。改列表中的说明不等于更改算法上限。调整限制或计算规则时，同时维护帮助文案、测试、样例和文档，固定验收的预期值不能通过调用被测实现生成。

工具可复用 `FilePicker/ProcessingStatus/FieldError/StatGrid/ChartPanel/ResultTable/ExportActions/PrivacyNote` 与 `ToolShell` 组件。算法留在纯函数，解析和计算留在 Worker；不要在组件中上传访客文件或保存结果到存储。

## 每次更新后的检查

```sh
npm run dev
npm run check
npm run lint
npm run test:unit
npm run build
```

打开改动的页面、搜索结果和关联入口，检查手机与深浅主题。正文有图片或链接时确认没有 404。修改工具时运行对应 E2E；发布前再执行 README 中的完整验证与子路径构建。

构建会重新生成页面和搜索索引；公开构建才有 sitemap。手工编辑 `dist/` 会在下次构建丢失，因此始终修改源文件。实际上传发布仍需站长授权。
