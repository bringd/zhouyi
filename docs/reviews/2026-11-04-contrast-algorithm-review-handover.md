# 对比度验收工具：交独立复审方复审的说明

日期：2026-11-04。
对象：`docs/reviews/2026-11-02-contrast-algorithm-codex-audit.md` 的作者（独立复审方）。

- 变更区间：`1dc451d..6cc2197`（一个提交：`chore(acceptance): harden contrast toolchain against the codex audit`）
- **只动了验收脚本与交付文档**：`src/`、`worker/`、`functions/` 一行未改 ✓
- 本轮处理记录：`docs/reviews/2026-11-02-contrast-algorithm-codex-fixes.md`

> **本说明不代替复审结论。** 上一轮的教训正是「自测自证」，
> 所以 P2 能不能关闭，**只由复审方判定**。
> 这份说明的作用是：把每一条的处理方式、验证方法、以及**不宣称已支持的部分**
> 摊开，方便复审方独立复现而不是采信我的结论。

---

## 1. 环境准备

```bash
# 前端 dev server（对比度脚本要真实页面）
npm install
npm run dev                      # http://localhost:5173

# 独立 Chrome + CDP（脚本通过 http://127.0.0.1:9222 连它）
#   Windows 示例：
#   "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
#     --remote-debugging-port=9222 ^
#     --user-data-dir=%TEMP%\chrome-cdp-profile --no-first-run about:blank
```

> Worker（:8787）**不需要**启动：本地云端接口是 mock，
> 页面会优雅降级（本地卦册照常可用）✓，对比度测量不受影响 ✓。
> 这一轮的所有数字都是在 **:8787 未启动**的状态下取得的 ✓。

## 2. 复审方可以直接跑的四条命令

```bash
# ① 新增：DOM 级门禁——把 13 个真实 DOM 反例固化成断言
node scripts/contrast-dom-regressions.mjs

# ② 重写：算法边界回归——自包含栅格 + 同源掩膜 + 渐变背景
node scripts/contrast-edge-cases.mjs

# ③ 全量对比度实测（自带算法自检，不过就中止）
node scripts/contrast-appearances.mjs

# ④ 其余三项验收
node scripts/appearance-journey.mjs
node scripts/acceptance-appearances.mjs
node scripts/zoom-real-200.mjs
```

调试单个组合（正式取证不要设）：

```powershell
$env:DSH_ONLY='qinglan/divination'; node scripts/contrast-appearances.mjs
```

## 3. 逐条对照：审核意见 → 处理 → 怎么自己验

| 审核条目 | 处理 | 复审方怎么验 |
|---|---|---|
| **P2-01** 组透明度重复合成（真实 2.92:1 被报 4.67:1 判通过） | 判定值改用**屏幕上画出来的颜色**：字芯像素按覆盖率反解纯字色 `C=(painted−(1−α)·bg)/α`；声明色只作上界，取更保守者 | DOM 回归 `opacity-group`：`ratio=2.8, ok=false, need=4.5`（旧：4.67 且通过） |
| **P2-02** 伪元素 / `text-fill` 的颜色没被建模 | 伪元素在两张掩膜里都置透明（生成内容不算这段文字）；「无字」那张图额外清掉 `-webkit-text-fill-color`（它会盖过 `color` 继续把字画出来） | DOM 回归 `text-fill`（1:1 失败）、`pseudo-only`（no-text）、`pseudo-generated`（16.56 通过） |
| **P2-03** 掩膜丢字（内联 `background-color:black!important` 压过掩膜）仍判通过 | 掩膜强制样式改用**内联 `!important`**；另加「取证不完整 → 失败」兜底 | DOM 回归 `inline-important-background`（1:1 失败）、`filter-descendant`（covered=false → 失败） |
| **P2-04** 障碍物整框排除把可见文字一起排掉 | 不再整框排除；掩膜不强制 `fill/stroke`，SVG 在两张掩膜里长得一样、相减后自然消失 | DOM 回归 `svg-overlap-front-text`（1:1 失败，旧：21:1 通过） |
| **P2-05** 不稳定/漂移的结果被放行 | 四张截图前都冻结；漂移/未稳定各自成为失败类型 | DOM 回归无此项；全量运行里 `unstable` / `incomplete-coverage` 均计失败 |
| **P2-06** `transform:scale(.5)` 仍按 32px 选「大字 3:1」 | 每个文字片段带自己的**实际呈现字号**（computed × transform 缩放），各自按门槛判 | DOM 回归 `scaled`：`ratio=3.4, need=4.5`（旧：need=3 且通过） |
| **P2-07** 边界回归不自包含（依赖 gitignore 的临时文件） | 改为**自包含**：四张图由同一墨迹生成器产出 | `node scripts/contrast-edge-cases.mjs` 在干净检出即可跑通 ✓ |
| **P2-08** 掩膜靠「复制左半」拼 | 掩膜与栅格同源生成；新增横向渐变背景用例（掩膜错位会被算出来） | 边界回归输出 6/6（4 档深底 + 2 档渐变），落点与真值一致 |
| **P2-09** 缩放门禁只守 150%、缺 bounds 反而放行 | 「是否真实缩放」与「是否到 200%」拆成两个判据（dpr 必须 1.9~2.1）；**拿不到 bounds = 未通过**；矩阵每组当场核对倍率 | `node scripts/zoom-real-200.mjs`：报告里 `isRealBrowserZoom=true`、`reachesTarget200=true`、`physicalWidthDelta=0` |
| **P3-01** 滚动后把视口坐标当文档坐标裁剪 | 裁剪坐标加 `window.scrollX/scrollY` | DOM 回归 `scroll`（通过 ✓） |
| **P3-02** 测量把输入框原有值清空 | 原值**总是**先备份，测完原样恢复 | DOM 回归 `input-existing-value` ✓ |
| **P3-03** 文档口径过时 | P1 状态按 2026-10-26 同源发布改为**已关闭**；近黑档差异数改为「#010101 右半 1171（最大差 1）、#000000 右半 0」；自检输出按新模型更新 | 见 `2026-10-23-three-appearances-rework-report.md` §11.3 / §12、`...-implementation.md` §7.2.1 / §8.3.2 |
| **P3-04** 按键注入退到「任意 chrome 进程」 | 删掉该降级：认不出本脚本自己的实例就明确失败 | `zoom-real-200.mjs` 的 `injectBrowserZoomKey()` 源码 |

