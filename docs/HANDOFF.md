# V1 交接

当前版本1.0.1，站长显示名为喻锦权。19个HTML页面、3篇原创功能说明、3个本站演示项目、两个本地文件工具、信号实验室、搜索、简历打印与隐私页已实现。站长已于2026-10-15明确授权公开发布当前版本，`publicProfileApproved`现为`true`。公开仓库[AnkeY1/jinquan-space](https://github.com/AnkeY1/jinquan-space)已创建；线上部署尚未确认完成。

本次发布源站为`https://ankey1.github.io`，挂载路径为`/jinquan-space/`，目标网址为[https://ankey1.github.io/jinquan-space/](https://ankey1.github.io/jinquan-space/)。仓库创建和本地公开构建均不等于网页已经上线。

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

## 站长后续

1. 浏览本地版本，决定公开介绍、真实履历、联系方式和是否提供公开PDF；按需填写，空白不阻塞使用。
2. 确认代码与原创内容的对外许可证；第三方原许可证已保留。
3. 按DEPLOYMENT完成已获授权的仓库上传、Pages变量与发布工作流；配置`SITE_ORIGIN=https://ankey1.github.io`和`SITE_BASE=/jinquan-space/`，待工作流成功后检查实际线上地址。
4. 在正常Firefox环境、真实手机和目标网络补测。当前Windows的Firefox组件启动失败有诊断证据，不需要为了运行网站修改系统。

不需要先买域名。源码和`dist/`可迁移到普通静态托管。公开仓库已创建；访客文件仅在浏览器本地处理。当前交接记录尚未确认线上部署成功。
