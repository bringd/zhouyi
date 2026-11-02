# 三套外观验收工具：独立审核（2026-11-02）

**结论：这一轮不能宣布 P2 关闭。** 原先四档深底的数值回归已修复，454 通过的汇总也能重现；但真实 DOM 中仍能构造出明确的假通过。最直接的一例是 `opacity:.65` 的黑字灰底：实际字芯 **2.9225:1**，脚本报 **4.67:1**，按正文阈值 4.5 判通过。白色伪元素文字压白底也会报 **21:1**。

本次没有发现需要新列为 P1 的已证实问题。以下列出 **9 项 P2、4 项 P3**；不把环境无法取得前台焦点当成业务页面缺陷，也不把未重现的旧运行记录认定为造假。

## 审核范围、方法和证据

只审核指定的三个脚本、返工报告 §11、实现报告有关段落。为核实 §11.3，额外只读了同源代理、前端 API 路径及 2026-10-26 发布记录和已有证据，没有重新写入生产数据。

- 已读 `git diff -- scripts/contrast-appearances.mjs scripts/zoom-real-200.mjs`，全读新边界脚本。工作树原有改动保留；没有修改任何已有 `scripts/`、`docs/` 文件或业务文件，没有 commit/push/deploy。
- [证据目录](../../tmp/codex-audit-20261102/) 中保存日志、JSON、四张截图、HTML 反例和复现脚本。[manifest.json](../../tmp/codex-audit-20261102/manifest.json) 记录审核对象 SHA-256；`snapshot/` 保存审核时的五份源文件。
- DOM 反例从实际源文件用 TypeScript AST **原样提取函数**，在本机 `:9222` Chrome 的独立临时页面调用实际 `measureElement` 和 `analyzePair`。没有重新实现被审算法。反例的 HTML 和截图均已保存，临时页面测完关闭。
- 稳定性反例在已完成的截图之间安排真实 DOM 位移/真实 Web Animation，明确控制时序；不是声称某生产页面必然出现相同的竞争条件。算法、截图函数和通过判定未改动。
- 缺失 fixture 测试是在 VM 中只令 `existsSync` 返回 false，截获写文件和退出，不移动、不删除他人的 `tmp` 文件。与实际像素核对分开记录。

下文命令均从 `D:\eight` 执行。复现环境仍需 Vite `:5173` 和 Chrome CDP `:9222`。Worker `:8787` 未启动没有作为失败依据。

## D：三项命令的实际结果

| 执行项 | 结果与证据 |
|---|---|
| `node scripts/contrast-edge-cases.mjs` | **退出 0**；四档 1.66 / 1.02 / 1.01 / 1.00，最弱点均 `(271,25)`。[日志](../../tmp/codex-audit-20261102/edge-cases.log)、[JSON](../../tmp/codex-audit-20261102/edge-cases.json)。但其掩膜推导和可移植性有缺陷，见 P2-07/08。 |
| `$env:DSH_OUT='screenshots/codex-audit-20261102/contrast'; node scripts/contrast-appearances.mjs` | **等待正常结束，退出 0**；458 个非汇总元素 = **454 通过 / 0 失败 / 4 豁免 / 0 未覆盖**。非豁免最低 **4.83:1**，青岚起卦按钮「启 卦」。[完整日志](../../tmp/codex-audit-20261102/contrast-full.log)、[完整报告](../../tmp/codex-audit-20261102/contrast-full.json)、[摘要](../../tmp/codex-audit-20261102/contrast-result-summary.json)。没有因预期耗时而中断。 |
| `node scripts/zoom-real-200.mjs`（只设置独立产物目录） | 原命令**退出 1**：`:9333` CDP 未就绪，尚未进入矩阵。[run1 日志](../../tmp/codex-audit-20261102/zoom-run1.log)。不能据此判断页面布局失败。 |
| 保留原测量/判定代码、处理 Chrome 启动环境后再跑两次完整缩放矩阵 | **两次都完整测量 54/54，退出 1**：`realZoomVerified:false`，`atRequestedWidth:0`，`platformLimited:54`，失败为 `real-zoom-not-verified=1`，不是页面断言失败。[run4 日志](../../tmp/codex-audit-20261102/zoom-run4.log)、[run4 JSON](../../tmp/codex-audit-20261102/zoom-run4.json)、[run5 日志](../../tmp/codex-audit-20261102/zoom-run5.log)、[run5 JSON](../../tmp/codex-audit-20261102/zoom-run5.json)。 |

