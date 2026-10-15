# V1 实测报告

## v1.0.1 姓名修订复核

站长姓名已统一为“喻锦权”，主页与关于页字标为“锦权”。扫描全部39个构建文件和19个HTML，未发现旧姓名；标题、默认描述、导航辅助标签、页脚与简历均已检查。默认描述和辅助标签从配置引用，避免模板维护多套姓名。

本次重新执行：Astro类型检查0错误/0警告/0提示、ESLint、107项单元测试、30项Chromium E2E与14项axe检查（合计44项浏览器检查）全部通过；根路径构建、502个链接、gzip预算、子路径与隔离公开模式也通过。首页/文章/项目/工具截图和1页/2页打印样例同步刷新。浏览器命令证据见`evidence/name-update-browser-tests.txt`。下面保留初版完整验收与环境限制，初版聚合verify日志不改写为本次命令。

日期：2026-10-15，Asia/Shanghai。对象为生产静态构建与项目源文件，非仅开发服务器。数据均为仓库或临时生成的合成 fixture，没有读取真实业务日志或履历。

## 环境与结果

Windows x64，Intel Core i9-12900H；Node24.19.0，npm12.2.0；Playwright1.64.1。Chromium使用本机Chrome155.0.8059.79，WebKit27.2。浏览器均为headless自动化；不等于真实手机。

