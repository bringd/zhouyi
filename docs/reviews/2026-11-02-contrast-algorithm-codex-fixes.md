# 对比度验收工具：独立审核问题的处理结果

日期：2026-11-02。

- 独立审核报告：`docs/reviews/2026-11-02-contrast-algorithm-codex-audit.md`
  （结论「**P2 不能关闭**」，9 项 P2 + 4 项 P3，全部带可复现证据）
- 上一轮的返工记录：`docs/reviews/2026-10-23-three-appearances-rework-report.md` §11
- 本轮性质：**处理审核意见的返工**。只动验收脚本与交付文档，**没有改业务代码**，
  没有 commit / push / deploy。

## 结论

审核提出的 13 条里，**12 条已处理**（11 条修复 + 1 条属文档口径修正）；
**1 条降级为已知边界**并写进交付文档（下面 §5 说明为什么不能靠改工具解决）。
处理完之后新增了一道**DOM 级硬门禁** `scripts/contrast-dom-regressions.mjs`：
把审核用真实 DOM 构造出来的 13 个反例固化成断言，以后回归会直接失败。

审核里那句「**454 通过、4 豁免、最低 4.83**」的数值本身是属实的（审核自己复现过 ✓），
但那证明的是「当次输出符合预期」，不证明算法普遍正确——审核正是用这一点打穿了 P2。
本轮把「算法正确性」和「本次输出」分开处理：前者交给 DOM 级门禁，后者才是全量测量的结论。

---

## 1. 判定值的模型：从「声明色合成」改成「屏幕上画出来的颜色」

### 1.1 审核指出的假通过（P2-01）

审核的最小反例：

```css
#t { opacity: .65; color: black; background: #777; font-size: 16px }
```

真实字芯是 `0.65×黑 + 0.35×白 = 88`，背景是 `0.65×#777 + 0.35×白 = 166`，
**真实对比度 2.92:1**（正文门槛 4.5，远不达标）。
旧算法报 **4.67:1** 判通过。

根因：CSS 的组透明度是「元素连同它自己的背景」作为一组叠加到外层底色上。
旧算法先取到**已经合成过的背景**（B 图 = 166），又把组 opacity 乘一次到字色上，
等于把同一个底色引入两遍，算出了偏深的字色（58 而不是 88）。

### 1.2 现在的算法

判定值改用**屏幕上真正画出来的颜色**：

- 掩膜照旧用「受控背景下的字形覆盖率」定位文字（与原背景无关 ✓）；
- 每个文字片段取它**字芯像素**（掩膜覆盖率 ≥ 0.9）在原始截图里的**中位色** = 渲染后的字色；
- 判定值 = `contrast(渲染后的字色, 该落点的背景)`，取所有落点里的最小值。

这样一来，下列三层叠加都被如实算进去，不再重复计算：

| 层 | 旧算法 | 现在 |
|---|---|---|
| 元素/祖先 `opacity`（组透明度） | 再乘一次 ✗ | 由像素如实反映 ✓ |
| `::before/::after` 生成内容 | 用父元素字色代替 ✗ | 伪元素不进片段；它自己的颜色由像素反映 ✓ |
| `-webkit-text-fill-color` | 只读 `color` ✗ | 由像素反映 ✓ |

DOM 级回归里的实测：

| 用例 | 旧算法 | 现在 | 真值 |
|---|---|---|---|
| `opacity-group`（组透明度） | 4.67:1（**通过** ✗） | **2.8:1（失败 ✓）** | 2.92:1 |
| `text-fill`（`color:black` + `text-fill:#fff`） | 3.21:1（**通过** ✗） | **1:1（失败 ✓）** | 1:1 |
| `pseudo-generated`（黑字 + 白色 `::after`） | 21:1 | **16.56:1（通过 ✓）** | 约 16~21 |

> 现在的字色取自字芯像素，**抗锯齿会带来约 2~3% 的保守偏差**
> （字芯覆盖 90% 而不是 100%，量到的字色略浅/略深）。
> 偏差方向是**一律偏保守**（报出来的对比度略低），不会把不合格算成合格。
> 复验方四档深底的实测值：1.62 / 1.02 / 1.01 / 1.00，与手算真值
> 1.6621 / 1.0182 / 1.0061 / 1.0000 的偏差均 ≤ 0.0039。

### 1.3 小字号：用覆盖率反解纯字色