缩放环境补充：独立启动探针记录 Chrome GPU 沙箱进程 `exit_code=-1073741790`，随后 `GPU process isn't usable`；9333 还出现 IPv4 `bind()` 访问被拒绝，只监听 IPv6。于是后续明确设置真实 Chrome 路径、用脚本支持的 `DSH_ZOOM_CDP=9334`，并通过临时 [chrome-bootstrap.mjs](../../tmp/codex-audit-20261102/chrome-bootstrap.mjs) **仅给 Chrome 增加 `--no-sandbox` 启动参数并记录 stderr**。没有修改缩放算法、页面状态、缩放值或最终判定。

两次完整补充运行的命令如下，产物目录分别为 `zoom-run4` / `zoom-run5`：

```powershell
$env:DSH_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:DSH_ZOOM_CDP='9334'
$env:DSH_OUT='screenshots/codex-audit-20261102/zoom-run5'
node --import ./tmp/codex-audit-20261102/chrome-bootstrap.mjs scripts/zoom-real-200.mjs
```

原生按键阶段每次均为 `NOT_FOCUSED`，日志包含 `FOREGROUND:0 TARGET:15539154`（第二次的句柄不同）；CDP 按键和 Preferences 路径也未产生浏览器缩放，最终降级为设备像素比模拟。脚本**正确拒绝**该降级，未把它记成真实缩放通过。这两次运行不能替代一次成功的原生 200% 取证。

七项内置自检的本次输出与文档一致：

```text
#333333 -> 1.66，最弱点 (262,27)
#030303 -> 1.02，最弱点 (262,27)
#010101 -> 1.01，最弱点 (262,27)
#000000 -> 1，最弱点 (262,27)
白底黑字 -> 21
多色后代 -> 2.81
opacity 0.2 -> 1.61
自检通过
```

## P1

本轮审核没有证实新增 P1。历史跨站 cookie 阻断的文档状态已经过时，见 P3-03；不能由该旧描述继续推导当前生产不可保存。

## P2

### P2-01：把组 opacity 再合成到已合成的背景，能把不合格文本算合格

**位置：** `scripts/contrast-appearances.mjs:357`、`:865`、`:883`、`:886`。

**复现：** `node tmp/codex-audit-20261102/dom-probes.mjs`（或设置 `AUDIT_EXTRA=1` 只跑补充组），随后 `node tmp/codex-audit-20261102/pixel-stats.mjs`。

目标是白色页面上的 `font-size:16px; color:black; background:#777; opacity:.65`。实际输出：

```text
opacity-group: status=measured, ratio=4.67, need=4.5, ok=true
weakestFg=(58.1,58.1,58.1), weakestBg=(166,166,166)
像素复核：108 个 mask alpha>=0.9 的字芯均为 A=88、B=166
字芯实际 contrast(88,166)=2.9225134795460157
```

[日志](../../tmp/codex-audit-20261102/extra-dom-probes.log)、[像素核对](../../tmp/codex-audit-20261102/pixel-stats.json)、[HTML](../../tmp/codex-audit-20261102/opacity-group.html)。

**为何是缺陷：** CSS 组透明度把文字和元素自身背景作为一组叠到外部底色上。B 已经是合成后的背景；再做 `opacity*color + (1-opacity)*B`，相当于把错误的底色又引入一次。此例误算出更深的前景，越过 4.5 门槛。七项自检的 opacity 用例只提供白底 canvas 和一个数值 opacity，不能验证真实 CSS 组透明度。

**建议：** 按真实绘制/分组层级求前景与背景的最终合成结果，区分文字 color alpha 和元素组 opacity；暂不支持的组合应明确未覆盖。加入本例及祖先透明度、非透明自身背景的 DOM 回归，不能只增加 canvas 参数用例。

### P2-02：伪元素和 text-fill 的真实字色没有进入片段模型