| 检查                    | 实际结果                                             | 证据 / 实现                                                                                     |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run check`         | 通过，0错误/0警告/0提示                              | Astro strict，86个文件                                                                          |
| `npm run lint`          | 通过                                                 | ESLint包含Astro和TS                                                                             |
| `npm run format:check`  | 最终通过；新复制的性能JSON首次阻止verify，已格式化   | Prettier，不屏蔽检查                                                                            |
| `npm run test:unit`     | 107/107通过，5个文件                                 | `tests/unit/`                                                                                   |
| `npm run build`         | 通过，19个HTML页面                                   | 根路径preview，无sitemap                                                                        |
| `npm run test:e2e`      | 30/30 Chromium通过                                   | `tests/e2e/`，生产严格404服务器                                                                 |
| `npm run test:a11y`     | 14/14通过，所扫描WCAG规则0违规                       | 7类页面×深浅主题；工具使用成功状态                                                              |
| `npm run test:basepath` | 通过                                                 | `/portfolio/`全路由、搜索、3个Worker、示例与下载                                                |
| `npm run test:public`   | 通过                                                 | 隔离合成配置、批准门禁、draft/preview字节扫描、SEO、元数据错误拒绝                              |
| `npm run test:links`    | 通过                                                 | 502个HTML/模块引用，19个HTML                                                                    |
| `npm run test:bundle`   | 通过                                                 | `evidence/bundle.json`，内联JS及动态导入均计入                                                  |
| `npm audit --json`      | 0个已知漏洞                                          | 2026-10-15实际查询，非未来安全保证                                                              |
| `npm run verify`        | 最终完整串联通过，退出码0                            | `evidence/verify-transcript.txt` 与 `verification.json`                                         |
| WebKit smoke            | 9/9核心检查通过，6个CSV/PNG下载字节通过              | `evidence/secondary-browser-smoke.json`                                                         |
| Firefox smoke           | **未能启动，未通过验证**                             | 已下载157.0/build1555；Windows14001/mozglue并行配置错误，`evidence/firefox-launch-blocker.json` |
| GitHub工作流            | YAML与固定SHA/手动触发配置检查通过；远程runner未运行 | 不宣称CI已在GitHub通过或已发布                                                                  |

## 干净安装与启动

在独立任务目录中，以锁文件执行全新 `npm ci` 成功（513个包，0个已知漏洞），随后 `npm run build` 成功；39个静态文件与主项目构建逐字节一致。`npm run dev` 和 `npm run preview` 均实际启动并取得HTTP200，测试进程随后关闭。

## 算法与任务追踪

| 需求ID                       | 执行范围与结果                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| U-URL-01..03                 | 根/base/绝对地址、非法协议/query/hash误用，单测通过                                                                                   |
| U-CONTENT-01..03             | 统一可见性；隔离注入draft哨兵与preview-only内容；非法日期/slug/关联导致构建失败，预期验证通过                                         |
| U-LOG-01..10                 | 两/四位年、跨秒跨年、日历范围、保留负值、固定A/B、回退分段、重号整组排除、单侧计数、无效候选断点、UTC/亚洲/美洲一致，25个日志单测通过 |
| U-CSV-01..06                 | 引号/逗号/换行、重复空特殊表头、严格数值、安全整数、缺失独立gap、非单调顺序、错列/致命引号，38个CSV单测通过                           |
| U-STAT-01..02                | 空/单值/固定向量、总体标准差、大基值小波动、原顺序不变，通过                                                                          |
| U-DSP-01..06                 | FFT与DFT、纯正弦、DC/奈奎斯特、周期Hann与窗和、900→124Hz混叠、固定seed；34个FFT/信号单测通过                                          |
| U-EXPORT-01..02              | BOM/CRLF/标准转义、危险文本前缀保护、负数-900仍为数值，通过                                                                           |
| U-DOWN-01                    | 原顺序桶首/最小/最大/末点，正负尖峰和gap/分段保留，日志/CSV/信号测试通过                                                              |
| E-NAV-01..02 / E-404-01      | 18个正常路由直达、单H1、未知地址真实HTTP404、移动菜单/Escape焦点，通过                                                                |
| E-THEME-01..02               | 系统/浅/深、保存白名单键、系统跟随、结果/参数/缩放保留，通过                                                                          |
| E-SEARCH-01..03              | 中文子串、多词、composition事件、hash刷新、加载失败重试、XSS只作文本，通过。真实中文输入法人工操作未执行                              |
| E-LOG-01..04                 | 样例A/B、双向聚焦、原值CSV+真实PNG、分段选择、错误恢复，通过                                                                          |
| E-CSV-01..03                 | 文件→选列、最多4列、恶意表头、缺失gap、CSV/PNG签名与内容，通过                                                                        |
| E-WORKER-01..03 / E-STATE-01 | 同步CPU任务terminate取消、重选同文件、任务替换、读取前大小/解析中结构上限、旧结果不可导出，通过                                       |
| E-LAB-01..02                 | 默认实际计算、预设/reset/校验、分享白名单/长度/非法参数与历史恢复，通过                                                               |
| E-RESUME-01..02              | 无假PDF链接、真实print调用、短/长样例PDF通过；见打印审查                                                                              |
| E-PRIVACY-01..02             | 唯一合成文件名与内容哨兵不出现在请求URL/body/header或页面URL；local/session/IndexedDB/cache/cookies检查，通过                         |
| E-OFFLINE-01                 | 资源加载后断网，三个工具重新计算/导出，通过；不覆盖新页面首次离线访问                                                                 |
| E-NOJS-01                    | 首页/原生移动导航可读、工具noscript可见，通过                                                                                         |
| E-BASE-01 / E-PUBLIC-01      | 子路径全站smoke和隔离公开构建，通过                                                                                                   |
| A-01..03                     | axe与键盘核心操作、320px重排/长文件名通过；真正浏览器200%缩放与屏幕阅读器未执行                                                       |
| V-01..03                     | 首页4视口深浅，文章/项目桌面手机，工具成功/错误/partial/cancelled/长名截图已打开检查并修正                                            |
| P-01..02                     | 实际gzip预算、10k日志、信号交互、连续10次Worker/canvas清理，通过；无真实用户CWV数据                                                   |

## 视觉与打印

首页截图覆盖1440×1000、1366×768、390×844、320×800，均有深浅主题。文章与项目为1440/390；工具有桌面/手机深浅成功状态、CSV错误/部分完成/取消/长中文文件名。截图位于`docs/evidence/`，均实际打开审查。

第一轮修复了logo换行、手机统计数字拆行、长标题孤字、缺失后单点不可见和窄屏说明标题孤字，再次截图检查。WebKit切主题后立即截屏存在重绘时机问题；确认计算颜色正确，并等候重绘后重新打开截图。

打印样例短版1页、长版2页。Poppler渲染三页并逐页检查，中文清楚、白底深字、10.5pt有效正文、条目无裁切或重叠，模板标识保留。长版12条内容仅为临时DOM合成测试，未改写profile/resume。`evidence/print-review.json`记录A4舍入尺寸和文件哈希。

## 体积与性能

生产构建约1.05MiB。首页JS gzip约0.92KiB，普通内容约0.77–2.14KiB；日志约210.47KiB，CSV约216.05KiB，信号约208.52KiB；CSS约4.16–5.90KiB。数字来自逐资源gzip相加，图表动态依赖和内联Worker均包含，精确最新结果以`evidence/bundle.json`为准。图表chunk裸大小触发Vite500kB提示，实际工具gzip低于450KiB预算，未隐藏告警。

10,000条合成日志实测点击到结果约240ms量级；信号N=1024含100ms防抖的参数更新在完整套件中位数151.3ms。具体样本、浏览器和环境见`log-performance.json`与`signal-performance.json`，不作为所有设备的保证。连续10次日志运行后Worker活动数归零、清空后canvas为零，生命周期测试通过。

未运行Lighthouse三次中位数，也没有真实用户LCP/INP/CLS数据。不会用这些本地计时替代真实用户指标。

## 剩余验证边界

Firefox受Windows启动组件错误阻塞，需在正常环境或Linux重新执行`node scripts/smoke-browsers.mjs`。原生200%浏览器缩放、真实中文输入法与屏幕阅读器、真实iPhone/Android、GitHub runner、线上响应头、DNS/HTTPS和境内外运营商访问均未执行。640CSSpx×2像素密度截图只是重排模拟，不冒充浏览器缩放测试。没有给这些项目填“通过”。

公开资料和真实履历尚未确认，正式批准字段仍为false；未发布、未推送、未改DNS。
