# Coffee Extraction Calculator — PoC

这是基于 `poc.md` 的纯前端 PoC 页面（单一 HTML 文件），用于计算咖啡萃取率（EY）、推导咖啡液重以及在目标浓度下所需的 Bypass 水量。

文件
- `index.html` — 单文件前端，包含样式与交互逻辑。

快速使用
1. 在本地直接打开 `index.html`（双击或浏览器打开）。
2. 可将该文件推到 GitHub 仓库并启用 GitHub Pages（选择 main 分支 / root），即可在线访问。

说明要点
- 支持两种模式：粉水比模式（Dose + Ratio）与粉液比模式（Dose + Beverage）。
- 吸水系数：Drip=2.0，Espresso=1.5（PoC 固定值）。
- 数值格式：重量保留 1 位小数；浓度与萃取率保留 2 位小数。

若需我把页面拆分为独立的 CSS/JS 文件，或加上更详细的公式说明与导出功能，请告诉我。