**位置：** `scripts/contrast-appearances.mjs:371`、`:377`、`:400`、`:524`、`:600`。

**复现命令：** `node tmp/codex-audit-20261102/dom-probes.mjs`；`node tmp/codex-audit-20261102/pixel-stats.mjs`。

```text
pseudo-only: ::before{content:'MMMM';color:white}，父 color:black，白底
  ratio=21, need=3, ok=true
text-fill: color:black; -webkit-text-fill-color:white，白底
  ratio=21, need=3, ok=true
两例均：A/B 差异像素=0，掩膜字芯=725，实际字芯 ratio=1
pseudo-generated: 正常黑字 + 白色 ::after 文字，ratio=21, ok=true
```

[日志](../../tmp/codex-audit-20261102/dom-probes.log)、[像素核对](../../tmp/codex-audit-20261102/pixel-stats.json)。

**为何是缺陷：** TreeWalker 不包含生成内容；纯伪元素目标会回退为整个父盒的 `color`，有真实文本节点时生成内容通常又落在片段外，直接被忽略。`-webkit-text-fill-color` 则被掩膜强制成黑色，但原画面取色仍只取 `color`，B 也没有清掉 text-fill。两条路径均已出现“掩膜认出了字，计算却使用错误前景”的假通过。

**建议：** 为 `::before/::after` 建立独立的内容、计算色、几何和透明度记录；取真正参与绘制的 fill，并完整清除文字绘制通道以获得 B。无法安全取得几何/字色时明确未覆盖，不能用父色代替。

### P2-03：受控样式没有保证全部字形被保留，局部掩膜丢字仍会整体通过

**位置：** `scripts/contrast-appearances.mjs:600`、`:604`、`:605`、`:813`、`:860`、`:1109`。

**复现命令：** `AUDIT_EXTRA=1` 下运行 `node tmp/codex-audit-20261102/dom-probes.mjs`。以下三个真实 DOM 反例均输出 `ratio=21, need=3, ok=true`：

| 用例 | 被漏掉的文字及实际原因 |
|---|---|
| `inline-important-background` | 正常黑字之后接 `<span style="background-color:black!important">MMMM</span>`；内联 important 背景胜过掩膜样式表的 important，黑底未变白，后半黑字落点消失，实际 1:1。 |
| `overlay-partial` | 黑字跨白/黑渐变，右侧有 10% 白色 `::after` 遮罩；原画面右侧字与底同为遮罩合成后的灰色，实际 1:1。掩膜把遮罩改成不透明白色，遮掉右侧文字，仅剩左侧高对比字形。 |
| `filter-descendant` | 后代本来是白底黑字，带 `filter:contrast(0)`，其字与底都成为相同灰色，实际 1:1。掩膜没有处理 filter，两张掩膜在该片段相同，只有前面的正常黑字被统计。 |

[补充日志及完整 HTML](../../tmp/codex-audit-20261102/extra-dom-probes.json)。

**为何是缺陷：** 当前只要求全目标存在一些可测落点。一个片段或区域全丢了，不会变成未覆盖；剩下的高对比文本足以让整个元素通过。这正是原始 P2 的“只看到容易看见的一侧”的另一条路径，不能仅用四个灰底 canvas 用例证明已消除。

**建议：** 控制样式必须处理层叠优先级、实际遮挡和 filter/blend 组合，并验证每个待验文本片段的覆盖完整性。不能直接把所有伪元素/后代背景涂成不透明白色；暂不支持的渲染组合应阻断该项通过，不能忽略局部片段。

### P2-04：obstacle 的整个外接矩形会排除实际位于图标前面的可见文字

**位置：** `scripts/contrast-appearances.mjs:407`、`:410`、`:824`、`:876`。

**复现命令：** 补充 DOM 组及 `pixel-stats.mjs`，查看 `svg-overlap-front-text`。

透明空 SVG 在 `z-index:0`，文字在 `z-index:1`，右侧黑字压黑底。输出：

```text
ratio=21, need=3, ok=true
obstacle={x:100,y:0,w:500,h:60}
掩膜已识别 4810 个 >=0.5 落点，最终片段只计入 890 个
掩膜字芯中存在 2972 个 A=0、B=0 的真实 1:1 落点
```