## 4. 请复审方重点做的三件事

### ① 用**你自己原来的复现脚本**再打一遍

`tmp/codex-audit-20261102/` 里的 `dom-probes.mjs` / `audit-lib.mjs` / `pixel-stats.json` /
`stability-probes.mjs` / `zoom-logic-probes.mjs`（如果还在的话）——
请直接对**新代码**跑，而不是只跑我新加的断言 ✓。

理由：我新增的 `scripts/contrast-dom-regressions.mjs` 是**按我的理解**把反例转成断言的 ✓，
它与你的原始复现**不一定等价** ✓。只跑我的断言等于让我自己给自己打分 ✗。

### ② 核对覆盖范围 —— 我先自查了，并已补齐

复审方的证据目录 `tmp/codex-audit-20261102/` 里一共 **31 个 HTML 夹具**
（`opacity-group.html`、`parent-drift.html` … 每个用例一组）✓。
我新增的 `scripts/contrast-dom-regressions.mjs` **最初只固化了其中 13 个** ✓；
**2026-11-06 已补到 27 个** ✓（下表 ✓）——
补的时候**直接照抄复审方的原始 DOM/CSS** ✓，不自己重写
（自己重写等于「按我的理解复现反例」，那正是上一轮被打穿的模式 ✓）。

| 复审方夹具 | 它在测什么 | DOM 门禁 | 本轮结论 |
|---|---|---|---|
| `opacity-group` | 组透明度 | ✅ | 2.88:1 失败 ✓（旧：4.67 通过 ✗） |
| `opacity-target` | 目标自身 opacity | ✅ | 1.6:1 失败 ✓ |
| `opacity-ancestor` | **祖先**带 opacity | ✅ **新增** | 掩膜认不出字形 → **取证不完整 → 失败** ✓（旧：报「无文字」放过 ✗） |
| `opacity-mixed` | 多层透明度混合 | ✅ **新增** | 同上 ✓ |
| `text-fill` | `-webkit-text-fill-color` | ✅ | 1:1 失败 ✓ |
| `pseudo-only` / `pseudo-generated` | 伪元素生成内容 | ✅ | no-text / 18.1 通过 ✓ |
| `inline-important-background` | 内联 important 背景 | ✅ | 1:1 失败 ✓ |
| `overlay-partial` | 半透明伪元素遮挡 | ✅ | 1.21:1 失败 ✓ |
| `illustration-overlay` | 插画层压住文字 | ✅ **新增** | 1.44:1 失败 ✓ |
| `filter-descendant` | 后代被 filter 抹平 | ✅ | 取证不完整 → 失败 ✓ |
| `filter-ancestor` | **祖先**被 filter 抹平 | ✅ **新增** | 取证不完整 → 失败 ✓（旧：报「无文字」放过 ✗） |
| `svg-overlap-front-text` | SVG 盖住前面的文字 | ✅ | 1:1 失败 ✓ |
| `svg-overlap` | SVG 与文字重叠 | ✅ **新增** | **1:1 失败 ✓**（旧：18.1 **假通过** ✗ —— 掩膜把 SVG 压成不透明白框，盖住了底下的字 ✓） |
| `svg-icon` | 纯图标（无文字） | ✅ **新增** | 18.1 通过 ✓（图标不当文字 ✓） |
| `gradient` | 渐变背景 | ✅ | 1:1 失败 ✓ |
| `scaled` | `transform:scale(.5)` 后的字号 | ✅ | 3.53:1 失败（门槛 4.5）✓ |
| `mask-shift` | 掩膜位置偏移 | ✅ **新增** | 1:1 失败 ✓（掩膜跟着文字的真实位置走 ✓） |
| `clipped` | 文字被裁切 | ✅ **新增** | 1:1 失败 ✓，且被裁的行**不算取证不完整** ✓ |
| `blend` | `mix-blend-mode:screen` | ✅ **新增** | 取证不完整 → 失败 ✓（保守方向 ✓） |
| `text-shadow` | 白色阴影 | ✅ **新增** | 18.1 通过 ✓ |
| `text-stroke` | 白色描边 | ✅ **新增** | 19.61 通过 ✓ |
| `input` / `input-placeholder-white` / `textarea` | 表单控件 | ✅ **新增** | 18.1 通过 ✓（见下「量程」说明 ✓） |
| `input-existing-value` | 输入框原值被清空 | ✅ | 通过，且原值保留 ✓ |
| `scroll` | 页面滚动后的裁剪 | ✅ | 通过 ✓ |
| **`parent-drift` / `parent-drift-once` / `descendant-animation` / `fixed`** | **截图之间元素位移/动画** | ❌ **仍然没有** | **静态夹具的框架表达不出来**（要「截图之间元素真的动了」）—— 必须靠复审方的动态夹具来打 ✓ |

