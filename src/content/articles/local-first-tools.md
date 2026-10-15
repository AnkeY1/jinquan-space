---
slug: local-first-tools
title: 为什么这些工具可以在浏览器中处理文件
summary: 页面从服务器加载，文件留在浏览器内存。沿着选择、Worker 计算、图表与导出，看看这条数据路径的边界。
tags: [浏览器, Web Worker, 隐私]
visibility: public
kind: demo
publishedAt: '2026-10-15'
relatedProjectSlugs: [csv-plotter, log-analyzer]
references:
  - title: 'MDN：Using files from web applications'
    url: https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications
  - title: 'MDN：Using Web Workers'
    url: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
  - title: 'Papa Parse：Documentation'
    url: https://www.papaparse.com/docs
---

## 两种流向，分开来看

访问网页时，浏览器先向托管服务请求 HTML、CSS、JavaScript 与图片。选择本地文件是另一步：浏览器把用户主动选中的文件对象交给页面代码。读取这个对象，并不自动产生一次上传请求。

本站的工具沿着一条明确的数据路径运行：选择文件 → 当前页的 Worker → 图表和分页表格 → 用户下载。项目没有接收文件的后端、统计 SDK 或错误上报服务。工具按实现限制处理你选中的文件，不扫描系统目录，也不从其他项目寻找数据。

## 浏览器读到的是什么

文件对象提供大小、名称与字节内容。工具先检查 10 MiB 上限，再按所选编码解码。默认严格 UTF-8，也可选择浏览器支持的 GB18030；解码失败会提示，不能把乱码当作成功读取。中文文件名只用于本地显示，不写入 URL 或请求参数。

日志解析器按行检查字段和真实日历日期。CSV 则交给成熟的 Papa Parse，处理引号内的逗号、换行与双引号。数值转换是另外一层：空文本不转成零，`12abc` 不截断为 12。文件格式正确与某个单元格是有效数值，是不同的判断。

## Worker 为什么有用

JavaScript 解析大文本时可能占用主线程，使输入和取消按钮不能及时响应。Worker 把解析与计算放到另一个执行环境，通过消息返回结果，页面线程继续处理交互。[MDN 的 Worker 指南](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)给出了两者通过消息通信的基本方式。

取消不能只向正在同步计算的 Worker 发一条“请停止”消息：它可能还没机会接收。本站从主线程终止当前 Worker，递增任务编号，新任务只接受对应的返回消息，避免旧结果覆盖新输入。

```text
托管服务 → 页面静态资源 → 浏览器
本地文件 → 页面 Worker → 完整结果 → 图表 / CSV / PNG
```

图表使用的抽样结果与完整结果分开，分页也只限制 DOM 展示数量。统计和下载依据完整数据，不能因为图表只画部分点，就把剩余记录丢掉。

## 为什么不保存上一次文件

本站只用 localStorage 保存主题偏好，不保存文件、结果、文件名或搜索历史。清空和离开页面会释放相应引用，刷新后需要重新选择文件。浏览器何时回收底层内存由运行时决定，因此释放引用不被描述为安全擦除。

下载的 CSV 和 PNG 会成为用户设备上的文件；主动复制的实验参数链接与搜索链接可能进入剪贴板、浏览器历史或分享记录。这些是另一个数据边界，搜索页也提示不要输入敏感内容。

## 本地处理也有规模上限

Worker 并不提供无限内存。浏览器仍需要保存解码文本、解析结果、图表数据与消息传递内容。本站限制日志候选记录、物理行与单行长度，也在 CSV 解析过程中检查行、列及单元格上限。大文件更适合电脑，手机仍可使用相同功能，但不承诺上限文件在所有设备都流畅。

页面所需资源已加载后，当前工具可以离线计算与导出；新页面与尚未下载的示例仍可能需要网络。本站不安装 Service Worker，也不把这一能力称为全站离线应用。

## 无后端与访问日志

网站应用没有上传所选文件的步骤，托管服务仍可能按其规则记录页面资源请求的 IP、时间和请求头。浏览器扩展与设备本身也有自己的权限范围。因此，具体的数据流说明比“绝无任何记录”的承诺更准确。

在[隐私说明](/privacy/)查看完整边界，或打开[数据绘图器](/tools/csv-plotter/)体验合成数据。这篇文章是本站功能的实现说明。