[DOM JSON](../../tmp/codex-audit-20261102/extra-dom-probes.json)、[像素 JSON](../../tmp/codex-audit-20261102/pixel-stats.json)。

**为何是缺陷：** “替换元素不是文本”不等于“其整个外接矩形内没有待验文字”。透明区域、空 SVG、文字叠在图片上等情形均违反这一假设。本例掩膜已经认出低对比字，却被 `blocked()` 无条件删除。

**建议：** 只排除替换元素自身的绘制像素，并考虑层叠与真正遮挡；或限定为确认不与文字重叠的图标盒。重叠而无法判定时应记未覆盖。

### P2-05：截图稳定性防护既漏检，也没有真正阻断不稳定结果

**位置：** `scripts/contrast-appearances.mjs:647`、`:1009`、`:1016`、`:1028`、`:1035`、`:1045`、`:1086`、`:1124`、`:1485`、`:1492`。

**复现：** `node tmp/codex-audit-20261102/stability-probes.mjs`。

```text
parent-drift: before.x=30 -> after.x=90，8 张截图（已重试）
  status=measured, ratio=21, ok=true, settled=true, unsettled=true, drift=true
parent-drift-once: 30 -> 60，第二组已稳定，仍 unsettled=true, drift=true
descendant-animation: 父盒 before/after 完全相同，4 张截图
  黑底上的后代仅在 M1/M2 阶段移到白底，之后恢复
  status=measured, ratio=21, ok=true, settled=true，无 drift 标记
```

[日志](../../tmp/codex-audit-20261102/stability-probes.log)、[详细状态及 HTML](../../tmp/codex-audit-20261102/stability-probes.json)。

**为何是缺陷：**

1. 文档称每张截图前冻结，实际 `captureOnce()` 仅在 A 前调用一次 `freezeAnimations()`；M1/M2/B 前都没有。
2. `readState` 只检查目标外盒、目标 color 和祖先 opacity，不检查后代片段、字体、文字内容、滚动位置或背景。后代往返移动和中间阶段的变化可以完全不留痕。
3. 重试没有重取 `before`，仍与第一次快照比较，造成第二组稳定也被标不稳定。
4. 即使明确得到 `unsettled/drift`，`ok` 仍只比较 ratio，主流程照常计 pass；输出只存 `settled`，并不保存这两个告警。文档“仍不一致不当成通过依据”不成立。

**建议：** 每次尝试重新准备几何和独立基准，在每张截图前冻结并校验实际待验片段及布局/滚动状态，必要时在 mask 状态下验证几何。任何漂移、未稳定或不完整取证必须进入失败/未覆盖门禁，并在最终报告保留原因。

### P2-06：scale 缩小后的普通文字仍套用原字号的大字门槛

**位置：** `scripts/contrast-appearances.mjs:460`、`:1112`、`:1114`、`:1117`。

**复现命令：** DOM 基础组，查看 `scaled`：`font-size:32px; font-weight:400; transform:scale(.5); color:#888; background:white`。

```text
截图为 300×33（原布局盒 600×65）
实际显示字号 16px，实际对比度 3.5448862152994
ratio=3.54, need=3, ok=true
```

[日志](../../tmp/codex-audit-20261102/dom-probes.log)、[像素核对](../../tmp/codex-audit-20261102/pixel-stats.json)。

**为何是缺陷：** 本例字形坐标没有错位，错的是判定门槛：computed font-size 仍是 32px，缩小后的正文应该按 4.5 判失败。仅检查目标字号也不足以覆盖不同字号的后代。

**建议：** 按每段文字的实际呈现字号和字重选择阈值，并计入目标及祖先 transform 的影响；无法可靠换算的 transform 应明确未覆盖。

### P2-07：新增边界回归不自包含，干净检出无法复测

**位置：** `scripts/contrast-edge-cases.mjs:27`、`:117`；返工报告 `:709`。

**实际命令：** `git check-ignore tmp/release-acceptance-20261023/contrast-rasters.json` 返回该路径，说明它是忽略文件；`node tmp/codex-audit-20261102/raster-probes.mjs` 模拟仅该路径不存在：

