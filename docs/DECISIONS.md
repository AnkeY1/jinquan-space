# Implementation decisions

1. **Local development only.** 用户要求开发，规格明确未授权发布，因此使用 Sites 的本地流程，不注册云 Site、不推送或部署。Astro 与纯静态 dist 可独立迁移。
2. **Versions verified 2026-10-15.** Node24.19.0；Astro7.3.8稳定版；TS6.0.3因检查器与ESLint peer范围选择，未使用不兼容的最新TS7。版本与许可记录在DEPENDENCIES。
3. **Astro7 Markdown.** 显式采用官方`@astrojs/markdown-remark`的unified处理器，在构建期删除raw HTML、校验标题/链接并统一添加base。Content Collections使用glob、id/data与render API，不混用旧entry.slug。
4. **Inline module Workers.** 采用Vite官方`?worker&inline`导入形式。Worker代码按工具进入，终止后可在已加载页面离线重新创建；不依赖HTTP缓存或Service Worker。原规格允许受构建器支持的等价方式。taskId与terminate取消行为保留。
5. **Original diagrams.** 项目封面使用原创流程/曲线结构图，并显式标示；不生成虚构工具截图或真人头像。profile为唯一身份数据源。
6. **Shared presentation.** 工具用共享壳层、tokens、统计、导出、chart与TaskRunner；CSV额外演示完整8个工具展示组件。不同工具的计算与状态控制器保持独立。
7. **License notices.** Vite build.license开启；Astro当前输出流程未保留可见license文件，因此另提供可复现的generate-notices脚本，保留实际客户端ECharts/NOTICE、zrender、tslib与PapaParse原文。没有授予用户所有内容统一许可。
8. **Budget accounting.** 按产物解析静态导入与动态import依赖图，同时计入内联JS；内联Worker已包含于工具entry。预算为逐资源gzip之和，不用裸文件大小替代。Vite提示图表chunk裸大小超过500kB，实际按工具gzip在450KiB门槛内，不关闭告警掩盖它。
9. **Public-mode isolation.** 公开构建测试复制任务内源文件并使用合成身份与批准字段，正式profile一直false。预览sitemap路由根本不注入；公开sitemap排除搜索、简历、404和不可见内容。
10. **Verification limits.** 不假定已做真机、屏幕阅读器、全球网络或线上响应头测试；具体执行状态只在TEST_REPORT记录。
11. **v1.0.1 name correction.** 根据站长最新明确纠正，姓名统一为“喻锦权”。页面标题、导航辅助标签、页脚、关于与简历引用profile；首页/关于字标由姓名生成，favicon使用原创波形。主题键与事件统一为jinquan命名，修订版归档使用Jinquan Space。旧版验证日志保留为历史证据，不改写已发生的测试记录。
