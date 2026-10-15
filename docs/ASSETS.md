# 素材来源与许可记录

核对日期：2026-10-15（Asia/Shanghai）。本页区分本站创建的素材、站长提供的照片、合成样例、系统字体和第三方软件依赖。当前没有采购素材、外链字体或从他站复制的项目截图。

## 本站素材

| 素材               | 位置                                                             | 来源与显示口径                                                          |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 波形标识与 favicon | `public/favicon.svg`、`src/layouts/Layout.astro`                 | 本次开发创建的原创波形；首页字标从姓名生成，关于页照片另见下方记录      |
| 导航与操作图标     | `src/components/Icon.astro`                                      | 本次开发编写的基础 SVG 路径；没有引入图标库、商标包或外部 CDN           |
| 三个项目封面结构图 | `src/components/ProjectVisual.astro`                             | 本次开发编写的 SVG/CSS 示意；标注“结构示意”，不作为实测图或既往业绩证据 |
| 首页可调正弦图     | `src/pages/index.astro`                                          | 数学正弦函数生成的 SVG；标注“数学演示 · 非传感器数据”                   |
| 工具与实验图表     | 各页控制器、`src/lib/chart.ts`                                   | 基于访客本地输入或明确合成数据生成；图表渲染来自 Apache ECharts         |
| 合成日志 A/B       | `public/samples/log-a.log`、`public/samples/log-b.log`           | 开发规格给定的固定合成样例；没有真实设备日志或身份资料                  |
| 合成 CSV           | `public/samples/csv-sample-data.csv`                             | 开发规格给定的逗号、引号、多行和缺失值样例                              |
| 信号预设与数学结果 | `src/data/experiments.ts`、`src/lib/signal.ts`、`src/lib/fft.ts` | 本地生成的双音、直流和确定性均匀噪声；自写 FFT 实现，没有第三方 FFT 库  |
| 示例文章与项目说明 | `src/content/articles/`、`src/content/projects/`                 | 本次开发撰写的本站演示内容；不补造站长论文、工作经历或成果              |
| 浏览器验证截图     | `test-results/`、`work/screenshots/`                             | 本地生产构建的真实浏览器截图，用于验证；不进入 `dist/` 网站素材目录     |

页面字体使用操作系统字体栈和系统等宽字体，没有下载或分发独立字体文件。系统实际渲染的字体随设备而变化，其字体软件许可仍属于各自提供方。

## 站长提供的照片

以下 13 张照片均由站长在本次个人信息完善中提供，用于个人网站的经历与生活展示。拍摄者未单独署名，未指定面向第三方转载的开放许可证。人物称谓、测试地点及用途来自站长的文字说明，不通过人脸或背景猜测人物身份，也不把现场照片作为任职、正式合作、企业认可或测试性能已达成的证据。

| 文件（均位于 `src/assets/about/`） | 内容与来源说明                                                           |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `lab-friends.webp`                 | 站长与实验室学弟们的合照                                                 |
| `portrait.webp`                    | 站长提供的健身房个人生活照                                               |
| `electronics-team.webp`            | 本科电赛实验室合照，不逐一识别或标注人员姓名                             |
| `basketball-friends.webp`          | 与朋友打篮球时的合照                                                     |
| `field-test.webp`                  | 带自研仪表赴中天进行成缆后检测时的门口留影                               |
| `qingdao-sea-trial.webp`           | 与水听组赴青岛海试期间，在海边调试设备的现场                             |
| `cryogenic-test.webp`              | 上海超导电缆实验室液氮低温测试现场；文字描述测试目标，不据图推断性能结果 |
| `fpga-debug.webp`                  | FPGA 代码与仪表调试现场                                                  |
| `million-fbg-experiment.webp`      | 100 公里、约 100 万个物理光栅传感阵列的解调实验现场                      |
| `instrument-black.webp`            | 曾研制的一台黑色机箱仪表实物，无型号或性能推断                           |
| `instrument-silver.webp`           | 曾研制的一台银色机箱仪表实物，无型号或性能推断                           |
| `comac-visit.webp`                 | 带仪表赴上海商飞测试时的留影，不补充未经提供的测试内容                   |
| `guizhou-dam.webp`                 | 站长提供的贵州坝体现场应用照片，不推断坝名、监测内容或应用成果           |

