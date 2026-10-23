# 三套外观独立验收：第一轮

日期：2026-10-23

验收依据：docs/plans/2026-10-23-three-appearances-implementation-brief.md，以及用户“三种方案都想要”的确认。

交付记录：docs/reviews/2026-10-23-three-appearances-implementation.md。该记录作为待核验材料，不作为验收通过的依据。

## 结论

**本轮不通过。**

三套外观选择、基本持久化、结果页业务状态的主体实现可用，自动化门禁全部通过。但起卦页在换外观时丢失部分业务状态，能够卡住启卦流程；青岚书院未按选定的 A 提案落地。另有辅助文字尺寸和验收脚本判定需要修正。

本次未修改业务代码，未 commit、未 push、未部署。新增本报告；独立复测脚本和截图放在忽略目录中。

## P1-01：切换视图重挂载输入与随机取数器，导致丢输入和启卦卡住

代码位置：

- src/components/sections/DivinationForm.tsx:36、104：切换 CastView 的组件类型。
- src/components/ui/NumberBox.tsx:41：未完成的原始文本保存在子组件本地。
- src/components/ui/NumberBoxRandomizer/index.tsx:31、33：禁用态、随机取数控制器仍保存在子组件本地。
- src/components/sections/DivinationForm.tsx:30、44：父层保留 rollingNumbers，依据它禁止提交。

### 复现 A：未满三位的数字丢失

1. 打开正式 /divination。
2. 在第一灵数输入 12。
3. 通过顶栏切换到另一外观。
4. 输入框从 12 变为空。

独立复测青岚→朱砂、朱砂→夜航、夜航→青岚均出现。

原因：父层只持有 number | null。12 在父层表示 null，真实文本只存在 NumberBox 内；更换 CastView 类型会卸载整棵输入子树，重新挂载时文本由 null 初始化为空。未完成输入同样属于用户输入，不能只验证完整的三位整数。

### 复现 B：取数进行中换外观，启卦无法恢复

1. 青岚书院中输入 123 / 456 / 789，确认可以启卦。
2. 启动第一灵数的随机取数，尚未点停止。
3. 切到夜航观象。
4. 三个子取数器全部回到 idle，但父层仍提示“灵数流转中，点「停止」定下此数”。
5. 第一数手动改成 329，并等待超过原自动停止时限（实测 10.5 秒）。
6. 三数均合法，启卦仍 disabled；页面也没有与该父层滚动态对应的“停止”按钮。

原因：旧控制器被卸载，定时器被清理，原 onRandomEnd 不再触发；父层 rollingNumbers 却保留 true。用户必须重新启动并停止一个新取数器，或离开页面，才能恢复正常。

### 修复要求

- 将原始输入文本与随机取数控制器的完整状态移到不会随外观变化而卸载的稳定层；或采用其他确实保留实例与状态的结构。
- 原始文本、合法数值、滚动中/锁定态、输入禁用、停止/超时回调应保持一致。
- 不得以清空表单、刷新或切换路由来恢复。
- 补充未满三位、无效三位、滚动中、停止后再切换的定向用例。至少覆盖三个方向间的切换。

证据：

- screenshots/appearance-audit/report.json → functional。
- screenshots/appearance-audit/rolling-after-switch.png。
- 可复现脚本：tmp/audit-appearances.mjs。

## P1-02：青岚书院替换成旧版页面，没有交付选定的 A 提案

代码位置：

- src/components/appearances/qinglan/HomeQinglan.tsx:86–111。
- src/components/appearances/qinglan/CastQinglan.tsx。
- src/components/appearances/qinglan/ResultQinglan.tsx。
- 提案参照：src/pages/DesignGallery.tsx:436 起，以及 src/styles/design-gallery.css。

用户确认的 A 提案是浅纸青绿、左右分区、拱形山水插画的“慢下来，读懂此刻的自己”；起卦与结果也有对应版式。正式青岚目前使用的是提案之前“于变化之中，寻一份从容”的通栏山水旧版，以及旧版起卦/结果视图。

交付记录 §3.4 将“保留现有生产调色板”作为有意偏离的理由，但原需求要求三套提案全部保留为正式外观，没有授权以旧版替换 A。问题涉及布局、插画组织与强调色，不只是文案不同。

### 修复要求

- 对照 /design-preview?direction=a&page=home|cast|result，落地三张 A 提案对应的正式视图。
- 保留真实数据与业务能力，可以为正式功能补充必要元素；不能直接把预览中的演示交互拿来充数。
- 全站框架可因共享导航和外观入口而统一，不要求逐像素复制预览 Header。
- 不得擅自将本项写为“有意为之，验收通过”；如希望改变设计，需作为待用户确认的设计变更提出。

对照证据：

- 原提案：screenshots/appearance-audit/reference-a-home-1440.png。
- 当前正式页：screenshots/appearance-audit/qinglan-home-1440.png。

## P2-01：朱砂档案的选数进度仍为 9.6px

代码位置：

- src/components/appearances/zhusha/CastZhusha.tsx:197。
- src/styles/appearance/zhusha.css:1005、1025。

“已选定 0 / 3 个灵数”使用 small 标签，但 .zh-status small 没有指定字号；父层为 12px，浏览器 small 的默认 80% 最终得到 9.6px。

