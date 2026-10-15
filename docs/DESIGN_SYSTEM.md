# Design system

方向：个人作品集与技术编辑排版。蓝灰色底、深色正文、少量蓝色强调，原创工程线条图与可调正弦波作为识别元素。图形标为结构示意或数学合成。

## Tokens and layout

`src/styles/tokens.css` 是颜色、间距、圆角和布局尺度入口。浅色/深色取需求文档起点：bg #F6F8FA/#0D141D；text #172334/#E7EDF4；muted #526174/#AAB8C8；accent #175CD3/#84B7FF；control border #718198/#71849B。链接 hover、选中背景与 selection 独立定义。axe 在深浅关键页扫描，实际结果见测试报告。

字体为系统 UI 与 CJK 回退；代码使用系统等宽，不下载字体。正文16px、文章17px；主标题响应式，heading 使用 text-wrap:balance 减少孤字。默认行高1.7，正文1.85。

内容最大1184px，文章760px；工具双栏310px+结果，760px以下堆叠。桌面内边32px、手机20px、320px时16px。文章、代码与表格在自身容器处理长内容。

## Components and states

Layout 提供 header、真正的多页链接、skip link、三态主题、原生details移动菜单和footer。ToolShell 统一工作区；FilePicker/ProcessingStatus/FieldError/StatGrid/ChartPanel/ResultTable/ExportActions/PrivacyNote 提供可复用工具结构，CSV 页面作为复用示例。

按钮最小44px，明确hover/focus-visible/active/disabled状态；主色按钮局部只强调主操作。结果过期会提示并禁用导出；错误保留在工作区。图表由文字统计、分页表和下载补足，数据点不靠平滑曲线美化。

主题默认跟随系统，只白名单存储主题；图表监听同一主题事件，保留输入与视图。动效120–180ms；reduced-motion 关闭非必要运动。没有常驻波形动画。

## Visual review corrections

第一轮实际截图发现：logo文字布局换行、手机统计数字被拆开、文章标题尾部不平衡、CSV缺失后的单点不可见、320px说明标题孤字。已分别改为inline-flex、手机两列统计、平衡标题、仅孤立点marker与更合适字号。重拍截图位于evidence，未将截图生成本身当成通过依据。