照片通过素材预处理压缩为 WebP 并移除元数据，原始供图不公开，项目中只保留站点使用的文件名，不记录原始本机路径。页面通过 Astro `Image` 组件输出适配尺寸；人物照片保留真实画面，不生成或替换人物。`fpga-debug.webp` 与 `million-fbg-experiment.webp` 在 `src/pages/about.astro` 的 `.rotation-frame` 中使用 CSS `rotate(-90deg)` 调整阅读方向，源图像素未作该旋转；替换为方向已校正的照片时需同步调整样式。

## 本站代码与内容的许可状态

站长尚未指定本站源代码、文字与原创图形的对外授权条款。项目的 `private: true` 只是 npm 包发布限制，不等于内容许可，也不是访问控制。本次开发没有擅自添加 MIT、CC BY 或其他覆盖全站内容的许可证。后续如要公开源码或授权转载，由站长明确选择范围和许可，再增加相应文件。

开发规格提供的合成样例仅按本次开发任务使用；没有将其改称真实业务数据，也没有替提供方授予独立的开放数据许可。访客自己的文件不作为项目素材，不写入仓库或构建输出。

## 第三方软件

第三方软件保留自身许可证，不会因本站代码许可尚未指定而改变。精确版本与来源见 `DEPENDENCIES.md`；许可证原文随 `npm ci` 安装在各包目录中。

`scripts/generate-notices.mjs` 在构建前将实际浏览器依赖 ECharts、ZRender、tslib、Papa Parse 的许可证原文、ECharts 的 `NOTICE` 和其许可证子目录汇总为 `public/third-party-notices.txt`，静态输出为 `dist/third-party-notices.txt`。发布整个 `dist/` 时一起保留该文件；子路径部署时使用对应的 base 路径访问它。Astro/Vite 的自动许可证输出在本次构建中没有生成可见文件，因此项目使用这个显式生成步骤，决定记录见 `DECISIONS.md`。

| 软件                                                                                                         | 实际声明                           | 本项目中的范围                       |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------ |
| [Astro 及 Markdown 处理器](https://github.com/withastro/astro)                                               | MIT                                | 静态构建和内容处理                   |
| [Apache ECharts](https://github.com/apache/echarts)                                                          | Apache-2.0；附 `LICENSE`、`NOTICE` | 工具与实验页的浏览器图表             |
| [ZRender](https://github.com/ecomfe/zrender)                                                                 | BSD-3-Clause                       | ECharts 的图形渲染依赖               |
| [Papa Parse](https://github.com/mholt/PapaParse)                                                             | MIT                                | CSV 解析                             |
| [TypeScript](https://github.com/microsoft/TypeScript)、[Playwright](https://github.com/microsoft/playwright) | Apache-2.0                         | 开发与测试；Playwright 另附 `NOTICE` |
| [axe-core](https://github.com/dequelabs/axe-core) 与其 Playwright 适配                                       | MPL-2.0                            | 开发时自动化可访问性检查             |
| ESLint、Prettier、Vitest 及对应直接插件                                                                      | MIT                                | 开发工具；完整包名与版本见依赖文档   |

传递依赖还有 ISC、BSD、MPL、LGPL、CC0、Blue Oak 等声明；安装工具链、分发源代码和发布静态网站涉及的文件范围不同。发布包应保留实际分发依赖的许可证与公告，不把整份依赖树统一重标为本站许可。许可证记录基于包内元数据与原文，不是对第三方资产的重新授权。
