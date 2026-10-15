# V1 实测报告

## 公开发布与线上复核

2026-10-15，站长明确授权后，网站已发布到[https://ankey1.github.io/jinquan-space/](https://ankey1.github.io/jinquan-space/)。登录后的GitHub界面确认[首次正式发布工作流 #1](https://github.com/AnkeY1/jinquan-space/actions/runs/38704126532)为Success，用时1分3秒，触发工作流修订`15ce83f`；首发bot源码恢复成功。发布工作流在GitHub runner完成资料批准门禁、源码检查/格式/单元验证、公开构建与Pages部署。

独立完整CI [Validate static site](https://github.com/AnkeY1/jinquan-space/actions/runs/38704918528)现已通过GitHub REST确认Success，修订`61e9432`，运行记录时间2026-10-15 16:20:09–16:22:24（Asia/Shanghai），21个步骤全部成功，包含类型、lint、格式、单元、预览构建、Chromium浏览器旅程、axe、子路径、隔离公开模式和资料批准门禁、链接与资源预算。运行记录及逐步骤状态见`evidence/github-actions-audit.json`和`evidence/github-actions-jobs-audit.json`；这与首次发布成功为两份独立结果。

当日16:18（Asia/Shanghai），使用普通、无登录会话及cookies的Python urllib HTTPS GET逐项复核40个公开文件：全部HTTP200，覆盖19个HTML页面；HTML元数据与资源路径检查没有问题，搜索索引9条，sitemap16条且均在实际发布base内；随机不存在的路由返回本站真实HTTP404。39个文件与本地字节一致，`third-party-notices.txt`仅因Linux/Windows文件枚举顺序不同而调整许可证块顺序，行集合相同，没有缺少许可证文字。完整结果见`evidence/online-publication-audit.json`。这轮线上审查验证静态可访问性与发布元数据，没有替代浏览器交互、真实手机或指定地区网络实测。

发布操作中的真实线上浏览器观察确认日志示例完成计算：3个canvas，A平均值350，保留−900与2100，比较平均值6.4。记录为`evidence/online-runtime-observation-notes.json`，其中明确由发布代理直接观察，审查代理未独立重跑。本地与GitHub runner的CSV/PNG导出测试已通过；线上CUA两次等待下载事件均超时，因此线上下载捕获和下载文件本身仍记为未证实，不据此判定功能失败或宣称成功下载。

本地收尾版部署工作流移除一次性ZIP恢复，build job恢复`contents: read`，checkout不保留凭据；保留指定仓库/默认分支限制、手动发布确认、资料批准和独立部署权限。该轮仅改工作流、文档与证据，不重建前端或重复算法套件。完整格式和部署工作流静态检查结果见PROGRESS。

为公开源码定点脱敏两个原始诊断记录：`verify-transcript.txt`中3处本机工程根路径替换为`<PROJECT_ROOT>`；`secondary-browser-smoke.json`中Firefox错误字符串的2处用户目录前缀替换为`<USER_HOME>`。除这5处路径表示外，断言核验其他文本和JSON数据均未更改；测试fixture、状态、计数、时间、测量值和错误类型保持原样。

## v1.0.1 姓名修订复核

站长姓名已统一为“喻锦权”，主页与关于页字标为“锦权”。扫描全部39个构建文件和19个HTML，未发现旧姓名；标题、默认描述、导航辅助标签、页脚与简历均已检查。默认描述和辅助标签从配置引用，避免模板维护多套姓名。

本次重新执行：Astro类型检查0错误/0警告/0提示、ESLint、107项单元测试、30项Chromium E2E与14项axe检查（合计44项浏览器检查）全部通过；根路径构建、502个链接、gzip预算、子路径与隔离公开模式也通过。首页/文章/项目/工具截图和1页/2页打印样例同步刷新。浏览器命令证据见`evidence/name-update-browser-tests.txt`。下面保留初版完整验收与环境限制，初版聚合verify日志不改写为本次命令。

日期：2026-10-15，Asia/Shanghai。对象为生产静态构建与项目源文件，非仅开发服务器。数据均为仓库或临时生成的合成 fixture，没有读取真实业务日志或履历。

## 环境与结果

Windows x64，Intel Core i9-12900H；Node24.19.0，npm12.2.0；Playwright1.64.1。Chromium使用本机Chrome155.0.8059.79，WebKit27.2。浏览器均为headless自动化；不等于真实手机。

| 检查                    | 实际结果                                           | 证据 / 实现                                                                                              |
| ----------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run check`         | 通过，0错误/0警告/0提示                            | Astro strict，86个文件                                                                                   |
| `npm run lint`          | 通过                                               | ESLint包含Astro和TS                                                                                      |
| `npm run format:check`  | 最终通过；新复制的性能JSON首次阻止verify，已格式化 | Prettier，不屏蔽检查                                                                                     |
| `npm run test:unit`     | 107/107通过，5个文件                               | `tests/unit/`                                                                                            |
| `npm run build`         | 通过，19个HTML页面                                 | 根路径preview，无sitemap                                                                                 |
| `npm run test:e2e`      | 30/30 Chromium通过                                 | `tests/e2e/`，生产严格404服务器                                                                          |
| `npm run test:a11y`     | 14/14通过，所扫描WCAG规则0违规                     | 7类页面×深浅主题；工具使用成功状态                                                                       |
| `npm run test:basepath` | 通过                                               | `/portfolio/`全路由、搜索、3个Worker、示例与下载                                                         |
| `npm run test:public`   | 通过                                               | 隔离合成配置、批准门禁、draft/preview字节扫描、SEO、元数据错误拒绝                                       |
| `npm run test:links`    | 通过                                               | 502个HTML/模块引用，19个HTML                                                                             |
| `npm run test:bundle`   | 通过                                               | `evidence/bundle.json`，内联JS及动态导入均计入                                                           |
| `npm audit --json`      | 0个已知漏洞                                        | 2026-10-15实际查询，非未来安全保证                                                                       |
| `npm run verify`        | 最终完整串联通过，退出码0                          | `evidence/verify-transcript.txt` 与 `verification.json`                                                  |
| WebKit smoke            | 9/9核心检查通过，6个CSV/PNG下载字节通过            | `evidence/secondary-browser-smoke.json`                                                                  |
| Firefox smoke           | **未能启动，未通过验证**                           | 已下载157.0/build1555；Windows14001/mozglue并行配置错误，`evidence/firefox-launch-blocker.json`          |
| GitHub发布工作流        | 首次发布Success                                    | [发布 #1](https://github.com/AnkeY1/jinquan-space/actions/runs/38704126532)；详见本报告公开发布复核      |
| GitHub独立完整CI        | Success，21步骤全部通过，修订`61e9432`             | [Validate static site](https://github.com/AnkeY1/jinquan-space/actions/runs/38704918528)；逐步骤REST证据 |

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

Firefox受Windows启动组件错误阻塞，需在正常环境或Linux重新执行`node scripts/smoke-browsers.mjs`。原生200%浏览器缩放、真实中文输入法与屏幕阅读器、真实iPhone/Android、指定地区和境内外运营商访问、完整安全响应头审计仍未执行；线上CUA下载事件捕获尚未证实。640CSSpx×2像素密度截图只是重排模拟，不冒充浏览器缩放测试。没有给这些项目填“通过”。默认Pages域名的HTTPS资源可访问性、发布runner与独立完整CI现已验证；未配置自定义域名或DNS。

当前版本公开发布已获明确授权，正式批准字段为true；网站与源码已经公开。教育、任职、真实成果和公开联系邮箱仍未提供，保留空白与本站演示/资料模板标识。未改自定义DNS。