```text
缺少复验方的原始栅格 tmp/release-acceptance-20261023/contrast-rasters.json
cases=[], ok=false, exitCode=1
```

[证据](../../tmp/codex-audit-20261102/raster-probes.json)。本机原文件存在时退出 0，已在 D 节列明；不是把模拟缺文件的结果冒充本机直接运行结果。

**为何是缺陷：** 新增的回归入口依赖他人机器上不入库的临时证据，既没有 fixture，也没有生成步骤。复验方仅拿仓库无法执行文档命令。这不是算法错误引起的失败，降低了回归门禁的可重复性。

**建议：** 把有来源/哈希说明的固定栅格和独立掩膜作为小型 fixture 入库，或提交确定性生成器；支持显式外部证据路径作为额外复验输入。

### P2-08：复制左半并非原始栅格的右半字形，回归有“数值碰巧正确”的风险

**位置：** `scripts/contrast-edge-cases.mjs:79`、`:91`、`:94`、`:127`、`:182`。

**复现：** `node tmp/codex-audit-20261102/raster-probes.mjs` 对原始 RGBA 逐像素核对。`#333333` 那档：

```text
5547 个 RGB 通道与“左半平移后按 51/255 合成”的预测不符，最大误差 51
右侧核心字形漏掉 746 个像素，额外标入 608 个像素
例：(289,25) 的对应左像素=255，实际右像素=0
按复制假设预测右像素应为 51，掩膜却在这里完全没有字
```

[逐像素核对](../../tmp/codex-audit-20261102/raster-probes.json)，原栅格副本及哈希在证据目录。

**为何是缺陷：** 实际字形不满足“左右两半完全相同、仅平移 W/2”。现在右侧背景整片恒定，即使把一些字形映射到错误位置，仍会取到同一个 51/3/1/0，所以四个正确比值不能验证掩膜正确性；黑底档本来更无法从 A/B 反推真实字形。

“非白即字会不会把抗锯齿误判成核心字形”：**本例没有证实该问题。** `<250` 只去掉覆盖率不足约 0.02 的边缘，本批有 17 个这样的右侧复制像素；后续仍要求 alpha≥0.5，不会仅因此变成核心字形。真正的问题是字形不一致，不是这 17 个浅边缘。

**建议：** 用独立、与 A/B 同字形同坐标生成的 M1/M2 fixture，验证位置/覆盖率后再验证比值；加入空间变化背景，避免恒定背景把错误掩膜掩盖掉。

### P2-09：真实缩放的门禁只守住“至少 150%”，物理窗口证据还允许缺失

**位置：** `scripts/zoom-real-200.mjs:633`、`:635`、`:742`、`:793`、`:798`、`:803`。

**复现：** `node tmp/codex-audit-20261102/zoom-logic-probes.mjs` 原样执行最终自证片段和窗口查询函数：

```text
native-keyboard: baseline dpr=1, innerWidth=1440, outerWidth=1440
zoomed dpr=1.5, innerWidth=960, outerWidth=1440
effectiveZoomPercent=150, isRealBrowserZoom=true, verified=true
窗口查询失败返回 null -> native 条件 acceptsMissingBounds=true
同样输入若 kind=device-scale-factor -> verified=false
```

[日志](../../tmp/codex-audit-20261102/zoom-logic-probes.log)。这是直接执行真实判定代码的状态输入测试，不冒称本机成功产生了原生 150% 或 200% 缩放。

**为何是缺陷：** 原生循环以 1.9 倍为目标，但最终只需 1.5 倍，按键部分成功后失败即可留下 150% 的“已验证”；Preferences 更允许 1.5～2.5 倍。矩阵随后仍按 `cssWidth*2` 设置窗口，不能称为 200% 验收。物理 bounds 缺失时 `physicalDelta===null` 反而放行，与文档的必备条件不一致。最终汇总又回到 `outerWidth`，也未统一使用新加的 bounds 证据。

**建议：** 真实缩放和“目标为 200%”分别验证；为 2.0 倍设明确容差，所有策略/每次重启及矩阵测量都复核。窗口证据缺失须未验证；使用同一实例、同一 target 的前后 bounds，并把该证据纳入最终门禁。