1440 / 1024 / 768 / 390 / 320 五档独立实测均如此。该文字属于有意义的操作状态，不是装饰。这里的至少 12px 是本项目明确约定，不是声称 WCAG 规定统一最小字号。

修复：为该元素明确设置辅助文字字号，并检查已选数量、滚动中、就绪等状态；补充计算样式验证。

证据：screenshots/appearance-audit/report.json → matrix 中朱砂档案 /divination 的 tiny 字段。

## P2-02：验收脚本与汇总不足以支持“0 失败，全部完成”

### 已发现的问题

1. scripts/acceptance-appearances.mjs:243–247 只把横向溢出加入 failures。对比度、smallType、目标尺寸只输出日志。原交付 JSON 自身已经记录朱砂档案全部五档 9.6px，failures 仍为空。
2. 200% 部分（同文件 :298–325）实际调用 Emulation.setDeviceMetricsOverride，设置宽度减半、deviceScaleFactor: 2、mobile: true/false。这是模拟条件，不能表述为已执行真实浏览器缩放。尤其真实桌面缩放不会把桌面浏览器自动改成 mobile 模式。
3. cssW < 320 时，即便溢出也主动记为 OK。原 JSON 有三外观共九项 195px 溢出，但最终仍“0 失败”。低于设计下限可以单独说明，不应在交付汇总中省略其豁免条件；本项不据此认定产品必须支持 195px。
4. 正文所称的完整矩阵与脚本覆盖不同：PAGES 缺社区与 404，加载/错误状态不在浏览器主矩阵中。组件测试可以补充证据，但不能写成已经完成该浏览器矩阵。此次独立复测已补社区和 404。
5. scripts/contrast-appearances.mjs 的像素统计选择全区域 maxDiff 的 90% 以上，再算中位字色/底色；它偏向差异最大的字芯，不能把结果命名为整个文字区域的“最差对比度”。缺少匹配元素还直接跳过，不能据此证明所有目标都已验收。

### 修复要求

- 对必须满足的字号、非豁免对比度等项目真正累积失败并设置非零退出码；豁免项明确标注原因。
- 为“未找到预期目标”和覆盖缺项设失败或明确未覆盖状态，不默默跳过。
- 真实浏览器缩放验收另行完成，记录浏览器缩放值、实际 CSS 视口、操作方法及截图；模拟矩阵保留但正确命名。
- 原始探针、截图与汇总保持一致，重跑后更新交付记录。
- 对图片/渐变上的文字按实际位置复核；中位数结果不能替代最弱落点的检查。

## 已独立确认通过的部分

### 门禁

| 检查 | 实际结果 |
| --- | --- |
| npm test | 50 文件 / 436 用例通过 |
| npm run typecheck | 通过 |
| npm run build | 通过；构建后恢复了运行前 public/sitemap.xml 的原始字节 |
| worker/npm run build | 通过 |

本次没有修改 Worker 路由，未重复运行 Worker 集成测试。

### 浏览器

- 三外观 × 九类页面 × 五档宽度，共 135 组。
- 页面：/、/divination、真实预置记录的 /result/audit、/codex、/records、/settings、/feed、/hexagram/1、404。
- 宽度：1440、1024、768、390、320 CSS px。
- 每组先等待应用主内容与 h1 出现，再检查；未使用连接失败页作成功证据。
- 全部无横向溢出，无捕获到的页面 JavaScript 异常。
- 除上述朱砂进度文字外，扫描到的非装饰正文均未发现小于 12px 的字号。
- 顶栏切换及设置页方向键选择可用；Esc 关闭后焦点回触发按钮，Tab 关闭后可到设置入口。
- 预览页的方案切换没有改写正式外观偏好。
- 存储写入被拒绝时，当前页面仍可切换到夜航，并显示非阻塞说明；此项不声称刷新后仍可保存。

### 结果页业务状态

使用浏览器内的受控模拟响应，不调用真实付费 AI 或公开发布：

- AI 先出现第一段，切朱砂后追加第二段，再切夜航；内容继续累积。
- 请求完成后缓存显示正常，刷新仍能读取解读。
- 云端保存成功后切换，仍显示本地与云端已存。
- 社区发布成功后切换，仍显示已发布入口。
- 整个成功序列 AI / 保存 / 发布各调用一次。
- 另一次请求模拟 429：三个外观间切换均保留错误与重试入口，不重复请求；显式重试后成功，共两次请求。

这些验证证明前端状态与调用次数，不代替真实部署联调。

证据与复现：

- screenshots/appearance-audit/report.json：135 组矩阵、未完成输入和滚动状态。
- screenshots/appearance-audit/state-report.json：流式、保存、发布、刷新缓存与键盘。
- screenshots/appearance-audit/errors-report.json：限流、重试与存储失败说明。
- tmp/audit-appearances.mjs、tmp/audit-appearance-state.mjs、tmp/audit-appearance-errors.mjs。

## 交回实施 agent 的修复顺序

1. 修复稳定父层与输入/随机取数状态边界；为两个可复现回归补测试。
2. 将正式青岚书院三页对齐选定的 A 提案。
3. 修复朱砂进度字号，补齐验收脚本的失败判定和真实缩放证据。
4. 重跑定向用例、完整门禁和受影响的浏览器矩阵；更新交付说明，保留未提交 diff，再交独立复验。