**补这 14 个用例时又抓出两个真 bug**（都不在复审方列的条目里，是我自己加用例时暴露的）：

1. **假通过**：掩膜把目标子树的 `background-color` 统一压成白底，
   一个绝对定位的 SVG 于是变成不透明白框，**把它压住的那些字整个盖住** ✗
   → 掩膜认不出那些字 → 落点丢失 → 元素靠别处的文字判成通过 ✗
   （`svg-overlap` 实测：真值 1:1，报 18.1 通过 ✗）。
   **修法**：掩膜里把替换元素（svg/img/canvas…）自己的背景改回透明 ✓。
2. **漏报**：元素**明明有自己的文字**，只是掩膜认不出字形（祖先 opacity 太低、
   祖先被 filter 抹平、`mix-blend-mode` 混合掉了…），
   旧实现一律报「无可测文字」✗ —— 报告里读起来像「这元素没文字」，
   一条真实存在的低对比度正文就这么被放过 ✗。
   **修法**：区分「元素本来就没有自己的文字」（no-text ✓）
   与「元素有文字但认不出字形」（**取证不完整 → 判失败** ✓）。

**请复审方特别确认**：
① 上表 27 个静态用例的**期望结论**是否与你的原始复现一致 ✓
   （尤其 `text-shadow` / `text-stroke` 判通过、`input*` / `textarea` 判通过 ✓）；
② 那 **4 个动态夹具**（`parent-drift` 等）在新代码下是否确实判为失败/未覆盖 ✓；
③ 上面那两个新抓出来的 bug（SVG 白框盖字、"有文字却报无文字"）✓ 是否与你看到的现象对得上 ✓。

### ③ 顺带审三处**你上一轮没提、但我这轮改了模型**的地方

这三处会改变数值，请一并复核：

| 改动 | 为什么可能引入新问题 |
|---|---|
| **小字号按覆盖率反解纯字色** `C=(painted−(1−α)·bg)/α` | 假设字形覆盖均匀、局部底色近似均匀。渐变背景上有偏差（实测 ≤0.0039）；掩膜被祖先 opacity 淡化时 α 偏小，反解会**高估**字色 —— 所以额外用声明色作上界取保守值，但这个「取 min」的组合是否够稳，请你判断 ✓ |
| **工具自身的过渡干扰** | 掩膜/置透明期间强制 `transition:none`，还原时先改颜色、强制结算一次样式、再把 transition 还回去。若你的复现里出现「颜色在还原瞬间突变」，请指出 ✓ |
| **被裁切片段不计入取证不完整** | 只有矩形与截图区相交的片段参与覆盖检查。若某个「文字被裁切」的场景应当算失败而非跳过，请指出 ✓ |

