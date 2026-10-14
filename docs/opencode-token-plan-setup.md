# OpenCode 接入阿里云百炼 Token Plan 套餐

**写于 2026-08-08**，记录本次事故：调用 architect Agent 被按量扣费，以及修复方案。

## 事故背景

`.opencode/agents/architect.md:5` 写的是：

```yaml
model: alibaba-token-plan-cn/qwen3.8-max
```

这个 provider ID **名字里虽然带 "token-plan"，但不会触发任何套餐逻辑**——OpenCode 的 `provider_id/model_id` 只是路由标识，名字里"plan"和"play"对计费没有任何影响。

实际请求是：

- `baseURL` 指向百炼**普通按量 endpoint**（`dashscope.aliyuncs.com/compatible-mode/v1` 之类）
- 鉴权用的是**普通按量 API key**
- 请求成功 → 百炼后台扣**按量余额**

结果：每次调用 architect 都被按量扣费。

## 关键事实

| 项            | 值                                                                   |
| ------------- | -------------------------------------------------------------------- |
| 产品名        | 阿里云百炼 Token Plan（**不是 Token Play，也不是 TalkingPlay**）     |
| 套餐 endpoint | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| 调用方式      | OpenAI 兼容（ `/chat/completions`、`Authorization: Bearer ...`）     |
| 模型 ID       | `qwen3.8-max`                                                        |
| 套餐 API key  | Token Plan 专属 key（与普通按量 key 不同，详情页一对一绑定）         |

## 最重要的规则

**endpoint 和 API key 是绑定的**。配错组合结果：

| endpoint       | key            | 结果                      |
| -------------- | -------------- | ------------------------- |
| 普通按量       | 普通按量       | 按量扣费（事故原状）      |
| Token Plan     | 普通按量       | 401/403 Unauthorized      |
| 普通按量       | Token Plan     | 401/403 Unauthorized      |
| **Token Plan** | **Token Plan** | **Token Plan 套餐扣费 ✓** |

来源：百炼控制台 → API-Key 管理 → 选中 Token Plan 套餐 key → 详情页里**同一个页面**显示 endpoint URL 和 key。这两个必须来自同一个详情页。

## 修复步骤

### 第一步：核对 endpoint + key 配对

1. 登录 https://bailian.console.aliyun.com/?tab=model#/model-market
2. 进入 API-Key 管理 → 找到 **Token Plan 套餐**对应的 key（不是普通按量 key）
3. 详情页里同时复制：
   - 该 key 的 **endpoint URL**（应该是 `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`）
   - 该 key 本身
4. 不要从别的地方混搭 endpoint 和 key

### 第二步：curl 验证（**必须在改 OpenCode 配置之前做**）

```powershell
$env:BAILIAN_TOKEN_PLAN_API_KEY = "从 token plan key 详情页复制的 key"

$body = '{"model":"qwen3.8-max","messages":[{"role":"user","content":"只回复 OK"}],"stream":false}'

curl.exe -X POST `
  "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions" `
  -H "Authorization: Bearer $env:BAILIAN_TOKEN_PLAN_API_KEY" `
  -H "Content-Type: application/json" `
  -d $body
```

**立刻去百炼后台核对**：

| 检查项            | 期望                                                |
| ----------------- | --------------------------------------------------- |
| HTTP 状态         | 200 OK                                              |
| 响应里的 model 名 | `qwen3.8-max`                                       |
| 扣费来源          | **Token Plan 套餐剩余额度减少**（不是按量余额减少） |

**如果扣的是按量余额 → 立刻停下来**，key 或 endpoint 配错了，**不要继续往下做**。

### 第三步：写 OpenCode 全局配置

文件：`C:\Users\齐\.config\opencode\opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "bailian-token-plan": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Alibaba Bailian Token Plan",
      "options": {
        "baseURL": "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        "apiKey": "{env:BAILIAN_TOKEN_PLAN_API_KEY}"
      },
      "models": {
        "qwen3.8-max": {
          "name": "Qwen 3.8 Max - Token Plan"
        }
      }
    }
  },
  "disabled_providers": ["alibaba-token-plan-cn"]
}
```

PowerShell 设置环境变量（**不要把真实 key 写进配置文件**）：

```powershell
$env:BAILIAN_TOKEN_PLAN_API_KEY = "从 token plan key 详情页复制的 key"
```

建议把这条 export 放到 `$PROFILE` 里，OpenCode 启动时自动加载。

### 第四步：恢复并更新 architect.md

1. 把 `D:\eight\.opencode\agents\architect.md.disabled` 重命名回 `architect.md`
2. 把第 5 行改成：

   ```yaml
   model: bailian-token-plan/qwen3.8-max
   ```

### 第五步：在 OpenCode 里跑一次最小调用，再次核对账单

```powershell
opencode debug config
```

应该看到：

- `bailian-token-plan` provider 已注册
- `alibaba-token-plan-cn` 出现在 `disabled_providers`

然后开 OpenCode 跑一条短 prompt，**再去百炼后台核对这次调用也走 Token Plan 套餐扣费**（不是按量）。

## 不要做的事

- ❌ 不要把旧百炼按量 key 配到 Token Plan endpoint → 401
- ❌ 不要把 Token Plan key 配到普通按量 endpoint → 401
- ❌ 不要在没核对账单的情况下接入 OpenCode → 假阳性
- ❌ 不要把真实 API key 写进配置文件 → 用环境变量
- ❌ 不要靠"provider ID 名字"判断计费方式 → 名字是名字，计费看 endpoint + key
- ❌ 不要尝试用 OAuth / IAM 等替代鉴权 → 阿里云 OpenAI 兼容 API 用的是 API key 鉴权

## 引用

- 百炼控制台：https://bailian.console.aliyun.com/?tab=model#/model-market
- 阿里云 Model Studio OpenAI 兼容文档：https://www.alibabacloud.com/help/en/model-studio/developer-reference/compatibility-of-openai-with-dashscope
- OpenCode Config 文档：https://opencode.ai/docs/config/
- OpenCode Providers 文档：https://opencode.ai/docs/providers/
- OpenCode Models 文档：https://opencode.ai/docs/models/

## 关联变更

本次问题与项目代码无关，不影响 `origin/main`。修 OpenCode 全局配置 + `.opencode/agents/architect.md` 是本地机器配置，**不应 commit 到项目仓库**。