## P3

### P3-01：滚动后把 viewport 坐标当成文档截图坐标

**位置：** `scripts/contrast-appearances.mjs:313`、`:432`、`:1015`、`:1020`。

**复现：** DOM 基础组 `scroll`：实际元素文档 y=930，`scrollY=325`，`getBoundingClientRect().y=605`，四张图都按 clip.y=605 截取。输出 `status=no-text`，但文字可见且是白底黑字。[完整几何](../../tmp/codex-audit-20261102/dom-probes.json)。

**为何是缺陷：** 四张图彼此同坐标也可能一起截错区域。`captureBeyondViewport:true` 不会自动把 viewport 坐标转换成元素的文档坐标。此例被保守地记成未覆盖，未出现假通过，因此列 P3。

**建议：** 统一截图坐标系，显式结合页面布局视口/滚动偏移求 clip，固定元素单独校验；将滚动状态纳入稳定性检查。

### P3-02：有原始 value 的输入框测完被清空

**位置：** `scripts/contrast-appearances.mjs:325`、`:330`、`:554`、`:559`。

**复现：** 补充 DOM 组 `input-existing-value` 原本 `value="KEEP ME"`，输出 `ok=true`，但 `valueAfter=""`。[日志](../../tmp/codex-audit-20261102/extra-dom-probes.log)。

**为何是缺陷：** 仅在原值为空时保存 `data-pc-old-value`，释放时却无条件用该属性或空串恢复。审核工具会改变输入内容，可能影响后续测量；不是原样恢复。

**建议：** 每次准备都保存原值，并只恢复自己真正改过的字段；重试避免覆盖原始快照，清理放入 finally。占位符另见 A 的核对表，不把测到的 value 对比度算作 placeholder 覆盖。

### P3-03：文档发布状态和部分算法说明与当前证据不一致

**位置：** 返工报告 `:568`、`:571`、`:660`、`:689`、`:704`、`:712`；实现报告 `:547`、`:640`、`:731`；脚本 `scripts/contrast-appearances.mjs:1324`、`:1350`。

**可复现证据：** `node tmp/codex-audit-20261102/repo-facts.mjs`、`node tmp/codex-audit-20261102/raster-probes.mjs`、`node tmp/codex-audit-20261102/consistency-probes.mjs`：

```text
2026-10-26 保存的生产证据：createdStatus=201, foundInSameSession=true,
deletedStatus=204, goneStatus=404, hostOnly/httpOnly/secure/sameSiteLax=true,
crossSiteWriteRejected=true, meStatus=404
当前代理：转发 session、移除 cookie Domain、拒绝跨站写入均存在
原 #010101 栅格右半实际差异像素=1171；#000000 右半才是 0
模拟自检失败：exitCode=1，但 writes 包含 contrast-appearances.json
实际 JSON metrics.weakestRatio 仍写旧公式 |P-B|/|C-B|
```

[仓库事实](../../tmp/codex-audit-20261102/repo-facts.json)、[自检失败分支及内联恢复](../../tmp/codex-audit-20261102/consistency-probes.json)。

**为何是缺陷：**

- §11.3 将历史跨站 cookie 问题写成当前“仍未处理、应暂停发布”，与当前 `functions/_middleware.ts` 同源入口和 2026-10-26 发布证据冲突。此处核实的是代码及已有发布证据，没有声称本次重新实测了生产登录。
- `#010101` 的全图差异数 2520 实际等于左半 1349 + 右半 1171，不能同时称“只在左侧、右侧差异 0”。近黑被旧算法漏掉仍成立，原因包含小差值过滤；不能把纯黑的信息缺失证明直接套到近黑。
- “每张前冻结、不稳定不当作通过依据”与 P2-05 不符。
- “自检不过不产出报告”不准确：代码会写含失败自检的报告，然后退出 1；正确说法是“不产出通过结论”。
- 新输出的 metrics 仍宣称旧算法，影响报告可追溯性。

**建议的 §11.3 替代文字：**

