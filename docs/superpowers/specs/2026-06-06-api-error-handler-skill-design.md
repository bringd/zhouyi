# api-error-handler Skill Design

**Date:** 2026-06-06
**Status:** Approved (brainstorming complete)
**Scope:** Claude Code user-level skill (lives at `~/.claude/skills/api-error-handler/`)

## Purpose

When Claude Code encounters an API error (HTTP 4xx/5xx, network failure, auth failure, timeout, rate limit, etc.), this skill provides a structured way to ask qwen3.5-omni-plus-realtime for a diagnosis and retry-parameter suggestions. Claude uses the suggestion to decide whether and how to retry.

## Scope

- **In scope:** Any tool/API call that produces an API-shaped error (Bash running `curl`/CLI tools, WebFetch failures, MCP tool errors, etc.).
- **Out of scope:** Business-logic errors, syntax errors, non-API failures. Those should be handled by normal debugging, not this skill.

## User-Facing Behavior

1. Claude sees an API error in a tool result.
2. Claude (or the user, via `/api-error-handler`) invokes the helper.
3. The helper returns qwen's diagnosis + suggested retry parameters as JSON on stdout.
4. Claude reads the JSON and decides: retry with the suggested params, retry as-is, or give up.
5. Claude reports the outcome to the user in a short structured summary (cause + change + result).

Auto-retry is **not** performed by the helper itself — Claude stays in the loop so it can sanity-check the suggestion before acting.

## Components

Two files only:

```
~/.claude/skills/api-error-handler/
├── SKILL.md       # behavioral instructions for Claude (~50 lines)
└── qwen-call.mjs  # WebSocket helper, ~80 lines
```

Plus a `package.json` declaring the single dependency (`ws`).

### `SKILL.md`

Frontmatter:
```yaml
---
name: api-error-handler
description: When Claude Code encounters an API error (HTTP 4xx/5xx, network timeout, auth failure, rate limit), call qwen3.5-omni-plus-realtime for diagnosis and retry-parameter suggestions. Use when an API call fails and a second-opinion diagnosis would help.
---
```

Body sections:
1. **When to use** — list of error patterns that should trigger invocation (HTTP status codes, `ECONNREFUSED`, `ETIMEDOUT`, `401/403/429/5xx`).
2. **When NOT to use** — business-logic errors, syntax errors, user typos.
3. **How to invoke** — exact Bash command: `node ~/.claude/skills/api-error-handler/qwen-call.mjs --context "<error text>"`.
4. **Output interpretation** — schema of the returned JSON, what fields mean.
5. **Retry decision** — guidelines for when to apply qwen's suggestions (e.g., confidence ≥ 0.7, modification is in the allowlist).
6. **Reporting** — how to summarize to the user (cause + diff + result).

### `qwen-call.mjs`

Single Node.js script using the `ws` library. Responsibilities:

1. Parse `--context` (or read from stdin if no flag).
2. Verify `DASHSCOPE_API_KEY` is set in env. If missing, write a clear message to stderr and `exit 0` (do not block Claude).
3. Open a WebSocket to `wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3.5-omni-plus-realtime`, with `Authorization: Bearer ${DASHSCOPE_API_KEY}` header.
4. Send three messages in order:
   - `session.update` (modalities: text)
   - `conversation.item.create` with the error context as an `input_text` item
   - `response.create`
5. Collect `response.text.delta` events until `response.text.done`, concatenate into a single string.
6. Print the concatenated text to stdout and `exit 0`.
7. On any internal error (connection refused, timeout, malformed response): write a short warning to stderr and `exit 0`. Never block Claude.

Timeouts (hardcoded):
- WS handshake: 10s
- First delta: 15s
- Total: 60s

No reconnection logic (YAGNI). If the connection fails, fail open and let Claude handle the error normally.

## Data Contract (qwen output)

The helper returns whatever qwen produces in `response.text.delta`. The prompt template in the helper instructs qwen to return JSON in this shape:

```json
{
  "diagnosis": "human-readable cause of the error",
  "category": "rate_limit | auth | network | server_error | client_error | unknown",
  "retryable": true | false,
  "suggested_modifications": {
    "timeout_ms": 60000,
    "headers": { "X-Example": "value" },
    "retry_interval_ms": 30000
  },
  "confidence": 0.0
}
```

Claude (not the helper) is responsible for:
- Parsing the JSON
- Validating `suggested_modifications` against an allowlist (`timeout_ms`, `headers`, `retry_interval_ms`, `method` only — never path, body fields, or resource IDs)
- Deciding whether to apply the suggestion (e.g., require `confidence >= 0.7` and `retryable == true`)

## Trigger

**Manual only in v1.** User invokes `/api-error-handler` (slash command auto-generated from skill name), or Claude invokes the helper directly when it judges an error warrants analysis.

Hook-based auto-trigger is intentionally deferred (YAGNI). If the user later wants PostToolUse automation, it can be added by editing `~/.claude/settings.json` — no design changes needed.

## Configuration

| Setting | How | Default |
|---------|-----|---------|
| `DASHSCOPE_API_KEY` | env var | (required) |
| `QWEN_MODEL` | env var (override model id) | `qwen3.5-omni-plus-realtime` |
| Helper CLI flags | `--context=<text>`, `--timeout=<s>` | (none / 60s) |

## Error Handling

The helper **must never crash Claude's session**. All failures are reported as warnings and the helper exits 0:

- Missing API key → stderr warning, exit 0
- WS connect failure → stderr warning, exit 0
- qwen returns non-text / timeout → stderr warning, exit 0
- qwen returns text that doesn't look like JSON → stderr warning, exit 0 (Claude will see raw text and decide what to do)

This is the "fail open" principle: the skill is a helper, not a dependency. Claude should always retain the original error and can still proceed without qwen's input.

## YAGNI (Explicitly Not Doing)

- ❌ Auto-retry execution (Claude decides)
- ❌ Hook-based automatic trigger
- ❌ Multi-file module split
- ❌ Unit / integration tests (add later if bugs appear)
- ❌ Log files or audit trail
- ❌ State file / re-entrancy protection
- ❌ WebSocket reconnection logic
- ❌ Streaming output (collect full response, print once)

## Open Questions

None. Scope is intentionally narrow.

## Success Criteria

The skill is successful when:
1. `/api-error-handler` (or Claude's invocation) returns a useful diagnosis within ~5s for typical API errors.
2. If `DASHSCOPE_API_KEY` is unset, the user gets a clear one-line warning, not a stack trace.
3. The skill never breaks Claude's normal error handling.
4. Total footprint stays under 150 lines of code + markdown.
