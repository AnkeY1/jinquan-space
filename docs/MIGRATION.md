# 更换域名、路径与托管平台

本站使用 Astro 静态输出，部署产物为 `dist/`。不依赖服务端适配器、数据库、平台函数、账户登录或上传 API。两个文件工具及信号实验在访客浏览器内计算；更换托管时保留普通静态资源与脚本即可。

## 根路径和项目路径

`SITE_ORIGIN` 只保存协议和主机，`SITE_BASE` 保存站点路径。所有内部链接、搜索索引、样例资源和可分享参数都通过公共 URL 层适配 base。Worker 内联到工具代码，由浏览器创建，页面资源加载后重新计算也不依赖请求原始 Worker 文件。

| 部署变化                   | 应调整                                                |
| -------------------------- | ----------------------------------------------------- |
| 从根站点迁到仓库项目站     | origin 改为实际 Pages 主机，base 改为实际 `/仓库名/`  |
| 从项目站迁到独立域名根目录 | origin 改为新 HTTPS origin，base 改为 `/`             |
| 域名相同而更换供应商       | origin/base 可保持，重建并将完整 `dist/` 上传到新平台 |
| 同一域名改到子目录         | 只修改 base；确认服务器把该路径映射到产物根目录       |

这些配置会影响静态 HTML 中的 canonical、Open Graph、资源与搜索地址，以及公开 sitemap；修改后必须重建。不要仅把以前构建的 HTML 移到另一条路径。[Astro 的 site/base 部署要求](https://docs.astro.build/en/guides/deploy/github/)。

## 可复现迁移流程

1. 保留源码、`package-lock.json`、当前修订、原 origin/base 与一份已验证的旧产物。不要打包 `node_modules`、真实环境变量、私人输入文件或未知日志。
2. 在新环境安装 Node.js `24.19.0`，执行 `npm ci`。保持预览模式检查站点，确认新托管支持目录型 `index.html`、正常静态 MIME、JSON、下载文件及正确的 `404.html`。不要把每个未知 URL 重写为首页的 SPA 模式。
3. 填入实际新 origin/base；个人公开批准与内容生命周期继续有效。重新运行 `npm run verify`、`npm run test:basepath` 和 `npm run test:public`，然后以目标配置重新构建。测试脚本使用隔离目录，不应修改正式 profile 批准字段。
4. 获得发布授权后，将完整 `dist/` 作为静态目录部署。逐一检查工具 Worker、示例下载、搜索、高亮、图表、CSV/PNG、隐私页、简历打印、404、canonical、robots 与 sitemap。资源路径不能仅在首页正确。
5. 需要换域名时，先配置新托管的域名归属与 HTTPS，再按供应商要求更改 DNS。源站设置和 DNS 记录分别核对。GitHub Actions 模式的域名设置以 Pages 面板为准，`CNAME` 文件被忽略且非必需。[GitHub 官方域名说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。
6. 若需将旧网址导向新网址，在仍能控制的旧托管或代理配置真实 HTTP 重定向，保留具体文章/工具路径。本站没有后端，无法仅靠一段 Astro 源码为所有旧域名返回服务器重定向。旧平台不支持时，明确记录替代方式与限制。
7. 检查新域名的 HTTPS、DNS、访问网络和实际移动设备，更新站长认可的公开外链。保留可回退的旧产物；回退同样需要明确授权的发布动作。

## 对一般静态托管的要求

- 发布目录：`dist/`；构建命令：`npm ci` 后 `npm run build`。
- 运行变量：真实 `SITE_ORIGIN`、目标 `SITE_BASE`、已批准后才可使用的 `SITE_MODE=public`。
- 支持 `.html`、`.js`、`.css`、`.json`、`.log` 与 PNG 等普通文件，允许浏览器运行本站脚本和内联 Worker。若额外设置 CSP，先验证 Blob Worker 等实际使用的能力，不盲目启用会阻断工具的模板策略。
- 采用正常 HTTPS；未确认 PDF 和外链保持隐藏。预览模式继续使用 noindex；noindex 不能提供访问控制。
- CDN 缓存对带内容散列的 `_astro` 资源可长缓存；HTML 与搜索 JSON 应保证发布后及时刷新，避免旧 HTML 引用已删除的资产。

本交付没有选择新的付费平台，也没有变更任何实际 DNS。若以后引入云端计算、统计或上传功能，必须同时修改隐私说明、许可与数据生命周期，不能继续沿用“输入仅在浏览器本地处理”的承诺。