第一版 v4 直接拿字芯像素当字色，12~14px 的正文立刻暴露问题：
笔画只有一两个像素宽，字芯覆盖率往往到不了 1，
量到的字色是「90% 的字 + 10% 的底」，**系统性低估对比度约 16%**
（朱砂卦册那行引文真实 5.1:1，被报成 4.26:1，凭空造出一条失败）。

现在按覆盖率**反解**出纯字色：

```
painted = α·C + (1−α)·bg   →   C = (painted − (1−α)·bg) / α
```

其中 α 是掩膜给出的覆盖率（掩膜是纯黑字压纯白底，差值正好等于 255×α）。
反解后那行引文回到 5.1:1 ✓，小字号不再被低估。
声明色同时作为**上界**参与判定（取更保守的那个），
避免反解在极端情况下（例如掩膜被祖先 opacity 淡化、α 偏小）把字色算得过头。

### 1.4 门槛字号按「实际呈现的字号」选

`transform: scale(.5)` 之后 computed `font-size` 仍是 32px，
但屏幕上看到的是 16px——按 32px 选「大字 3:1」就把正文放过去了
（审核实测：实际 3.54:1 却判通过 ✗）。

现在每个文字片段都带自己的**实际呈现字号**（computed font-size × 该元素及其祖先的 transform 缩放，
缩放倍率由 `getBoundingClientRect().width / offsetWidth` 得到），**各自按自己的门槛判定**；
元素级门槛取各片段里最严的那个。实测：`scaled` 用例现在是 16px → 门槛 4.5 → **3.4:1 判失败 ✓**。

## 2. 掩膜的三个修补

### 2.1 强制样式要压得住内联 important（P2-03 的一部分）

审核的反例：`<span style="background-color:black!important">MMMM</span>`——
内联 important 的黑底会**压过**样式表的 important，掩膜的白底没生效，
那段字在掩膜里直接消失 → 落点丢失 → 元素被同一元素里别处的文字「带过」→ 假通过。

现在掩膜的强制样式改用**内联 `style.setProperty(..., 'important')`** 逐个写上去
（内联 important 在层叠里压过样式表的 important ✓），测完按原值原样恢复（含优先级）。
实测：`inline-important-background` 从「21:1 通过」变成 **1:1 失败 ✓**。

### 2.2 不再把替换元素的整框当遮挡区（P2-04）

旧实现把 `svg/img/canvas` 的**整个外接矩形**排除出落点，
于是「透明空 SVG 框里的可见文字」被一起排掉（审核实测：掩膜已认出 2972 个 1:1 的落点，
全被障碍矩形删了 → 报 21:1 通过 ✗）。

现在掩膜**不强制 `fill/stroke`**：SVG 图标在自己的两张掩膜里长得一样，
相减后自然消失，不需要再整框排除。实测：`svg-overlap-front-text` 从 21:1 变成 **1:1 失败 ✓**。

### 2.3 伪元素的生成内容不算这段文字（P2-02 的一半）

`::before/::after` 的文字不属于元素自己的文本片段。
现在它们在**两张掩膜里都被置为透明**（相减后为 0，不会变成假的文字落点），
在「无字」那张图里也一并清掉（否则会污染底色）。
实测：`pseudo-only`（元素没有文字、只有一个白色 `::before`）现在报 **无可测文字**（未覆盖），
而不是拿父色报 21:1 ✓。

### 2.4 取证不完整要判失败（新增，审核 P2-03 的兜底）

只要**有任何一段文字**在掩膜里一个字形都没认出来，就说明这段文字的取证是残缺的
（内联 important 背景、`filter: contrast(0)`、遮罩层等都会造成这种情况）。
这种情况**不允许**拿同一元素里别处的文字当通过依据：
新增 `incomplete-coverage` 失败类型。
实测：`filter-descendant`（后代被 `filter:contrast(0)` 抹平）现在判**失败** ✓
（那一段的覆盖率没认出来 → 取证不完整）。

## 3. 取证稳定性与坐标（P2-05 / P3-01 / P3-02）

| 问题 | 处理 |
|---|---|
| 文档说「每张截图前冻结动画」，实际只在第一张前冻结 | 现在**四张截图前都冻结** |
| 漂移只比对元素外盒，后代在动画里来回动查不出来 | 状态快照增加**各文本片段的矩形与文本内容**、滚动位置 |
| 重试时仍拿第一次的旧基准比较，第二次即使稳定也被判不稳定 | 重试时**重新取基准** |
| 即使判出 `unsettled/drift`，`ok` 仍只看对比度，照样计通过 | 新增 `unstable` 失败类型：**不稳定一律判失败**，并写进报告 |
| 页面滚动后把视口坐标当文档坐标裁剪，整块截空 | 裁剪坐标加上 `window.scrollX/scrollY` ✓ |
| 测量时改了输入框的值，测完被清空 | 原值**总是**先存下来（不只是空值时），测完原样恢复 ✓ |