> 发布准备复验曾发现 Pages 与 Worker 跨站、SameSite=Lax 导致会话不可用。该阻断已在 2026-10-26 发布中通过 Pages 同源 API 入口处理；已保存的生产 HTTP 证据证明同会话创建、读取和删除记录成功，主机限定 cookie 保留 HttpOnly/Secure/SameSite=Lax，跨站写入返回 403。详见 2026-10-26 发布记录。现有线上 Worker 的 GET /api/auth/me 仍返回 404，此接口及生产浏览器登录体验需独立复验，不能据此宣称认证全部通过。本轮外观验收工具改动尚未提交或部署。

其余文字建议按真实分支改写，保留历史轮次背景但明确其不是当前实现。缩放“45+9”本次未重现，应保留原运行环境/产物并追加本次环境限制，而不是以这次失败证明旧记录从未成立。

### P3-04：原生按键仍有不按 profile 过滤的窗口降级分支

**位置：** `scripts/zoom-real-200.mjs:450`、`:455`、`:456`、`:472`。

**复现证据：** `node tmp/codex-audit-20261102/zoom-logic-probes.mjs` 提取并保存实际注入用的 PowerShell，输出 `hasUnfilteredFallback:true`。见 [原样命令](../../tmp/codex-audit-20261102/zoom-injection-command.ps1)。

**为何是缺陷：** profile 匹配为空（例如 CIM 查询不可用）时仍选择任意一个有窗口的 Chrome。后面的焦点比较只能证明前台是“选中的窗口”，不能证明它属于被测 CDP 实例，可能把快捷键发到共享的 9222 实例。此次没有实际证实误发按键；两次完整运行均在焦点检查被拒绝，因此没有把“已发生误发”列为事实。

**建议：** 删除不受限降级；用本次 Chrome 进程/目标窗口的可验证映射，无法识别就报告失败。保留前台检查，但不能拿它代替实例身份校验。

## A—G 明确核对结论

| 攻击点 | 是否成立及证据边界 |
|---|---|
| A：还能假通过 | **成立。** P2-01～06 已给实际反例。 |
| 渐变/插画/半透明遮罩 | 普通双色渐变基例正确报 1:1 失败；**局部半透明伪元素遮罩假通过成立**（P2-03）。当前应用插画背景的现有选中样本全量通过，但不能外推任意插画/遮罩组合都受支持。 |
| 生成内容 | **假通过成立**（P2-02）。纯生成内容甚至用父色报 21。 |
| overflow:hidden | 本次静态裁切反例**未发现坐标假通过**，可见黑底区域被报 1:1；没把本应不可见的溢出文字算成已覆盖。 |
| transform:scale | 基例四图坐标对齐；**字号门槛错误成立**（P2-06）。 |
| text-shadow / text-stroke | 普通白色 shadow、2px 白色 stroke 基例都完成测量；**未证实二者单独导致假通过**。但代码 `stroke` 是 SVG 绘制属性，不等于清除 `-webkit-text-stroke`；B 只改 color，也不保证清掉 stroke/shadow/fill。强描边、滤镜与多层阴影组合的统一支持仍**存疑**，需独立的绘制期望和 DOM fixture，不能说已全面覆盖。 |
| 目标/祖先 opacity | 简单目标 opacity=.2 白底基例正确报 1.61；**有自身背景的组透明度假通过成立**。目标外祖先 opacity=.2 的基例掩膜被衰减，返回 no-text，属于保守未覆盖，不是正确量到字形（P2-01/03）。 |
| SVG/图片 obstacle | 普通并排图标基例通过；**外接矩形覆盖前景文字的假通过成立**（P2-04）。 |
| input/textarea | 简单填入「示例文字」的 value 测量通过，抓手没有造成假失败；**已有 value 原样恢复不成立**（P3-02）。白色 placeholder 的输入框仍报 value 的 21:1，证明**没有测 placeholder**；这是一项明确的覆盖边界，不能宣称占位符也通过。 |
| 掩膜样式会不会改变尺寸/位置/粗细 | **不能保证渲染等价。** 本批普通 background-image 清除、边框改色、静态 fixed 基例未出现盒尺寸变化；没有证实“背景图本身决定盒尺寸”。但遮罩变不透明、filter 保留、内联 important 未被覆盖已经改变字形可见性；文本描边也未统一控制。`background-attachment:fixed`、复杂混合模式/裁剪与 fixed+滚动组合仍需专门 fixture，未据猜测单列缺陷。 |
| B：一定同坐标/同状态 | **不成立。** P2-05、P3-01；旧 before、后代动画、瞬时状态、滚动均有缺口。 |
| C：边界回归自包含/掩膜推导正确 | **均不成立。** P2-07/08。抗锯齿本身未造成该批核心误判。 |
| D：454/0/4/0、最低 4.83、七项自检 | **数值属实，已重现。** 只证明当前样本/实现的输出，不证明算法普遍正确。 |
| D：真实 200%、54/54、45+9 | **54/54 测量完成可重现；200% 已验证和 45+9 本次未重现。** 两次完整运行均自证失败，属于环境限制的明确取证结论，旧成功记录的真实性仍需其当时的产物/环境，不作无证据否定。 |
| E：旧四参数会静默误用 | **不成立，明确拒绝。** 真正执行原复验脚本得到缺掩膜 Error 和退出 1。 |
| F：目标窗口与降级方案 | `Browser.getWindowForTarget` 用 `inst.target.id`，再在同一 `browserConn` 查 bounds，**该映射方式正确**；原生输入的任意窗口降级仍有风险（P3-04）。设备像素比降级被明确拒绝，**不会因此假通过**；严格 200% 和必备窗口证据门禁仍有缺陷（P2-09）。 |
| G：文档全部一致/P1 仍未处理 | **不成立。** 数值、自检和六参数签名一致；不稳定门禁、近黑差异、失败自检产物、metrics 和当前 cookie 发布状态需更正（P3-03）。 |

