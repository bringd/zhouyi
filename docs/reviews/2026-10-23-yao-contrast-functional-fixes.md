# 动爻可辨识度与功能复验

日期：2026-10-23。基线：已发布的 `ad352b8`；修复分支：`codex/yao-contrast-functional-fixes`。

## 结论

本地验收通过。修复尚未提交、推送或部署，线上仍是此前发布的版本。

此次检查覆盖三套外观、桌面与手机布局，以及起卦、AI、浏览器存档、云端卦册、社区和下载流程。下列结果不代表所有浏览器或所有异常场景均已穷尽。

## 已修复问题

| 问题 | 原因与修复 |
| --- | --- |
| 部分底色下动爻不醒目 | 首页、结果页和外观样式分别覆盖爻线颜色；详情页小卦象还使用硬编码颜色。改用共享的普通爻/标记爻色板，浅色外观用深朱砂、夜航用亮珊瑚色；动爻和已变爻额外显示菱形。阴爻只给两个线段着色，保留断口。 |
| 下载卡片未突出动爻 | 原 SVG 六根爻线都为金色。导出卡片现在将对应爻线置为白色，并在同一高度绘制菱形和“动”字。覆盖初爻至上爻、阴爻与阳爻。 |
| 云端游客身份不能稳定保存 | 前端跨站访问 Worker，`SameSite=Lax` Cookie 无法正常用于此跨站请求。新增 Pages 根中间件代理 records/feed/favorites/auth，前端生产默认访问同源 API。会话 Cookie 保留 HttpOnly/Lax、限定 Pages 主机，HTTPS 下添加 Secure；只转发应用会话 Cookie；拒绝跨站写请求。AI 路由继续进入原处理函数。 |
| 本地存档失败仍跳转 | 起卦表单忽略 `saveRecord()` 的 false 返回值。现在显示错误并停留在表单，避免进入“记录未找到”。 |
| AI 流式响应卡住后无限加载 | 原先收到响应头就清除超时。现在 60 秒保护覆盖响应体读取；流连接中断转换为稳定的 `network-error`，超时转换为 `timeout`，UI 可重试。 |
| 解读未存档却显示“已保存” | 解读写入失败时保留内存中的正文，显示明确警告，隐藏已保存标记，仍支持下载或云端收藏。三套外观共用此业务状态。 |
| 社区部分点击区域偏小 | 空白页“起一卦”、详情页“返回卦册”和“改名”入口增加至少 24px 的高度。 |

## 验收证据

- `npm test`：54 个文件，485 项通过。新增回归覆盖存储失败、流超时/中断、同源代理与客户端 URL、六个爻位以及阴阳 SVG 导出。
- `npm run typecheck`、`npm run build`、`npm --prefix worker run build`：通过。
- `npm --prefix worker test`：15 项通过。Windows Miniflare 临时目录 EBUSY 为清理警告，测试退出码为 0。
- `git diff --check`：通过。
- 三套外观 × 八个页面 × 两档尺寸（390/1440）：48 组，DOM 探针没有字号、正文对比度、目标尺寸或横向溢出失败。
- 社区详情三套外观 × 两档尺寸：6 组通过；合计 54 组页面检查。
- 54 个标记爻的最终计算色与菱形颜色一致；按祖先背景透明度合成计算，最低背景对比度为 5.522:1。该数值是 CSS 色值计算，不声称是位图逐像素测量；另人工查看实际截图与下载 PNG。
- 实际浏览器：`129/257/601 → 乾为天，初爻动 → 天风姤`；本卦实线、变卦断线均显示对应标记。详情小卦象可见当前爻标记。
- 真实 AI 请求完整生成六节，切换外观及刷新后仍显示缓存。
- 在隔离的本地 D1 中，保存云端记录后刷新仍能找回；HTTP 联调验证修改备注、删除、跨站写入拒绝。实际浏览器验证社区发布、打开详情、发布评论成功。
- 浏览器实际下载新版 PNG，确认动爻白色线段与菱形/文字标记正确。

证据文件（本机、gitignored）：

- `tmp/yao-contrast-20261023/matrix.json`
- `tmp/yao-contrast-20261023/community-detail.json`
- `tmp/yao-contrast-20261023/glyph-contrast.json`
- `tmp/yao-contrast-20261023/http-smoke.json`
- `tmp/yao-full-tests.log`、`tmp/yao-worker-tests.log`、`tmp/yao-build.log`
- `screenshots/yao-contrast-20261023/result-final.png`
- `screenshots/yao-contrast-20261023/yehang-mini-lines.png`
- `screenshots/yao-contrast-20261023/card-final.png`

## 发布与已知边界

Pages 继续通过 main 的 Cloudflare GitHub 集成部署，构建会将根中间件复制到 `dist/functions/`。本轮不需要更新 Worker 代码、数据库结构或模型密钥。`COMMUNITY_API_ORIGIN` 可覆盖代理目标；生产默认使用原 Worker，本地验收指向隔离的本地 Worker。

发布前应核对 Pages 是否设置了 `VITE_FEED_API_BASE`：若仍强制指定跨站 Worker URL，应清除或改为同源，才能使用本轮会话修复。

Pages 主机上的游客会话是新 Cookie，原 Worker 域已有游客 Cookie/云端数据不会自动迁移；本地记录保留。此前受跨站 Cookie 限制的云端数据若需恢复，应另做有身份校验的迁移，不能凭前端提供的任意会话值认领。

已知限制：云端收藏/社区发布的完成状态仍为页面内状态，刷新后不做跨刷新去重。本轮没有实现账号体系或历史云端数据迁移。上轮报告中的像素对比度脚本边界缺陷也未改动，本轮不以该脚本作为动爻验收依据。仓库 lint 缺失 eslint 依赖/配置的问题仍在，未声称 lint 通过。

本轮保留原有 `public/sitemap.xml` 的修改及 `.tmp-wrangler.err`、`verify-local.ps1` 本地文件，未将其混入修复。