### 3.1 工具自己造出来的三个假象（本轮新发现，不在审核清单里）

这三处都不是审核列的条目，是本轮把判定模型换成 v4 之后**实测暴露**出来的，
都属于「工具干扰了自己的测量」：

| 假象 | 现象 | 处理 |
|---|---|---|
| 工具改内联色触发了元素自己的颜色过渡 | 元素带 `transition: all .2s`（`.ui-button` 就是）。掩膜把字色改成 `#000`/`transparent` 会触发它的过渡；**还原时颜色与 transition 在同一次样式结算里生效**，颜色停在过渡中途被读到（`rgba(86,103,92,0.235)`）→ 被判成「测量期间页面在动」。青岚起卦按钮、朱砂/夜航主按钮共 **4 条假失败** | 掩膜/置透明期间强制 `transition:none`；还原时**先改颜色、强制结算一次样式、再把 transition 还回去** |
| 被裁切到画面外的行被判成「取证不完整」 | 长段落在容器里被 `overflow` 裁掉下半截，`Range` 仍会报出被裁那几行的矩形 → 掩膜里当然找不到字 → 整段被判 `incomplete-coverage` 失败（首页「今日解读」三套外观各一条假失败） | 只有**矩形与截图区相交**的片段才参与覆盖检查；被裁到画面外的片段不参与判定 |
| 掩膜的样式快照被自己的第二轮覆盖 | 掩膜要连拍两次（黑字 / 无字），第二轮存快照时存的是「第一轮强制后的值」→ 还原时把掩膜样式留在页面上。`-webkit-text-fill-color:#000` 会盖过 `color` 继续把字画成黑色，「无字」那张图因此仍是黑字 → 所有落点都被算成 1:1 | 快照**只记一次**（第一轮记原值），后续轮次只改值不重记；「无字」那张图额外清掉 `-webkit-text-fill-color` |

## 4. 没能彻底解决的一条：部分遮挡导致「掩膜认不出字」

审核的 `overlay-partial` 用例（右侧被一层 10% 白 `::after` 盖住）在本轮**已能判失败** ✓
（1.21:1），因为现在的掩膜不再把伪元素的不透明底色压成不透明白，文字透得过来。

但仍有一类组合解决不了：**掩膜被彻底压住**时（例如某个不透明元素正好盖住文字），
掩膜认不出那段字 → 取证不完整 → 本轮按「判失败」处理 ✓（不会假通过 ✓），
但工具**无法区分**「这段字被盖住了（产品缺陷）」和「这段字被裁切了（本来就不该量）」。
这一条作为**已知边界**写进交付文档，不宣称已全面支持。

另一类已知边界：审核指出 `text-shadow` / `-webkit-text-stroke` /
`mix-blend-mode` / `background-attachment: fixed` 等组合**没有独立 fixture**，
本轮只做了「掩膜里统一去掉 text-shadow / box-shadow」这一层处理，
复杂混合模式仍属存疑，不作「已全面覆盖」的声明。

## 5. 回归门禁的改造（P2-07 / P2-08）

### 5.1 边界回归改成自包含

旧版 `scripts/contrast-edge-cases.mjs` 读 `tmp/release-acceptance-20261023/contrast-rasters.json`
（`git check-ignore` 确认是忽略文件），审核实测：**只有那个文件缺失时**脚本就
「缺少复验方的原始栅格 / cases=[] / ok=false / 退出码 1」——干净检出根本跑不了。

现在改成**自己生成栅格与掩膜**：四张图（有字 / 无字 / 白底黑字 / 白底无字）
由**同一个墨迹生成器**产出，字形与坐标天然一致 ✓，
不依赖任何仓库外或被忽略的文件 ✓。

### 5.2 不再用「复制左半」拼掩膜

旧版把「有字」图左半（白底黑字）平移 W/2 当右半的掩膜。审核逐像素核对发现：
原始栅格左右两半的**字形并不相同**（`#333333` 档有 5547 个 RGB 通道与预测不符，
右侧核心字形漏掉 746 个像素、额外标入 608 个），因为背景整片恒定，
**掩膜错了也照样取到同一个 51/3/1/0**——四个正确比值证明不了掩膜正确。

现在掩膜与栅格同源生成 ✓，并**新增「横向渐变背景」用例**
（背景随位置变化，掩膜错位会被算出来 ✓）。

