# 图鉴与爻线修复发布记录

发布时间：2026-10-26（北京时间）。此文件为发布后保存的本机记录。

- 发布提交：`1dc451dde691642b3ce1536dba63899d3cc975d6`。
- GitHub `main` 已更新，Cloudflare Pages 检查结论为 `success`，标题为 `Deployed successfully`。
- 正式地址：[易象阁](https://orix-studio.pages.dev/codex)。
- 此次固定版本：[c6c43650.orix-studio.pages.dev](https://c6c43650.orix-studio.pages.dev/codex)。
- [Cloudflare 构建记录](https://dash.cloudflare.com/?to=/07a215e88312dd539584c8afd4d0fee1/pages/view/orix-studio/c6c43650-3106-4868-8624-00ebb0a79af0)。

## 发布范围

合并发布 [图鉴修复](D:/eight/docs/reviews/2026-10-24-codex-fixes.md) 与 [爻线、AI、存档和同源 API 修复](D:/eight/docs/reviews/2026-10-23-yao-contrast-functional-fixes.md)，共 45 个文件。未部署 Worker、未迁移数据库或更改模型密钥。

保留了本地其他验收脚本、实现报告、sitemap 及临时文件的未提交改动，没有将其纳入此次提交。Git 的旧本机代理不可用，发布使用单次命令关闭该代理，没有改动全局配置。

## 验证

- 522 项根目录测试、根目录类型检查、Worker 构建通过。
- 15 项 Worker 集成测试通过。Windows Miniflare 的 EBUSY 清理警告不影响测试退出码。
- 生产构建通过，根中间件与 AI Functions 已复制到构建目录。
- 线上 `index-D__IS8gM.js` 已生效；PageLayout、卦文数据、Codex、HexagramDetail、Result、Feed 六个脚本均与本地构建逐字节匹配。
- 线上包含搜索、卦序视图、阅读目录、逐爻小象、用九／用六；乾卦已改为“大明终始”“六爻皆阳”。
- 乾、损、未济详情及起卦、卦册、社区入口均返回正确 SPA。
- 同源 API 实际保存一条专用测试记录（201），使用同一 Cookie 找回，删除成功（204），再次查询为 404。测试记录已清理。
- Cookie 实测为主机限定，包含 HttpOnly、Secure、SameSite=Lax；跨站写入被拒绝（403）。社区列表读取正常。
- AI 代理实际返回 200，模式为 demo、模型为 MiniMax-M3，返回预期文本 OK。未记录或输出模型密钥。

## 已知边界

现有线上 Worker 尚未提供 `GET /api/auth/me`，通过 Pages 转发后返回 404。此次没有更新 Worker；云端记录的同一会话保存、读取、删除已独立实测通过。该接口缺失不应被误报成所有后端功能通过。

本轮浏览器自动化超时，线上复核采用实际 HTTP 请求和构建文件哈希比对；三套外观和 64 个详情页的浏览器验收沿用发布前记录。此次没有声称新增线上截图或重新完成浏览器外观矩阵。

本机证据：`tmp/release-20261026/production-verification.json`、`github-status.json`、`build.log`、`worker-tests.log`。检查脚本最初将正常的 DELETE 204 误判为失败，已修正为接受 200／204，并依据原始响应重新判定，没有为此重复写入生产数据。
