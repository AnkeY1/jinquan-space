# V1 交接

当前版本1.0.1，站长显示名为喻锦权。19个HTML页面、3篇原创功能说明、3个本站演示项目、两个本地文件工具、信号实验室、搜索、简历打印与隐私页已实现。站长已于2026-10-15明确授权公开发布当前版本，`publicProfileApproved`现为`true`。源码位于公开仓库[AnkeY1/jinquan-space](https://github.com/AnkeY1/jinquan-space)，网站已上线。

本次发布源站为`https://ankey1.github.io`，挂载路径为`/jinquan-space/`，正式网址为[https://ankey1.github.io/jinquan-space/](https://ankey1.github.io/jinquan-space/)。[首次发布工作流](https://github.com/AnkeY1/jinquan-space/actions/runs/38704126532)已确认Success（1分3秒，触发修订`15ce83f`）。无登录HTTPS复核40/40公开文件返回200、19HTML、sitemap16条、搜索索引9条、未知路由真实404；审查记录见`docs/evidence/online-publication-audit.json`。

## 运行

Node24.19.0、npm>=11；进入项目目录：

```text
npm ci
npm run dev
```

生产构建：`npm run build`；预览：`npm run preview`。完整验证：`npm run verify`；浏览器安装命令见README。开发工具引导目录不属于交付依赖，标准Node/npm即可复现。

## 维护入口

姓名/简介/方向/可选联系方式在`src/data/profile.json`；教育、经历和成果在`src/data/resume.json`。公开GitHub链接已设为`https://github.com/AnkeY1`，联系邮箱仍为`null`。目前真实经历区块为空，不从其他记录推断；公开版继续标明本站演示项目和简历资料模板。PDF未配置时隐藏下载按钮，网页模板仍可打印。

项目/文章在`src/content/`，新增内容无需改路由模板。主题与间距在`src/styles/tokens.css`；工具上限和实验参数有共享常量。完整字段和复制范例见CONTENT_GUIDE。

## 完成与证据

107个单元测试、30个Chromium E2E、14个axe扫描已通过；根与子路径、公开门禁/过滤、真实下载、离线计算、隐私和打印均有测试。WebKit核心9项通过。截图和紧凑JSON见`docs/evidence/`，详细范围与限制见TEST_REPORT。

发布工作流与独立完整CI均已在GitHub runner成功执行。[Validate static site](https://github.com/AnkeY1/jinquan-space/actions/runs/38704918528)经REST确认Success，修订`61e9432`，2026-10-15 16:20:09–16:22:24（Asia/Shanghai），21个步骤全部通过，包含Chromium浏览器旅程、axe、子路径与公开门禁检查；运行及步骤证据见`docs/evidence/github-actions-audit.json`和`github-actions-jobs-audit.json`。

收尾维护版部署工作流已移除首发ZIP恢复，build job恢复只读与不保留checkout凭据；本地YAML解析、门禁/权限静态断言及全项目格式检查已通过，远程文件由维护者同步。当前没有前端代码变更，因此本轮未重建`dist/`或重复执行算法套件。线上日志示例计算已实际观察通过；线上CUA下载事件捕获两次超时，未证实捕获到文件，本地和CI导出测试分别通过，范围说明见TEST_REPORT。

## 站长后续

1. 浏览本地版本，决定公开介绍、真实履历、联系方式和是否提供公开PDF；按需填写，空白不阻塞使用。
2. 确认代码与原创内容的对外许可证；第三方原许可证已保留。
3. 将本次收尾文档与证据同步到仓库；后续更改检查对应修订CI并按DEPLOYMENT手动发布，继续使用`SITE_ORIGIN=https://ankey1.github.io`和`SITE_BASE=/jinquan-space/`。
4. 在正常Firefox环境、真实手机和目标网络补测。当前Windows的Firefox组件启动失败有诊断证据，不需要为了运行网站修改系统。

不需要先买域名。源码和`dist/`可迁移到普通静态托管。网站已发布到默认GitHub Pages域名，未配置自定义DNS；访客文件仅在浏览器本地处理。指定地区运营商、真实手机和受阻的Firefox仍需补测。
