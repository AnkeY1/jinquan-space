# 静态部署与 GitHub Pages

站长已于 2026-10-15 明确授权“同意公开发布当前版本”。已通过登录后的 GitHub 界面创建公开仓库 [AnkeY1/jinquan-space](https://github.com/AnkeY1/jinquan-space)。正式资料批准字段现为 `true`，公开 GitHub 资料链接为 [AnkeY1](https://github.com/AnkeY1)；联系邮箱与未提供的履历仍保持空白。

网站已发布到 [https://ankey1.github.io/jinquan-space/](https://ankey1.github.io/jinquan-space/)，配置为 `SITE_ORIGIN=https://ankey1.github.io`、`SITE_BASE=/jinquan-space/`。2026-10-15 已通过登录后的 GitHub 界面确认[首次正式发布工作流 #1](https://github.com/AnkeY1/jinquan-space/actions/runs/38704126532)为 Success，用时 1分3秒，触发工作流修订为 `15ce83f`；首发源码已由 bot 恢复提交。

当日 16:18（Asia/Shanghai）使用普通、无登录会话的 HTTPS 请求复核：40/40 公开文件返回 HTTP200，覆盖19个HTML页面；sitemap含16条，搜索索引含9条，不存在的路由返回本站真实HTTP404。完整审查见 `evidence/online-publication-audit.json`。这些结果不代表指定地区运营商、真实手机或所有浏览器均已验证。

独立完整CI [Validate static site](https://github.com/AnkeY1/jinquan-space/actions/runs/38704918528)已通过GitHub REST确认Success，修订`61e9432`，运行记录时间为2026-10-15 16:20:09–16:22:24（Asia/Shanghai），21个步骤全部成功。类型、lint、格式、单元、构建、Chromium浏览器旅程、axe、子路径、公开门禁、链接与体积检查均通过；证据为 `evidence/github-actions-audit.json` 与 `evidence/github-actions-jobs-audit.json`。

## 本地构建与配置

使用 Node.js `24.19.0` 和随附的 npm 11，执行：

```sh
npm ci
npm run verify
npm run build
npm run preview
```

默认是 `SITE_MODE=preview`，所有页面禁止索引，没有公开 sitemap。预览产物仍然是任何获其访问地址的人都能读取的普通静态文件，不存放秘密。

| 变量          | 内容                                          | 示例场景                                                      |
| ------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `SITE_MODE`   | `preview` 或 `public`                         | 本地默认为 `preview`                                          |
| `SITE_ORIGIN` | 仅 HTTPS origin，无尾部斜杠、路径、账号或参数 | 所用托管平台的真实主机地址                                    |
| `SITE_BASE`   | 从 `/` 开始、以 `/` 结尾的路径                | 根站点 `/`；仓库项目站 `/仓库名/`（仓库名须符合配置允许字符） |

`src/data/profile.json` 的 `publicProfileApproved` 已根据本次明确授权改为 `true`。公开构建同时检查真实 HTTPS origin；缺任何一项均停止。自动测试使用隔离配置，并检查正式资料文件的原始字节保持不变。

在 PowerShell 中构建本次已确认的正式配置：

```powershell
$env:SITE_MODE = 'public'
$env:SITE_ORIGIN = 'https://ankey1.github.io'
$env:SITE_BASE = '/jinquan-space/'
npm run build
Remove-Item Env:SITE_MODE, Env:SITE_ORIGIN, Env:SITE_BASE
```

生成的 `dist/` 对应上述仓库项目站路径。无需购买域名；切换托管地址时更新 origin 与 base 并重新构建。

## GitHub Pages 准备步骤

首次公开发布已完成。后续维护沿用下列设置与手动发布过程：

1. 目标账号和仓库已确定为 `AnkeY1/jinquan-space`。上传前检查发布文件不含私人文件、凭证、测试中间目录或访客数据。
2. 按所选仓库的默认分支维护代码。`ci.yml` 默认监听 `main`；如果实际默认分支不同，应修改该触发器。部署工作流只接受默认分支的手动运行。
3. 在 Settings → Pages 将 Source 设为 GitHub Actions。本站输出普通静态目录，使用 `.github/workflows/deploy-pages.yml`，无需 Astro 服务端 adapter。GitHub 官方说明了自定义工作流与 Pages 环境的连接方式。[GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Astro 的 GitHub Pages 部署说明](https://docs.astro.build/en/guides/deploy/github/)。
4. 在 Settings → Secrets and variables → Actions → Variables 可配置 `SITE_ORIGIN=https://ankey1.github.io` 与 `SITE_BASE=/jinquan-space/`。前者是源站，后者是本次项目站的挂载路径；未设置或为空时，发布工作流使用这两个已确认值，非空仓库变量优先。
5. 检查 `github-pages` environment 的分支规则，按账户能力设置人工 reviewer。构建 job 只有源码和 Pages 读取权限，checkout 不保留凭据；部署 job 只在构建成功后取得 Pages 写权限和 OIDC 权限。独立CI只有源码读取权限。[官方权限与 environment 要求](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages#deploying-github-pages-artifacts)。
6. 当前已批准资料保留本站演示与简历模板标识。检查真实发布配置下的工具、下载、外链、简历打印和隐私说明，并检查相同修订的 CI。
7. 本次已获发布授权，可手动打开 Actions → Publish approved site to GitHub Pages，选择默认分支，勾选发布确认输入并运行。该工作流没有 `push`、`pull_request` 或 `workflow_run` 发布触发器；取消勾选会明确失败，不会发布。
8. 工作流通过后，使用 GitHub 返回的实际 URL 检查页面、`404.html`、搜索 JSON、示例、Worker、CSV/PNG 导出、canonical 和 sitemap。失败时保留日志，修复后重新手动发布。

后续版本的提交代码和运行 CI 不等于新的发布授权。首次发布成功也不能替代后续修订的实际工作流结果。

## 首发源码恢复已完成

首次发布使用已登录的 GitHub 网页创建发布工作流并上传 `source-upload.zip`。当时的临时引导对压缩包先完整校验，拒绝绝对路径、父目录跳转、`.git`、符号链接和特殊文件，跳过 `.github/workflows/`，再以 `github-actions[bot]` 恢复普通源码、删除 ZIP 并提交推送；首次发布已成功完成这一过程。

当前维护版工作流已移除该一次性 ZIP 引导和重复的前置确认步骤，将 build job 的 `contents` 恢复为 `read`，checkout 的 `persist-credentials` 恢复为 `false`。保留仓库与默认分支限制、手动确认输入、个人资料批准门禁、源码验证和独立部署 job。后续直接维护已恢复的正常源码，不再上传首发 ZIP，也无需额外访问令牌。

首次运行成功不等于这份收尾修订已经再次发布；远程最终文件与后续CI结果应以仓库和Actions实际状态为准。

## 自定义域名

域名注册、DNS、托管和证书是独立设置。先由站长确认并验证域名，再在 Pages 设置中添加域名，随后按照平台官方说明配置注册商记录，检查 HTTPS。子域名的 CNAME 指向账户的默认 GitHub Pages 主机，不含仓库路径。顶级域名使用供应商支持的 A、ALIAS 或 ANAME 等记录；具体值在操作当天复核。[GitHub 自定义域名与 DNS 说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。

本项目采用自定义 GitHub Actions 发布。该模式不会自动创建 `CNAME` 文件，既有 `CNAME` 也被 GitHub 忽略且并非必需；域名以 Pages 设置为准。不要照搬从分支发布的旧教程。[GitHub 关于两种发布源的明确说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain)。域名切换后更新 origin/base 并重新构建，详见 `MIGRATION.md`。

## CI 与 Action 固定版本

`ci.yml` 配置类型、lint、格式、单元、生产构建、浏览器、a11y、子路径、隔离公开模式、链接及资源检查，保留短期合成测试证据。独立完整CI已在修订`61e9432`通过，21个步骤全部Success，见[实际运行记录](https://github.com/AnkeY1/jinquan-space/actions/runs/38704918528)。发布工作流也已在GitHub runner完成资料门禁、源码检查/格式/单元验证、公开构建和Pages部署；两者分别记录，不将一次成功延伸到后续修订。安装浏览器需要网络。

2026-10-15 尝试对下列官方仓库运行 `git ls-remote`，直接访问 GitHub 443 连接失败或重置。因此通过官方 release 页面链接至完整 commit 页面核实以下 SHA；它们是选定的稳定发布，未宣称为所有仓库的最新 patch。更新时重新核对官方 release 和完整 SHA，同时重跑项目测试。

| Action / 选定版本           | 固定 SHA 与核对入口                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| checkout 6.0.0              | [`1af3b93b6815bc44a9784bd300feb67ff0d1eeb3`](https://github.com/actions/checkout/commit/1af3b93b6815bc44a9784bd300feb67ff0d1eeb3)              |
| setup-node 6.0.0            | [`2028fbc5c25fe9cf00d9f06a71cc4710d4507903`](https://github.com/actions/setup-node/commit/2028fbc5c25fe9cf00d9f06a71cc4710d4507903)            |
| configure-pages 5.0.0       | [`983d7736d9b0ae728b81ab479565c72886d7745b`](https://github.com/actions/configure-pages/commit/983d7736d9b0ae728b81ab479565c72886d7745b)       |
| upload-pages-artifact 4.0.0 | [`7b1f4a764d45c48632c6b24a0339c27f5614fb0b`](https://github.com/actions/upload-pages-artifact/commit/7b1f4a764d45c48632c6b24a0339c27f5614fb0b) |
| deploy-pages 4.0.5          | [`d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`](https://github.com/actions/deploy-pages/commit/d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e)          |
| upload-artifact 6.0.0       | [`b7c566a772e6b6bfb58ed0dc250532a479d7789f`](https://github.com/actions/upload-artifact/commit/b7c566a772e6b6bfb58ed0dc250532a479d7789f)       |

## 发布后实测表

| 检查                            | 此次状态 | 由站长或获授权人员补录                              |
| ------------------------------- | -------- | --------------------------------------------------- |
| 真实仓库 Pages 设置、发布工作流 | 通过     | `AnkeY1/jinquan-space`；发布 #1 Success；2026-10-15 |
| 默认 Pages 地址HTTPS访问        | 通过     | 无登录HTTPS请求40/40文件200；真实404正确            |
| 自定义域名与 DNS                | 未配置   | 当前使用默认GitHub Pages域名                        |
| 境内固定网络、移动网络          | 未执行   | 地区、运营商、设备、时间、页面结果                  |
| 境外网络                        | 未执行   | 地区、网络、时间、页面结果                          |
| iOS / Android 真机              | 未执行   | 系统、浏览器、工具与下载表现                        |

本地桌面模拟视口不能代替上述网络或真机测试，也不保证搜索引擎收录。