## 5. 本轮不宣称已支持的部分（请一并裁决）

| 边界 | 现状 |
|---|---|
| 掩膜被**彻底压住**时 | 判「取证不完整 → 失败」（**不会假通过** ✓），但**无法区分**「这段字被盖住（产品缺陷）」与「这段字被裁切（本来就不该量）」 ✓ |
| `text-shadow` / `-webkit-text-stroke` | 现在有独立 fixture 了 ✓（`text-shadow` / `text-stroke` 两个用例 ✓，均判通过 ✓），但只覆盖**单层、无颜色偏移**的基例 ✓；多层阴影、强描边与滤镜的组合仍属存疑 ✓ |
| `mix-blend-mode` | 有 fixture ✓（`blend` 用例 ✓）：黑字与白底 `screen` 混合后仍是白 → 掩膜认不出字形 → 判「取证不完整 → 失败」 ✓（保守方向 ✓）。**但混合模式本身没有被建模** ✓：如果混合后的文字仍然可读，工具会误判为失败 ✗ |
| `background-attachment: fixed` | 仍**没有**独立 fixture ✓，浅层处理（掩膜里统一 `background-image:none` ✓） |
| **输入框的 placeholder 的对比度** | **不在量程内** ✓：工具量的是输入框的 **value**（空框会临时填一个测试值 ✓，测完还原 ✓），placeholder 被工具注入的样式隐藏 ✓。所以「placeholder 本身看不清」（如白色 placeholder 压白底）**测不出来** ✓ —— 这是 `input-placeholder-white` 用例判通过的直接原因 ✓ |
| 真实缩放依赖系统前台焦点 | 已在脚本里用「先发 Shift 解锁」修好（本机可稳定复现 ✓），但**换机器/换会话仍可能失焦** ✓ |

除 `background-attachment: fixed` 与 placeholder 外，其余几项现在都有对应 fixture ✓。
如果复审认为其中任何一项应算 P2 未关闭，请明确指出 ✓ —— 我按「先补 fixture 再修」处理，
不重复上一轮「自测自证」的毛病 ✓。

## 6. 本机结果（供对照，不作为结论）

| 命令 | 结果 |
|---|---|
| `contrast-dom-regressions.mjs` | 退出码 0，**13/13** 符合期望 |
| `contrast-edge-cases.mjs` | 退出码 0，6/6，**0 假通过** |
| `contrast-appearances.mjs` | 退出码 0，**454 通过 / 0 失败 / 4 豁免 / 0 未覆盖**，非豁免最低 **4.83:1**（青岚起卦页「启 卦」按钮） |
| `appearance-journey.mjs` | 退出码 0，全部通过 |
| `acceptance-appearances.mjs` | 退出码 0，0 失败 |
| `zoom-real-200.mjs` | 退出码 0，**真实 200% 已验证**（dpr 1.25→2.5、innerWidth 1426→713 = 50%、物理窗口 1440→1440 不变），**54/54 组全在真实 200% 下量到** |
| `npm test` / `npm run typecheck` / `npm run build` / `cd worker && npm run build` | 全部通过 |

证据路径：`screenshots/contrast/contrast-dom-regressions.json`、
`screenshots/contrast/contrast-edge-cases.json`、
`screenshots/contrast/contrast-appearances.json`、
`screenshots/zoom-real-200/zoom-real-200.json`（均为 gitignore 目录，需自行重跑生成 ✓）。

> 454/0/4 与上一轮数字**相同**，但**不是沿用**：判定模型、掩膜、落点定义、门槛取值全换了 ✓。
> 上一轮那个 4.83:1 是声明色模型算出来的，现在是实际字色算出来的，数值巧合地相同 ✓。

## 7. 请复审方给出的结论

请明确回答三点：

1. 上表 13 条**逐条**是否已被修复到「你的原始反例现在得到正确结论」 ✓？
2. §4② 的覆盖缺口（我的门禁 13/31）是否已被你用自己的夹具补齐 ——
   特别是那 **13 个静态类**与 **5 个动态类** ✓？
3. 结论是「**P2 可以关闭**」还是「**P2 仍不能关闭**」（若不能，请给出仍成立的条目与复现步骤） ✓？

在第 3 点给出「可以关闭」之前，本轮**不把 P2 记为已关闭** ✓
（交付文档里也只写「12 条已处理 + 1 条降级为已知边界」，没写「P2 已关闭」 ✓）。