### 5.3 复验方那批原始栅格为什么不再复跑

审核的结论是对的：原始栅格左右两半字形不同、纯黑底那侧又逐像素相同，
既拼不出也反推不出同坐标掩膜；拿自造掩膜去套只会得到无意义的数字
（本轮实测：套上之后报 1:1、落点跑到左半，明显不对 ✓）。
要复跑那批像素，需要**配套同字形同坐标的独立掩膜 fixture**；
在拿到那套 fixture 之前，本脚本只跑自包含用例，并把这层限制写进报告 ✓。

### 5.4 新增 DOM 级门禁

`scripts/contrast-dom-regressions.mjs`：从真实源文件里按函数名取出
`measureElement` / `analyzePair` 等**真实实现**（不重新实现被审算法），
在临时页面上跑 13 个真实 DOM 反例，按**期望结论**断言：

```
opacity-group                measured ratio=2.8  ok=false need=4.5
text-fill                    measured ratio=1    ok=false need=3
pseudo-only                  no-text ratio=null  ok=null  need=null
pseudo-generated             measured ratio=16.56 ok=true  need=3
inline-important-background  measured ratio=1    ok=false need=3
overlay-partial              measured ratio=1.21 ok=false need=3
filter-descendant            measured ratio=16.56 ok=false need=3
svg-overlap-front-text       measured ratio=1    ok=false need=3
gradient                     measured ratio=1    ok=false need=3
scaled                       measured ratio=3.4  ok=false need=4.5
opacity-target               measured ratio=1.53 ok=false need=3
input-existing-value         measured ratio=16.56 ok=true  need=3
scroll                       measured ratio=16.56 ok=true  need=3
全部 13 个用例符合期望
```

## 6. 真实缩放门禁（P2-09 / P3-04）

| 问题 | 处理 |
|---|---|
| 自证只要 dpr ≥1.5 就算「真实缩放」，但矩阵后面按 `cssWidth*2` 设窗口 | 「是不是真实缩放」与「有没有达到 200%」**分成两个判据**：dpr 倍率必须落在 **1.9~2.1**，只按到 150% 不算通过 |
| 物理窗口 bounds 拿不到时反而放行 | 拿不到 = 没有证据 → **判未通过** ✓ |
| 最终汇总又用 `window.outerWidth` 判断 | 统一用 CDP `Browser.getWindowBounds`（同一个实例、同一个 target）✓ |
| 重启 Chrome 后不重新自证 | 每次重启都**重新自证**，没保持住就记为未验证 ✓ |
| 按键注入在 profile 匹配失败时退回「任意 chrome 进程」 | 删掉该降级分支：认不出本脚本自己的实例就**明确失败**（避免把 Ctrl+plus 发给 9222 那个共享实例）✓ |
| 矩阵的每一组没有当场核对缩放倍率 | 每组都核对 dpr 倍率；**被浏览器钳住缩放的组不计入「200% 验收覆盖」**，单列为平台限制并写明原因 ✓ |

### 6.1 顺带修好的两个「环境问题」

这两个不是审核条目，是本轮为了让门禁能稳定复跑而发现的：

| 现象 | 原因 | 处理 |
|---|---|---|
| 原生按键注入时好时坏，日志显示「前台窗口不是目标 Chrome」 | Windows 把 `SetForegroundWindow` 的权限限制给**当前前台窗口所属的进程**，后台进程直接调会被拒绝 | 调焦点前先发一次 **Shift 键**（系统的经典解锁手法：把「最近一次输入的来源进程」临时提升为可设置前台的进程），再 `AppActivate` + `SetForegroundWindow` + 逐次核对前台句柄。改完之后注入**稳定成功**（dpr 逐档 1.10 → 1.25 → 1.50 → 1.75 → 2.00）✓ |
| 第二次运行直接崩在 `EBUSY: unlink .../CrashpadMetrics-active.pma` | 上一次 Chrome 的 crashpad 句柄还占着 profile 里的瞬时文件 | profile 清理改成**重试 + 兜底**（删不掉就只清 Preferences / Secure Preferences 后继续）✓ |

> 环境限制说明：原生注入**依赖系统前台焦点**，
> 审核方两次完整运行都报 `FOREGROUND:0` 被拒。
> 修好焦点获取之后，本机可以稳定复现「真实 200% 已验证」✓；
> 但这条结论**必须带着当次的产物**（`screenshots/zoom-real-200/zoom-real-200.json`），
> 不能用旧记录顶替。

### 6.2 本机结果（2026-11-02）

