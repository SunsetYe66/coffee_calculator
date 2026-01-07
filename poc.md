Coffee Extraction Calculator – PoC
1. 项目目标（Purpose）

构建一个纯前端咖啡萃取率计算器，用于根据不同输入方式计算：

咖啡萃取率（Extraction Yield, EY）

咖啡液重 / 水量（在特定模式下自动推导）

在指定目标浓度（TDS）下所需的 Bypass 加水量

该页面应可直接部署在 GitHub Pages（无后端、无构建依赖亦可）。

2. 页面形态与技术约束
2.1 技术约束

纯前端

HTML + CSS + JavaScript

不依赖后端 API

可选但非必须：

Vanilla JS

或单文件 React（无 build，仅 CDN）

可直接部署到 GitHub Pages

2.2 页面结构（建议）

Mode 切换（Tab / Radio）

☑ 咖啡粉水比模式

☑ 咖啡粉液比模式

输入区

计算结果区

Bypass 目标浓度区

公式说明 / 提示区（PoC 可简略）

3. 核心概念与统一变量定义
变量	含义	单位
dose	咖啡粉量	g
water	注水量	g
beverage	最终咖啡液重	g
ratio	粉水比（如 1:15 → 15）	number
tds	咖啡浓度	%
ey	萃取率	%
absorption	粉吸水系数	g/g
4. 模式一：咖啡粉水比模式（Dose / Brew Ratio Mode）
4.1 输入项

咖啡粉量 dose（g）

粉水比 ratio

冲泡种类 brewType

Drip

Espresso

咖啡浓度 tds（%）

4.2 固定规则（业务逻辑）
冲泡方式	粉吸水系数
滴滤（Drip）	2.0 × 粉量
Espresso	1.5 × 粉量
absorbed_water = dose * absorption

4.3 推导公式
water = dose * ratio
beverage = water - absorbed_water

4.4 萃取率计算
ey (%) = (beverage * tds) / dose

5. 模式二：咖啡粉液比模式（Dose / Beverage Mode）
5.1 输入项

咖啡粉量 dose（g）

咖啡液重 beverage（g）

咖啡浓度 tds（%）

5.2 萃取率计算
ey (%) = (beverage * tds) / dose


该模式 不涉及粉吸水假设，更贴近折射仪实测数据。

6. 目标浓度 & Bypass 计算（两种模式通用）
6.1 输入项

目标浓度 target_tds（%）

6.2 计算逻辑

假设：

当前液重：beverage

当前浓度：tds

当前溶解固体总量保持不变

total_solids = beverage * tds
target_beverage = total_solids / target_tds
bypass_water = target_beverage - beverage

6.3 输出

目标液重（g）

需要 bypass 的水量（g）

7. 输出结果区（PoC 级别）
7.1 必须显示

萃取率（EY，%）

咖啡液重（如由系统推导）

Bypass 水量（g）

7.2 可选显示（增强理解）

使用的吸水假设

当前配方摘要（如：20g / 1:15 / Drip）

8. 交互与 UX 要求（简化版）

所有计算为 即时响应

输入非法值时：

不计算

显示轻量提示

单位全部为 克 / 百分比

数值保留：

重量：1 位小数

浓度 / 萃取率：2 位小数

9. 非目标（Out of Scope）

不涉及账户 / 存储

不涉及多语言

不涉及历史记录

不涉及真实折射仪校正模型

10. 成功标准（PoC Done）

两种模式均可正常计算萃取率

Bypass 目标浓度计算正确

单一 HTML 文件即可运行

可直接部署至 GitHub Pages 并访问