## 核对通过的部分

1. 四参数缺掩膜在任何图片解码前即拒绝，不会返回看似正常的高对比度。全仓调用点已搜索；生产测量、七项自检和新增边界脚本都传了两张掩膜，旧调用只在忽略的历史复验工具中保留。实际执行 `node tmp/release-acceptance-20261023/contrast-edge-cases.mjs` **退出 1**，含完整缺掩膜提示。[旧接口日志](../../tmp/codex-audit-20261102/old-interface.log)、[调用点清单](../../tmp/codex-audit-20261102/call-sites-and-cookie.txt)。
2. 当前七项数值自检、纯黑/近黑独立定位的算法方向有效，主脚本的失败自检分支退出 1；问题在真实 DOM 捕获与合成覆盖，不是说这些数值用例没运行。
3. 当前 458 项对比度测量正常完成，计数排除了 selector 汇总行，4 项装饰豁免没有计作通过，最低 4.83 可定位到具体按钮。
4. 普通 input/textarea 两张掩膜相减能排除原生抓手；未在本次基例重现抓手误判。
5. `makeTransparent` 对父/子内联 color 及 important 优先级正常恢复。独立执行实际函数，`before===after` 为 true；不要将 P3-02 的 value 清空与 color 恢复混为一谈。
6. 设备像素比模拟明确返回 `isRealBrowserZoom:false / verified:false`；两次完整实际失败运行均返回非零退出码。
7. 同源会话修复存在于当前仓库和 2026-10-26 已保存的生产证据中；没有凭旧拓扑描述另造一个“当前生产完全无法存档”的结论。

## 关闭 P2 还缺什么

不能只重跑到 454 绿项后关闭。至少需要修复组透明度合成、真实绘制色/伪元素、局部掩膜漏字、obstacle 误排和不稳定结果放行；按实际呈现字号判定；把新增边界回归改成自包含、同坐标的独立掩膜 fixture。应将本报告已证实的反例加入 DOM 级门禁，验证每个片段的完整覆盖，失败后产生明确未覆盖/失败结果。

缩放验收另需严格守住 200% 和必备窗口证据，在可取得目标窗口焦点的环境留下一次成功的完整矩阵，按实测宽度核对 45+9，保留原始状态和 bounds。最后将文档的发布状态、方法描述和实际产物同步。现有七项自检和 454 项通过可以保留为证据，但不足以证明该 P2 已关闭。