```
策略1 系统原生键盘注入（真实浏览器缩放）：成功
  Ctrl+0 复位到 100% → dpr 1.25 innerWidth 1426
  第 1~5 次 Ctrl+加号：倍率 1.10 → 1.25 → 1.50 → 1.75 → 2.00（dpr 2.5，innerWidth 713）
自证结果：通过 —— dpr 1.25→2.5（200%），innerWidth 1426→713px（视口收窄到 50.0%），物理窗口宽度 1440→1440px
覆盖 54/54 组；失败 0 项 / 豁免 0 项
**在真实 200% 缩放下量到的 54 组**（全部组都在 200% 缩放下量的）
```

报告里的证据字段：`verified=true`、`isRealBrowserZoom=true`、`reachesTarget200=true`、
`effectiveZoomPercent=200`、`physicalWidthDelta=0`、
`windowBounds 1440×900 → 1440×882`（宽度不变 ✓）、矩阵每组 `devicePixelRatio=2.5` ✓。

另有 9 组是**视口**平台限制档（浏览器最小窗口宽度，标称 195px 实测 243px）——
这 9 组的**缩放仍然是 200%** ✓，所以仍计入 200% 覆盖 ✓，
限制的是「CSS 视口没量到标称档位」这一件事 ✓。

## 7. 文档口径修正（P3-03）

| 原写法 | 更正 |
|---|---|
| §11.3：P1（跨站会话 cookie）「仍未处理，应暂停发布」 | **已过时**：2026-10-26 的发布已用 Pages 同源 API 入口处理，生产 HTTP 证据显示同会话创建/读取/删除记录成功、cookie 主机限定且保留 HttpOnly/Secure/SameSite=Lax、跨站写入 403（`docs/reviews/2026-10-26-release-record.md`）。本轮工具改动**尚未提交或部署** |
| 「近黑那侧逐像素完全相同」 | 只对 `#000000` 成立：`#010101` 那侧有 1171 个差异像素，但**最大差只有 1**（在噪声阈值 3 以下）；`#000000` 那侧才是逐像素完全相同 |
| 「自检不过不产出报告」 | 准确说法是「**不产出通过结论**」：代码会写出含失败自检的报告，然后以退出码 1 结束 |
| 报告 `metrics.weakestRatio` 仍写旧公式 | 已按新模型改写 |

## 8. 本轮的产物与复测路径

```bash
# 1) DOM 级门禁（13 个真实反例，秒级）
node scripts/contrast-dom-regressions.mjs

# 2) 算法边界回归（自包含栅格 + 同源掩膜，秒级）
node scripts/contrast-edge-cases.mjs

# 3) 全量对比度实测（自带算法自检，不过就中止）
node scripts/contrast-appearances.mjs

# 4) 其余验收
node scripts/appearance-journey.mjs
node scripts/acceptance-appearances.mjs
node scripts/zoom-real-200.mjs
```

调试时可以用环境变量只测某几个组合（**正式取证不要设**）：

```bash
# PowerShell
$env:DSH_ONLY='qinglan/divination,yehang/home'; node scripts/contrast-appearances.mjs
```

### 本机门禁结果（2026-11-02）

| 命令 | 结果 |
|---|---|
| `contrast-dom-regressions.mjs` | 退出码 0，**13/13** 符合期望 |
| `contrast-edge-cases.mjs` | 退出码 0，6/6，**0 假通过** |
| `contrast-appearances.mjs` | 退出码 0，**454 通过 / 0 失败 / 4 豁免 / 0 未覆盖**，非豁免最低 **4.83:1** |
| `appearance-journey.mjs` | 退出码 0，全部通过 |
| `acceptance-appearances.mjs` | 退出码 0，0 失败 |
| `zoom-real-200.mjs` | 退出码 0，**真实 200% 已验证**（dpr 1.25→2.5 = 2.0×，物理窗口宽度 1440→1440 不变），54/54 组 |
| `npm test` | 56 个文件 / 522 个用例通过 |
| `npm run typecheck` / `npm run build` / `cd worker && npm run build` | 全部通过 |

本机证据：`tmp/codex-audit-20261102/`（审核方的原始证据）、
`screenshots/contrast/contrast-dom-regressions.json`、
`screenshots/contrast/contrast-edge-cases.json`、
`screenshots/contrast/contrast-appearances.json`、
`screenshots/zoom-real-200/zoom-real-200.json`。

> **没有 commit / push / deploy**；`public/sitemap.xml` 按字节保留（构建会重写 lastmod，跑完即还原）。
