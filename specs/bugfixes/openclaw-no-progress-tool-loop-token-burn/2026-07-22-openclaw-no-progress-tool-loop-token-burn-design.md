# OpenClaw 无进展工具循环导致积分耗尽修复设计文档

> 状态：Implemented — 自动化验证完成，待真实桌面 / 原生飞书端到端验证
>
> 最后更新：2026-07-26
>
> 上游核对快照：OpenClaw `v2026.7.1`、`v2026.7.2-beta.3` 与 2026-07-26 的 `main`

## 1. 概述

### 1.1 用户问题与事故边界

2026-07-20 的用户日志中存在两个时间相邻但根因不同的故障，必须拆开处理：

1. 13:57 的桌面 WebChat Run 在 Agent 修改 OpenClaw 生成配置后发生 Gateway 退出和 WebSocket 1006 断开。该 Run 约 95 秒后结束，能够解释桌面窗口中断，但不是持续消耗积分的任务。
2. 15:55 的飞书私聊 Run 持续到 16:29，最终只因上游返回 `40202 本月积分已用完` 而结束。本文只处理第二个 Run 暴露出的无进展工具循环和积分止损问题；Gateway 配置自修改与崩溃应另立问题处理。

飞书任务本身很简单：用户要求把两份明确的清洁文档和一份描述为“修复版”的文件发送到手机。Agent 在任务早期已经找到并读取：

- `台面清洁-夫妻回忆录.md`
- `马桶盖板清洁-夫妻回忆录.md`
- 候选文件 `卫生间清洁-最终方案.md`

Agent 没有发送两份确定文件，没有询问第三份文件指的是哪一份，也没有产生最终回复。随后进入参数变化型目录扫描循环。

现场统计如下：

| 指标                               |                          现场值 |
| ---------------------------------- | ------------------------------: |
| Run 时长                           |                     33 分 52 秒 |
| 实际 Provider / Model              | `lobsterai-server/qwen3.5-plus` |
| 含工具调用的模型轮次               |                             225 |
| 工具调用总数                       |                             226 |
| `exec` 调用                        |                             217 |
| 同一目录模板调用                   |                             214 |
| 完全相同的成功目录结果             |                             205 |
| 完全相同的 Int32 溢出错误          |                               5 |
| 发送消息、上传、附件或媒体工具调用 |                               0 |
| Usage `totalTokens` 汇总           |                      29,965,239 |

214 次目录调用使用同一个命令骨架，只改变 `First N`：

```powershell
Get-ChildItem -Path "<project>" -Name |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First N
```

从 `N=80` 起，成功结果已经逐字相同；`N=80/100/120` 第三次返回相同结果时，累计 `totalTokens` 为 1,150,553。此后仍消耗 28,814,686 Token，占本次记录的 96.16%。

客户端 JSONL 中 `usage.cost.total` 均为 0，因此无法从客户端换算精确积分。补偿金额必须以服务端计费流水为准，但“任务未交付、Run 无进展循环、最终由积分耗尽终止”已经有完整证据。

### 1.2 根因链路

```text
第三份文件描述不明确
  → Agent 在已找到两份确定文件和一个候选文件后仍继续扫描
  → 每次只增大 Select-Object -First N
  → 完整参数 Hash 每轮不同
  → genericRepeat / no-progress 无法累计
  → 调用结果成功，Aborted 专项检测不参与
  → 不是两个精确签名交替，ping-pong 检测不参与
  → detector 从未产生 critical tool-loop
  → 已有 critical Run 终止补丁没有机会执行
  → 当前系统又没有独立于滑动窗口、跨自动恢复共享的客户端运行预算
  → 重复结果持续进入后续模型上下文
  → 单轮输入越来越大，直到账号积分耗尽
```

### 1.3 当前保护为什么没有生效

LobsterAI 当前固定 OpenClaw `v2026.6.1`，并已在 managed config 中启用：

```json
{
  "tools": {
    "loopDetection": {
      "enabled": true,
      "historySize": 40,
      "warningThreshold": 6,
      "unknownToolThreshold": 6,
      "criticalThreshold": 10,
      "globalCircuitBreakerThreshold": 16,
      "detectors": {
        "genericRepeat": true,
        "knownPollNoProgress": true,
        "pingPong": true
      }
    }
  }
}
```

现有实现已经解决了三类问题：

- 同一工具、同一完整参数、同一结果的重复调用；
- `command_status`、`process poll/log` 等已知轮询；
- 两个精确工具签名之间的 ping-pong；
- `Aborted` 结果的专项累计与旧历史清理；
- detector 已经判定 critical 后，通过 `terminate: true` 和 `shouldStopAfterTurn` 真正结束 Run。

但 `hashToolCall(toolName, params)` 使用完整参数，`getNoProgressStreak()` 同时要求 `toolName + argsHash + resultHash` 相同。本次 `N` 每轮变化，导致 205 次相同结果被分散到不同参数签名。

现场后半段还把 41 个 `N` 值完整循环了 4 次，而 detector 的 `historySize` 只有 40。即使某个完整参数在下一轮再次出现，上一次同参数记录也刚好已经滑出窗口，因此 exact-args 计数始终无法积累。

本次主修复不是再次修改 critical 终止，而是让 detector 能在安全边界内识别“参数窗口变化，但操作族和结果都没有变化”。

### 1.4 上游版本与 PR 调研结论（2026-07-26）

本设计不能把“上游有人提交 PR”视为“当前用户已经获得保护”。截至核对时间：

| 上游表面                                                                                 | 当前状态        | 与本文关系                                                                |
| ---------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------- |
| [`v2026.7.1`](https://github.com/openclaw/openclaw/releases/tag/v2026.7.1)               | 最新稳定版      | 尚无参数族 detector、已发布的 Run 轮次硬预算或 critical 后完整终止修复    |
| [`v2026.7.2-beta.3`](https://github.com/openclaw/openclaw/releases/tag/v2026.7.2-beta.3) | 最新 prerelease | 同样不包含下列仍未合并的关键 PR                                           |
| LobsterAI 固定版本                                                                       | `v2026.6.1`     | 必须继续通过版本化 patch 交付，不能假设升级或 `main` 上的工作已经进入产品 |

近期上游工作与本文的覆盖关系如下：

| Issue / PR                                                                                                                                                            | 状态                      | 解决层次                                                         | 对本次 41 参数轮转的覆盖                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`#94412`](https://github.com/openclaw/openclaw/pull/94412) `stop loop after aborted tool run`                                                                        | 已合并并进入 `v2026.6.11` | 工具执行导致 abort 后，不再发起下一次模型请求                    | 不覆盖；本次 205 个主要结果均为成功结果。LobsterAI 已有相应 backport，升级时再去补丁                                                             |
| [`#110633`](https://github.com/openclaw/openclaw/pull/110633) `stop runs at the critical tool-loop threshold`                                                         | Open，未合并              | detector 已经 critical 后真正结束 Run                            | 部分重叠；本次 detector 从未 critical，因此不能单独解决                                                                                          |
| [`#112620`](https://github.com/openclaw/openclaw/pull/112620) `stop stable tool argument churn`，对应 [`#112479`](https://github.com/openclaw/openclaw/issues/112479) | Open Draft，未合并        | 同一工具在少量稳定参数变体间反复切换时，复用 global breaker veto | 根因高度相似，但当前算法不足以覆盖本次高基数轮转，也不负责完整 Run termination                                                                   |
| [`#97485`](https://github.com/openclaw/openclaw/pull/97485) `maxToolCallingRounds`                                                                                    | Open，未合并              | 对单 Run 的 LLM 工具调用轮次设置 opt-in 上限                     | 当前 head 在超限响应之后还会尝试一次模型总结，不能作为成本硬边界，不能替代 FR-4 的 raw-call reservation 或 FR-12 的 pre-dispatch Provider 双预算 |
| [`#97577`](https://github.com/openclaw/openclaw/pull/97577) session-global no-progress breaker                                                                        | Closed，未合并            | 尝试跨工具、跨参数按稳定结果累计 global streak                   | 方向更宽，可能覆盖本次，但上游没有接受；说明通用跨参数合并仍有误判与证据风险                                                                     |
| [`#112447`](https://github.com/openclaw/openclaw/pull/112447) consecutive identical calls                                                                             | Open，未合并              | 相同参数但结果持续变化时，按连续调用次数升级                     | 属于相邻盲区，不是本次“参数变化、结果相同”根因；本文由 scope 级三项预算兜底                                                                      |

本次核对的关键 PR head 分别为：`#110633 dd7ef9156a50`、`#112620 e1c1e98d31da`、`#97485 83cd9e7c43b2`、`#97577 6480eaafbd42`、`#112447 054b72d34208`。后续判断必须以新的 head 和目标 tag 为准。

实施开始复核（2026-07-26）：LobsterAI 目标仍为 OpenClaw
`v2026.6.1 @ 2e08f0f4221f`。GitHub 结构化元数据确认上述五个 PR
的 state、draft 状态、head SHA 和 `mergedAt` 均未发生变化；
`#94412 @ e11d9718e3cd` 已于 2026-06-22 合并。当前目标 tag 不包含
这些后续能力，因此本次继续交付版本化客户端 patch，不因 PR 已存在而
跳过任何本地保护。

`#112620` 当前算法要求至少两个参数变体分别出现 3 次，并要求新探测参数不超过连续同工具历史的 20%，最终仍达到现有 global threshold。它还明确放行“15 个参数变体完整执行两遍”的普通批处理。

本次现场后半段是 41 个 `First N` 值循环 4 次，而 `historySize=40`。在任意 40 条历史中，同一个完整参数最多出现一次，无法进入 `#112620` 所需的稳定核心。因此：

1. `#112620` 证明上游已经确认“变化参数绕过 exact argsHash”是独立问题；
2. 它可以在未来作为低基数通用 churn detector 的补充，但不能替换本文的保守参数族 detector；
3. 本文必须继续用 allowlist 将 `Select-Object -First N` 归并为同一 `familyHash`，并按跨参数的相同 `resultHash` 在第三次结果后终止；
4. `#97485` 当前 head 不能启用为成本保护：它在已经收到超限轮次响应后才判断，并会尝试额外模型总结；未来只有 summary 可关闭且 exhaustion 接入唯一 terminal owner 时，才可作为 after-response 的 tool-round execution backstop，但永远不能替代 FR-12；
5. `#110633` 若后续合并并进入 LobsterAI 目标 tag，可以接管唯一的 critical Run 终止 owner，但不能替换 detector、客户端 Provider 预算、native 终止交付和历史折叠；
6. 上述 PR 状态和代码会变化，实施开始、OpenClaw 升级和正式发布前都必须重新核对，不能长期依赖本节快照。

### 1.5 修复目标

1. 对保守识别出的同一操作族，连续 3 次得到相同结果后，在下一次 Provider 请求前终止当前 Run。
2. 即使语义 detector 漏报，一次外部任务预算作用域也不能超过明确的工具 reservation 硬上限。
3. critical 后复用现有 Run 终止闭环，不再产生下一轮模型请求。
4. 继续旧会话时，不把数百组重复工具结果原样重新发送给模型。
5. 桌面端和原生 IM 渠道都能看到明确的自动停止原因，状态退出 `running`。
6. 用户主动停止原生 IM Run 时，即使本地没有 `ActiveTurn`，也能实际调用 Gateway abort。
7. 支持日志以 Run 的实际 Provider / Model 和结构化安全原因为准，不使用可能滞后的 session model 元数据判断计费。
8. 不误伤参数和结果都在真实变化的合法批量任务。
9. 客户端在每次 Provider dispatch 前执行 Provider 请求次数和累计 estimated Prompt token 预算，使较少工具调用但单次上下文巨大的 Run 也能在 provider adapter / transport 调用前被阻断。

### 1.6 非目标

- 不在客户端推算精确积分或补偿金额；自定义 Provider 的费率、缓存和计费方式可能完全不同。
- 不把 Prompt 调整当作唯一安全边界。
- 不禁用 `exec`、`read`、`web_fetch` 等工具。
- 不把所有“相同结果、不同参数”一律判为死循环。
- 不把未合并的 OpenClaw PR 或 `main` 分支代码当作已经发布到 LobsterAI 的能力。
- 不承诺“积分金额绝对不超过某个数”；本文承诺的是工具执行数、Provider dispatch 次数与累计 estimated Prompt 暴露量的本地硬边界。
- 不修改 LobsterAI 服务端账本、套餐额度或计费接口；本设计必须对 LobsterAI 自营模型、自定义远程模型和本地模型使用同一套运行时保护。
- 不把 conversation label、TTS、标题生成等非 embedded utility completion 纳入 Agent scope；它们通过不可由 Agent 选择的类型隔离入口维持各自一次性边界。
- 不重构整个 `openclawRuntimeAdapter.ts` 或 IM 网关。
- 不处理 13:57 的 Gateway 配置自修改与进程崩溃。
- 不在本次全局改变 shell 非零退出码的 `isError` 语义；Run 安全判断必须直接读取 `details.exitCode`。

## 2. 用户场景

### 场景 1：窗口参数变化但结果持续相同

**Given** Agent 连续调用同一只读操作族<br>
**And** 参数仅在已允许的窗口字段上变化<br>
**And** 三次结果指纹完全相同<br>
**When** 第三个工具结果完成并进入当前 turn 的收尾边界<br>
**Then** 系统必须将当前 Run 判定为 `variant_no_progress`<br>
**And** 不执行后续 Provider response 产生的下一次工具调用<br>
**And** 不再发起下一次 Provider 请求<br>
**And** 向用户说明任务已自动停止以避免继续消耗

### 场景 2：合法分页或批量读取

**Given** Agent 依次读取不同页面、不同 URL 或不同文件<br>
**When** 参数中的业务标识不同，或者每次结果指纹不同<br>
**Then** 参数族 detector 不应累计无进展 streak<br>
**And** 任务可以继续执行<br>
**And** 仍受当前客户端预算作用域的工具硬上限保护

### 场景 3：未知或可能产生副作用的工具

**Given** 工具不在参数族归一化 allowlist 中<br>
**Or** `exec` 命令无法被保守判定为只读查询<br>
**When** 参数每次变化且结果相同<br>
**Then** 不使用参数族 detector 自动判停<br>
**And** 由 exact-args detector、Aborted detector 和客户端工具硬上限兜底

### 场景 4：已有结果但用户目标仍不明确

**Given** Agent 已找到两份确定文件<br>
**And** 第三份文件仍有多个候选<br>
**When** 继续搜索已经连续产生相同结果<br>
**Then** 系统停止当前 Run<br>
**And** 用户可以在同一会话补充说明后发起新的 Run<br>
**And** 这条新的外部用户指令创建新的 `budgetScopeId` 和预算<br>
**And** 系统自动 retry、fallback、compaction 或恢复产生的新 Run 不得借此重置预算

### 场景 5：旧会话已经被重复工具结果污染

**Given** transcript 中存在连续多组同操作族、同结果的 assistant tool-only / toolResult 对<br>
**When** 用户补充信息并继续该会话<br>
**Then** 发送模型请求前只保留有限数量的完整重复对<br>
**And** 其余重复对不进入模型上下文<br>
**And** 原始 transcript 仍保留用于审计

### 场景 6：用户主动停止原生飞书 Run

**Given** 飞书 Run 在 Gateway 中仍为 running<br>
**And** LobsterAI 本地暂时没有对应 `ActiveTurn`<br>
**When** 用户从桌面端点击停止<br>
**Then** Adapter 必须解析原生 session key 和最近 runId<br>
**And** 调用 `chat.abort`，不能只把本地状态改为 idle<br>
**And** 后台不得继续调用模型或工具

### 场景 7：较少调用已经达到客户端 Provider 预算

**Given** 当前 Run 的初始上下文已经很大<br>
**And** 工具调用数尚未达到 64<br>
**When** 下一次请求将超过 Provider dispatch 次数或累计 estimated prompt token 预算<br>
**Then** 客户端必须在 provider adapter / transport 调用前终止当前预算作用域<br>
**And** 不触发 fallback、retry、compaction summary 或自动恢复请求<br>
**And** 用户收到明确提示，可通过新指令创建新的预算作用域后继续

## 3. 功能需求

### FR-1：保留现有结果指纹作为无进展证据

继续复用 OpenClaw 的 `hashToolOutcome()`：

- `exec` 结果指纹包含 `status`、`exitCode`、`timedOut` 和有效输出；
- 不把 `durationMs`、时间戳等易变诊断字段纳入结果指纹；
- 其他工具继续使用稳定序列化后的结果摘要；
- 日志只记录 Hash 前缀，不记录目录内容、文件内容或完整命令。

对于 `exec.details.exitCode != 0`，即使上层 `isError=false`，Run 安全逻辑也必须把它作为失败 outcome 参与相同错误指纹统计。

### FR-2：新增参数族指纹

为工具调用记录增加可选 `familyHash`：

```ts
type ToolCallRecord = {
  toolName: string;
  argsHash: string;
  familyHash?: string;
  resultHash?: string;
  runId?: string;
};
```

`familyHash` 只能由保守 allowlist 生成：

1. 结构化只读工具：
   - 仅归一化该工具明确声明的窗口大小字段，例如 `limit`、`messageLimit`、`maxResults`、`pageSize`；
   - 不归一化 `path`、`url`、`query`、`cursor`、`offset`、目标 ID 等业务字段；
   - 工具未登记时不生成参数族指纹。
2. `exec`：
   - 仅当命令完整匹配只读命令族时生成；
   - P0 至少覆盖 PowerShell `Get-ChildItem | Sort-Object | Select-Object` 查询管道；
   - 只把 `Select-Object -First <integer>` 等已允许窗口值归一化为占位符；
   - 出现 `Remove-Item`、写文件、重定向、命令分隔、未知管道阶段或无法可靠解析时返回 `undefined`。

不得通过“删除命令中的所有数字”生成参数族指纹，因为数字可能是路径、日期、记录 ID 或业务参数。

### FR-3：新增 `variant_no_progress` detector

在同一 `runId` 内，从最近结果向前统计连续记录，只有同时满足以下条件才累计：

- `toolName` 相同；
- `familyHash` 存在且相同；
- `resultHash` 存在且相同；
- 至少存在 2 个不同的 `argsHash`，以确认这是参数变体而不是交给 genericRepeat 的精确重复；critical 另要求达到 3 个不同 `argsHash`；
- 中间没有不同结果、不同操作族或缺失结果。

精确定义为：`streak` 是连续满足同 `toolName + familyHash + resultHash` 的记录数；warning 要求 `streak >= 2 && distinctArgsHash >= 2`，critical 要求 `streak >= 3 && distinctArgsHash >= 3`。

首发阈值：

| 阶段         |                        阈值 | 行为                                                    |
| ------------ | --------------------------: | ------------------------------------------------------- |
| 诊断 warning |            2 次相同 outcome | 仅 debug/warn 记录，不刷用户消息                        |
| critical     | 3 次相同 outcome 且参数不同 | 当前 turn 收尾时终止 Run；before-tool 路径负责兜底 veto |

本次现场在 `N=80/100/120` 后满足 critical，后续 `N=150` 不得执行。

判定必须同时接入两个时序点：

1. outcome/post-turn 主路径
   - `recordToolCallOutcome()` 完成第三个相同结果记录后，在当前 turn 收尾阶段计算 variant streak；
   - 将结构化 terminal reason 写入当前 `RunSafetyController` 的 run reason；
   - 把 `shouldStopAfterTurn` 检查前移到 `turn_end` 后、`prepareNextTurn` 前；即使这个 fast path 因异常未执行，FR-12 的 pre-dispatch gate 仍必须阻止下一次 Provider 请求；
   - 命中后直接结束 Run，因此本次现场不应再产生决定 `N=150` 的模型轮次。
2. before-tool 兜底
   - 保留下一次工具执行前的检测，用于兼容未经过正常 outcome 收尾的路径；
   - 只有当前 `runId` 的 terminal reason 在该调用进入 hook 时已经存在，才在执行前 veto；
   - 同一 Provider response 已经产生并开始执行的并行 sibling 允许完成，variant detector 不承诺在不串行化工具执行的情况下拦住同批次第四个调用；
   - before-tool 兜底不能替代 post-turn 主路径。

如果上线灰度发现误判，只允许扩大 allowlist 的约束或提高独立阈值；不得退回仅比较完整参数 Hash。

与上游 `#112620` 的边界必须保持清楚：

- 本 detector 识别的是“已登记的同一语义操作族 + 跨参数的相同结果”，目标是尽早阻断本次高基数窗口轮转；
- 上游 argument churn detector 识别的是“少量完整参数签名各自重复且结果稳定”，目标是通用地处理 A/B 型或低基数 churn；
- P0 不复制 `#112620` 的“每个变体至少出现 3 次”条件，因为 41 个参数、40 条历史的现场会继续漏报；
- 如果未来目标 OpenClaw tag 已包含 `#112620` 或等价实现，两者可以按不同 detector kind 并存，但同一 Run 只能写入一个 write-once terminal reason；优先级为更早发生的 terminal reason，不允许重复用户消息或重复终止 callback；
- 对不在 allowlist 中的普通 15 项两遍批处理，不得为了追求通用 churn 覆盖而在本文 P0 中新增跨业务参数的自动合并。

### FR-4：增加独立于滑动窗口的客户端工具预算

现有 `historySize=40` 只用于模式识别，不能承担绝对预算。本次在 FR-12 定义的本地 `budgetScopeId` 上维护工具调用计数：

- P0 managed 默认 `maxToolCallReservationsPerBudgetScope=64`；
- reservation 必须位于 agent-core 收到原始 `toolCall` 之后、工具查找、参数 schema 校验、before-tool hook 和 client-hosted tool 分流之前，不能假设所有调用都会经过现有 hook；
- controller 为每个原始 batch 分配 scope-unique `toolBatchId`（模型响应默认由 `providerDispatchId` 派生），并以 `budgetScopeId + toolBatchId + rawIndex` 同步、幂等预占；`toolCallId` 只作关联元数据。未知工具、非法参数、执行失败和用户中途取消都计入，因为这些路径同样可能形成 Provider 重试循环；
- 当前作用域已预占 64 个槽时，第 65 个原始调用在任何工具执行或副作用发生前被 veto；
- 同一 Provider response 含多个工具调用时按声明顺序同步 reservation；预算内且已经开始的 sibling 可以完成，超出剩余槽位的调用不得开始；
- 计数不随 40 条历史窗口淘汰，也不因 automatic retry、fallback、compaction、recovery Run 或 subagent 切换 runId 而重置；
- 只有在上一 scope 已结束后开始的新外部根指令、原生 IM 入站任务或新的 Cron fire 创建新预算作用域；active Run 中的 steering / follow-up 继承当前 scope，safety stop 后显式“继续”才创建新 scope；
- 最后一个可用槽被预占时立即写入 `run_tool_budget` 并把 scope 置为 draining：已获得 ticket 的调用仍可完成，新的工具 reservation 和 Provider dispatch 立即关闭；
- 外部没有提供 runId / budgetScopeId 时，由 runtime 在根入口生成本地 ID 并继续保护，不能为了兼容旧调用方静默关闭预算。

硬预算、detector history 和终止所有权不得放在 diagnostic session state 中。`embedded-agent-runner/run.ts` 的外层根执行创建或取得唯一 `RunSafetyController`，自动派生的 run / attempt / subagent 持有同一 controller 引用；controller 原子维护 scope counters、按 run 隔离的 `ToolLoopDetectorState`，以及 write-once scope terminal reason。任一 run 的 detector 达到 critical 时调用 scope 级 `tryTerminate()`，停止同一外部任务的 root / child continuation。diagnostic state 只镜像 detector history、计数快照、resolved provider/model 和遥测，不参与 correctness，也不能通过 `max` 合并恢复丢失的 reservation。

controller 的强制状态只有 `active → draining → ended`：首个 `tryTerminate(reason)` 以 compare-and-set 进入 draining，迟到结果只能补充诊断，不能覆盖 reason。controller 只持有 decision / state，root coordinator 是唯一 lifecycle / product terminal publication owner；`run.ts` 只建立并注册二者。配置阈值在 controller 创建时冻结，运行中配置刷新不能扩大当前 scope。

`shouldStopAfterTurn` 不能根据“该 session 最近一次 reason”猜测 Run。实现必须把精确 `budgetScopeId + runId + sessionKey` 从根执行传入 attempt / session，并且只读取匹配当前 runId 的 detector reason 和匹配当前 budgetScopeId 的预算 reason。`shouldStopAfterTurn` 是减少无用工作的 fast path，不是唯一闸门；每次 Provider dispatch 前仍必须再次读取同一 controller。

pre-controller 创建的 `RunSafetyRootCoordinator` 以 `rootInvocationId` 持有 `publishTerminalOnce()`，只负责 core product terminal 去重，不能同时承担用户消息交付状态。native ReplyPayload 使用独立 delivery receipt，并且只在发送成功后落位；Adapter 按 `rootInvocationId + kind` 幂等写入 Cowork 消息，budgetScopeId / runId 只作关联元数据。三个阶段互不复用布尔状态。

该上限会改变“一条用户指令自动执行 100 个工具”的历史行为：第 64 次后必须由用户通过新消息明确继续。对于无人值守长任务，后续只能通过显式 job 模式和更高的独立预算配置支持，不能让自动恢复隐式获得新预算。

本预算与上游 `#97485` 的 `maxToolCallingRounds` 语义不同：

- `maxToolCallReservationsPerBudgetScope` 统计原始工具调用 reservation；一次模型响应发出 10 个并行工具调用时计 10；
- `maxToolCallingRounds` 统计产生工具调用的模型轮次；同一响应中的 10 个工具调用只计 1；
- `#97485` 当前 head 的 hook 发生在模型已经返回下一轮 tool calls 之后，因此无法阻止用于发现超限的那次 Provider 请求，随后还会尝试一次 text-only 模型总结；
- P0 不生成该配置，也不把它当作 Provider 请求预算。只有目标 tag 支持关闭额外模型总结、把 exhaustion 接入唯一 terminal owner，并通过组合测试后，才可作为第二层 tool-round execution backstop；
- 无论未来是否启用 round backstop，per-call reservation 和 FR-12 的 pre-dispatch Provider 预算都必须保留；
- 本文不接受“预算耗尽后再调用一次模型生成总结”。终止提示必须由确定性本地文案产生。

### FR-5：建立唯一的客户端安全终止闭环

`variant_no_progress`、`run_tool_budget` 和 FR-12 的两种 Provider 预算必须归一到一个 typed safety terminal outcome：

- 当前固定 runtime 中，tool-loop detector 继续返回 `deniedReason === "tool-loop"`、`terminate: true`，outcome 主路径在 turn 边界触发本地 normal termination；
- Provider 预算在 dispatch 前直接写入 scope terminal reason，不伪造 tool result；
- `shouldStopAfterTurn` 在混合并行批次完成后尽早返回，但每次 Provider dispatch 前的 controller gate 才是不可绕过的最终边界；
- 第一次 write-once terminal reason 之后不得再调用 Provider，不得进入 model fallback、recoverable retry、compaction、自动恢复或模型总结；
- 不把 safety stop 包装成普通 tool/provider error让模型自行重试；
- 已经开始的正常 sibling 可以完成；不得仅为实现终止而用全局 `AbortController.abort()` 粗暴打断无关 sibling；
- 同一 bundled runtime 只能有一个 core terminal owner、一个 callback 去重 owner 和一个用户交付 receipt owner。

现有 `openclaw-terminate-run-on-critical-tool-loop.patch` 继续承担当前固定 runtime 的 core termination；本次 core patch 把新的 detector、工具预算、Provider 预算和统一 gate 接入同一个 owner。

上游 `#110633` 当前使用 typed critical signal、AbortController 和 `hook_block`，不是本地 `normal end + terminationReason` 的等语义替换。未来目标 tag 若包含其最终实现，内部终止机制可以改变，但产品可观测契约不能改变：critical 后零额外 Provider dispatch、Adapter 将其识别为预期安全终止、禁止 retry / failover、只交付一次确定性提示。只有单工具、混合批次、用户取消竞态、Run 隔离和下一次 Provider dispatch 五项等价后，才允许让上游成为唯一 core owner，并删除本地重复终止 hook；LobsterAI 的 detector / budget signal bridge、结构化 reason 归一化和 delivery 仍按缺口保留。

### FR-6：产生结构化、可交付的终止原因

仅产生 `agent_end` 而没有可见文本会让飞书用户继续看到“没有回复”。critical 终止必须携带结构化原因：

```ts
export const RunSafetyTerminationKind = {
  VariantNoProgress: 'variant_no_progress',
  RunToolBudget: 'run_tool_budget',
  RunProviderDispatchBudget: 'run_provider_dispatch_budget',
  RunPromptExposureBudget: 'run_prompt_exposure_budget',
  RunPromptEstimateUnavailable: 'run_prompt_estimate_unavailable',
  RunBudgetIdentityMissing: 'run_budget_identity_missing',
  RunSafetyStateUnavailable: 'run_safety_state_unavailable',
} as const;

export type RunSafetyTerminationKind =
  (typeof RunSafetyTerminationKind)[keyof typeof RunSafetyTerminationKind];

type RunSafetyTerminationDetails = {
  detector?: string;
  toolName?: string;
  observedCount?: number;
  limit?: number;
  rootInvocationId: string;
  runId: string;
  toolCallReservationCount?: number;
  providerDispatchCount?: number;
  cumulativeEstimatedPromptTokens?: number;
};

export type RunSafetyTermination =
  | (RunSafetyTerminationDetails & {
      kind: typeof RunSafetyTerminationKind.RunBudgetIdentityMissing;
      budgetScopeId?: undefined;
    })
  | (RunSafetyTerminationDetails & {
      kind: typeof RunSafetyTerminationKind.RunSafetyStateUnavailable;
      budgetScopeId: string;
    })
  | (RunSafetyTerminationDetails & {
      kind: Exclude<
        RunSafetyTerminationKind,
        | typeof RunSafetyTerminationKind.RunBudgetIdentityMissing
        | typeof RunSafetyTerminationKind.RunSafetyStateUnavailable
      >;
      budgetScopeId: string;
    });

export type RunSafetyBootstrapFailure = Extract<
  RunSafetyTermination,
  {
    kind:
      | typeof RunSafetyTerminationKind.RunBudgetIdentityMissing
      | typeof RunSafetyTerminationKind.RunSafetyStateUnavailable;
  }
>;
```

要求：

- `kind`、detector 名称和跨模块状态值在 OpenClaw 与 LobsterAI 各自的构建边界内集中为 `as const` 单一来源；Adapter、UI 和测试导入 LobsterAI 侧共享常量，并由 patch 契约测试锁定两侧 wire value 一致；
- `rootInvocationId + RunSafetyRootCoordinator` 在创建 / 查找 controller 之前先建立；scope ID 缺失、controller 丢失或 active registry 满载时直接返回 `RunSafetyBootstrapFailure` typed outcome，inner Provider 调用数为 0；
- child 内部发现 controller 丢失时向 root coordinator 上报 non-retryable bootstrap failure，不能 throw 成普通 provider/runtime error 后进入 retry / failover；
- 不额外请求模型生成解释；
- 不把 safety stop 伪装成 runtime error：child / attempt 只向 controller 调用 `tryTerminate()` 并读取 sticky reason，不能各自发布产品终态；
- `RunSafetyRootCoordinator` 在 controller `onDrained` 或 bootstrap failure 时调用 `publishTerminalOnce()`；它不依赖 root 调用栈仍存活。其他 child / recovery run 结束自身但不发布第二个 lifecycle terminal 或用户消息；
- embedded run 必须产出可区分的 typed safety terminal outcome，并在 run result 和 lifecycle 终态上携带可选 `terminationReason`；当前 backport 使用 normal `agent_end`，未来上游若使用 typed `hook_block`，Adapter 也必须归一为同一产品结果，且均不能进入 provider failover、recoverable retry 或 error fallback；
- native IM reply pipeline 根据 `terminationReason` 生成一次确定性的 `ReplyPayload` 并发送到原会话，不调用 Provider；只有收到发送成功回执后才写入独立 delivery receipt，发送失败可按现有渠道策略重试，不能被 core callback 标志误判为已送达；
- LobsterAI Adapter 根据 lifecycle terminal event + `terminationReason` 映射为 Cowork safety system message，并把 session 状态退出 `running`；以 `rootInvocationId + kind` 幂等去重，不能因 scope bootstrap failure 或 child / recovery runId 变化重复交付；
- 用户补充信息或发送“继续”时创建新 Run，不自动复活旧 Run。

不同终止原因必须使用不同的确定性用户文案，不能把合法达到工具上限说成“没有新结果”。`variant_no_progress` 建议文案：

> 检测到任务连续执行相似操作但没有获得新结果，已自动停止以避免继续产生无效的模型调用和费用。请补充说明后重试。

`run_tool_budget`、`run_provider_dispatch_budget` 和 `run_prompt_exposure_budget` 分别说明“工具调用次数”“模型请求次数”“累计上下文暴露量”已达到本地安全上限，并提示用户检查当前结果后通过新指令继续。`run_prompt_estimate_unavailable`、`run_budget_identity_missing` 与 `run_safety_state_unavailable` 则说明本地安全状态无法可靠建立，已在调用模型前停止。任何文案都不得展示为精确账单或诱导用户充值。

OpenClaw native reply 层必须按渠道语言提供中英文文案；LobsterAI 的 `src/main/i18n.ts` 和 Renderer i18n 只负责桌面端展示，不能被当作 native 飞书文案来源。

### FR-7：发送模型请求前压缩重复工具对

扩展现有 session history sanitize 流程，识别连续的：

```text
assistant: thinking + 单个 toolCall，无可见 assistant 文本
toolResult: 与同操作族前序结果指纹相同
```

当连续组数达到 4 组时：

- 参数族归一化必须抽成可复用纯函数 `normalizeToolCallFamily(toolName, args)`；sanitizer 从持久化 assistant toolCall arguments 重新计算 `familyHash`，不能读取只存在于进程内 diagnostic state 的 `ToolCallRecord`；
- 为 replay toolResult 定义稳定 canonicalizer，并从持久化消息重新计算 `resultHash`；
- assistant toolCall 与 toolResult 必须先按 `toolCallId` 严格配对，再参与重复组判定；
- 模型上下文最多保留最近 2 组完整 assistant/toolResult pair；
- 删除时必须整组删除，不能制造孤立 tool call 或 tool result；
- 含用户可见 assistant 文本、并行混合工具、未知副作用工具的 pair 不参与；
- 只改变发给模型的上下文，不改写或删除原始 JSONL；
- 日志记录折叠组数和 Hash 前缀，不记录原文。

这样即使用户升级前已经形成 200 多组重复结果，补充信息后的新 Run 也不会再次携带全部污染历史。

Sanitizer 测试必须使用真实 `AgentMessage[]` 形态的 assistant/toolResult fixture，在测试内重新计算指纹；不能直接给 sanitizer 注入预计算 Hash，否则无法证明旧 JSONL 回放路径可用。

### FR-8：修复 native channel 的停止兜底

`openclawRuntimeAdapter.stopSession()` 当前在有 `ActiveTurn` 时异步调用 `chat.abort(sessionKey, runId)`，但会立刻完成本地 idle；没有 `ActiveTurn` 时更不会发起远端 abort。用户操作需要新增“远端确认”路径，同时保留内部错误/退出路径的即时清理语义：

1. 在 `CoworkRuntime` 与 Router 增加 `abortSessionAndConfirm(sessionId): Promise<CoworkStopResult>`，桌面端 `cowork:session:stop` IPC 只调用该接口；现有同步 `stopSession()` 保留为内部 best-effort 兼容入口；
2. Adapter 提取私有 `finalizeSessionStopLocally()`，confirmed path 只有确认远端已停止或确认本来就没有活动 Run 后才调用；内部 lifecycle fallback、plan-mode safety 和进程退出可先 best-effort abort，再调用本地 finalizer，不递归调用 confirmed path；
3. 使用 `getSessionKeysForSession()` 获取 native session key；没有 `ActiveTurn` 时，只有 session store 或近期 lifecycle marker 表明仍在 running，且该 marker 之后没有 terminal 事件，才允许兜底 abort；
4. 优先使用 lifecycle / run 映射中的精确 runId；runId 不可用时使用 OpenClaw 支持的 sessionKey-only abort；
5. Gateway 调用设置 5 秒上限；RPC resolve 不等于已停止。`aborted === true` 直接返回 `aborted`；`aborted:false` 时必须立即重新同步远端状态，确认已 idle 才返回 `already_idle`；
6. `aborted:false` 且远端仍 running 或状态未知、RPC 超时、RPC 失败时返回 `failed`，不能提前清理本地 running 状态；
7. 已确认停止后，late events 继续由 `terminatedRunIds` / recently closed run guard 丢弃。

`CoworkStopResult` 使用共享 `as const` discriminant，精确区分 `aborted`、`already_idle` 和 `failed`。前两种都可完成本地 cleanup 并向 IPC 返回成功；`failed` 保留或采用 resync 后的真实状态。现有 `cowork:session:stop` 字面量在本次触碰时迁移到 `CoworkIpcChannel.StopSession`，Main 和 Preload 共用同一个常量。

### FR-9：发送文件能力契约

本次 transcript 只能证明 Agent 没有调用发送工具，不能证明工具一定未暴露。因此把以下能力契约列为 P1 渠道集成验证，不阻塞 P0 止损发布，也不把 Prompt 当成止损主方案：

- native 飞书 Run 的工具目录必须包含支持当前会话和本地文件的 `message` 发送能力；
- channel capability 为 `media=true` 时，系统提示明确说明本地文件发送方式；
- 发送文件必须产生可审计回执；没有回执不能宣称已发送；
- 如果 capability 不可用，Agent 应在一个响应周期内告知限制；
- 两份文件确定、第三份不明确时，推荐行为是先交付确定文件，再询问第三份，而不是继续无界扫描。

### FR-10：可观测性与售后证据

触发 warning 或 critical 时只记录一条结构化摘要：

- runId、脱敏 session key；
- 实际 resolved provider / model；
- detector kind；
- tool name；
- familyHash、argsHash、resultHash 前缀；
- streak、总工具数、阈值；
- `budgetScopeId`、Provider dispatch count、累计 estimated Prompt tokens、阈值和 estimator source；
- 已知 `exitCode`；
- 累计 Provider usage（如果运行时已经提供）；
- terminal reason 和 abort 结果。

不得记录用户输入正文、完整命令、目录列表、文件内容、账号 ID 或密钥。

支持诊断必须以每个 assistant/provider response 的实际 resolved model 为准；`sessions_list.model` 只能作为 session 配置元数据，不能作为计费模型结论。

数据来源固定为 embedded attempt：每次 Provider request 发起前，在 provider/model 解析和 failover 选择完成后，用 `budgetScopeId + runId` 更新 controller 中对应 run 的 resolved provider/model，并把脱敏快照镜像到 diagnostic state；发生 profile、provider 或 model fallback 时覆盖为即将实际调用的新值。detector 读取 controller 中最后一次真实请求身份；字段缺失时记录 `unknown`，禁止回退到 `sessions_list.model` 猜测。

### FR-11：上游能力探测与去补丁门禁

实施和升级必须基于目标 tag 的实际代码能力，而不是 PR 标题或关闭状态：

1. 实施开始时记录目标 OpenClaw tag、commit SHA、关键 PR 的 state / mergedAt，以及下列能力是否存在：
   - 参数变化型 no-progress detector；
   - critical blocked result 的 Run 终止；
   - aborted tool run 后停止下一轮；
   - per-call 或 per-round Run budget；
   - pre-dispatch Provider dispatch budget；
   - cumulative estimated Prompt exposure budget；
   - typed lifecycle termination reason，以及 `hook_block` 等上游 outcome 的产品归一化；
   - native terminal reply。
2. `scripts/apply-openclaw-patches.cjs` 的强校验继续面向行为符号和测试契约；不能仅根据版本号跳过 patch，也不能因为 `git apply` 成功就认为没有重复逻辑。
3. 升级目标已包含完整上游能力时，删除对应本地 patch 前必须通过 clean-tag 回放和本文测试矩阵；只包含部分能力时，将本地 patch 缩减为最小差异，不得重新实现一套平行状态机。
4. 任意组合只能有一个 Run safety terminal owner、一个 callback 去重 owner 和一个 native delivery receipt owner。
5. PR 后续被关闭但未合并，或者合并后又 revert，都不得改变已发布 LobsterAI 的保护；产品能力以 bundled runtime 产物和 packaged replay 为准。
6. 上游状态快照只写入设计/发布证据，不在运行时访问 GitHub，不引入联网依赖。

### FR-12：客户端 Provider dispatch 与累计 Prompt 暴露预算（P0）

该预算限制 LobsterAI 客户端和 bundled OpenClaw runtime 能观察、能阻断的模型调用暴露量。它不依赖 LobsterAI 自营模型，必须同样覆盖自定义远程 Provider 和本地模型；它也不换算实际积分，不宣称账单级金额上限。

#### FR-12.1 默认阈值

P0 managed 默认：

```ts
export const RunSafetyBudgetDefaults = {
  maxToolCallReservationsPerBudgetScope: 64,
  maxProviderDispatchesPerBudgetScope: 32,
  maxCumulativeEstimatedPromptTokensPerBudgetScope: 2_000_000,
  warningRatio: 0.75,
} as const;
```

- 前 32 次 Provider reservation 可以成功，第 33 次必须在 provider adapter / transport 调用前被拒绝；
- 每次最终 Provider-visible Prompt 的 estimated tokens 累加，下一次 reservation 会使累计值超过 2,000,000 时必须被拒绝；恰好等于上限时允许；
- 每个预算维度的 warning 边界为 `ceil(limit * warningRatio)`：默认分别是 48 次 tool reservation、24 次 Provider dispatch 和 1,500,000 estimated Prompt tokens；按 `budgetScopeId + dimension` 各记录一次结构化 warning，不额外调用模型，也不重复打扰用户；
- Prompt、Agent、Skill、模型输出和远端响应均不能修改阈值；P0 不提供对单次运行静默关闭保护的入口；
- 后续如提供长任务模式，只能由用户在产品设置或任务创建时显式选择更高的本地预算，并继续保留有限上限。

配置 schema 要求三个 limit 都是正的 safe integer，`0 < warningRatio < 1`。managed config 无效时 config sync / runtime startup 必须拒绝并回退上述安全默认值，不能把 `NaN`、`Infinity`、负数或字符串解释为关闭预算。

这组默认值使约 1,000,000 Token 的上下文最多暴露两次，约 400,000 Token 的上下文最多约五次，下一次在 dispatch 前被阻止；小上下文任务仍最多 32 次 Provider dispatch。本次事故会优先由第三次相同结果 detector 结束，双预算用于兜住无工具 retry、compaction 和“大 Prompt、少调用”等其他形态。

#### FR-12.2 `budgetScopeId` 生命周期

`rootInvocationId` 和 `budgetScopeId` 都是 runtime 生成的本地不透明 ID。前者在任何 controller 操作前建立产品终态 / 交付归属，后者表示一次外部触发的完整任务预算；两者都不是账号、授权或计费标识：

```text
rootInvocationId  一次外部任务的终态与交付归属
  └─ budgetScopeId  同一任务的客户端预算
       ├─ runId     一个父、子或自动恢复 Run
       ├─ attemptId 一次 embedded run attempt，可包含多个模型轮次
       └─ providerDispatchId 一次实际 provider adapter / transport invocation
            └─ toolBatchId 该响应产生的原始工具 batch；在 scope 内唯一
```

下列根入口创建新 scope：上一 scope 已结束或不存在时的桌面端新用户消息、native IM 新入站任务、Cron 的一次独立 fire，以及 safety stop 后用户明确发送的“继续”或补充信息。当前 active Run 中注入的 steering / follow-up 仍属于同一外部任务并继承原 scope，不能用消息边界重置预算。

下列 OpenClaw runtime 内部自动路径必须继承原 scope，即使创建了新 runId：transport retry、auth/profile rotation、model/provider fallback、automatic compaction / summary / context recovery、持有可信内部 claim 的 recovery、当前 Agent 创建的 subagent、native IM background continuation，以及同一外部任务的其他内部 attempt。子 Agent 可以获得局部配额以便调度，但所有 reservation 仍从 root scope 的总预算原子扣减，不能凭子 runId 获得完整新预算。

Desktop Adapter 当前没有 Gateway 签发的、内部可信且一次性的 scope claim，不能仅凭缓存的 ID 或 `sessionKey` 发起 provider-backed Plan recovery / safety recovery。P0 因此禁用这两类 Adapter 自动恢复：普通 incomplete plan 保留原始可见结果、写入简洁本地 system 提示并正常完成；Plan Mode 阻止 mutating tool 后仍执行 `chat.abort`，在 abort / lifecycle 收口后写入本地确定性提示并清理当前 turn。两条路径都只能由用户后续明确发送的新指令创建新 scope 后继续。

根入口总是生成 `budgetScopeId` 并创建 controller。任一内部路径到达 Provider gate 时，缺少 scope ID 则 fail-closed 为 `run_budget_identity_missing`；ID 存在但 controller 已丢失则 fail-closed 为 `run_safety_state_unavailable`。不能为兼容旧插件静默按“无预算”模式 dispatch。

P0 不实现进程重启后的 controller checkpoint 恢复。Gateway 或 App 在 active scope 中途崩溃后，旧任务标记为 interrupted，禁止 automatic recovery 调用 Provider；只有用户的新明确指令可以创建新 scope。未来若要自动恢复，必须另行设计原子持久化、版本迁移和 crash replay，不能在本 spec 中以“尽力恢复”弱化 fail-closed 边界。

两个 ID 由 OpenClaw 的统一 inbound root 创建并写入 lifecycle start / end；Desktop Adapter 只缓存并用于当前 turn 的终态关联，native IM / Cron 不需要经过 LobsterAI 主进程才能获得保护。P0 Adapter 不发起 provider-backed automatic recovery。未来只有 Gateway 暴露内部可信、一次性消费并绑定原 controller 的 claim seam 后，Adapter 才能把 opaque claim 交回 runtime；外部 Prompt 不能读写这些字段，也不得从 `sessionKey`、`runId`、缓存 ID 或用户文本推导 claim / scope。

#### FR-12.3 权威状态与统一闸门

`embedded-agent-runner/run.ts` 的根执行创建 `RunSafetyController`，Gateway 内的有界 registry 以 `budgetScopeId` 查找该 controller。父 Run、恢复 Run 和 subagent 共享同一实例。controller 至少原子维护：

```ts
type RunSafetyBudgetState = {
  rootInvocationId: string;
  budgetScopeId: string;
  rootRunId: string;
  status: 'active' | 'draining' | 'ended';
  toolCallReservationCount: number;
  providerDispatchCount: number;
  cumulativeEstimatedPromptTokens: number;
  runDetectorStates: Map<string, ToolLoopDetectorState>;
  toolCallReservations: Map<string, ToolCallReservation>;
  providerDispatchReservations: Map<string, ProviderDispatchReservation>;
  activeRunIds: Set<string>;
  inFlightReservationCount: number;
  continuationClosedReason?: RunSafetyTerminationKind;
  scopeTerminalReason?: RunSafetyTermination;
};
```

`tool-loop-detection.ts` 必须从 controller 内按 runId 隔离的 `ToolLoopDetectorState` 读取和写入 authoritative history；diagnostic state 只接收历史与 counter 快照，不能反向恢复、合并或修改 detector / budget 状态。active scope 不得因 diagnostic Map 容量或 TTL 被淘汰。

controller 生命周期固定为：

1. root 创建时进入 `active`；
2. 首个 `tryTerminate()` 进入 `draining`，关闭新的 tool / Provider reservation，已获得 ticket 的 in-flight sibling 允许完成；
3. in-flight 归零后，controller 的 `onDrained` 调度 root coordinator 的 `publishTerminalOnce()`，发布一次产品终态再进入 `ended`；该回调不依赖 root Run 调用栈仍存活；
4. 正常完成但没有 safety reason 的 scope 也在所有 active run / in-flight 归零后进入 `ended`；
5. root coordinator 保留原会话路由，直到 controller ended 且 terminal delivery 已交给独立 receipt owner；随后 controller 从 active registry 移除，并留下 30 分钟的轻量 tombstone（root invocation ID、scope ID、kind、endedAt，不含 Prompt）拒绝 late event。

active registry 默认最多持有 128 个 scope；达到 128 个仍 active 的 controller 时，绝不能通过淘汰旧 active scope 为新任务腾位，新根任务直接以 `run_safety_state_unavailable` fail-closed。tombstone 使用独立的 512 项有界 LRU 和 30 分钟 TTL；tombstone 被淘汰后也不能复活旧 Run，因为 active controller 已不存在，任何 automatic recovery 仍按 state unavailable 拒绝。

每次实际 Provider dispatch 前，不论来自正常 agent turn、retry、fallback、compaction、recovery 还是 subagent，都必须调用同一个同步 gate；Provider SDK 的隐藏自动重试必须关闭，或者每次真实 transport dispatch 都重新经过该 gate。

`reserveProviderDispatch(providerDispatchId, estimatedPromptTokens)` 在一次无 `await` 的临界区内：

1. 拒绝已经 terminal 的 scope / run；
2. 以 `budgetScopeId + providerDispatchId` 幂等检查，重复进入不能再次 dispatch；
3. 检查 `providerDispatchCount + 1`；
4. 检查 `cumulativeEstimatedPromptTokens + estimatedPromptTokens`；
5. 任一项超过阈值时写入对应的 write-once scope terminal reason 并拒绝；
6. 两项都未超过时，同时递增、登记 reservation，然后才允许调用 provider adapter / transport；
7. reservation 后 dispatch count 或累计 Prompt 恰好等于上限时，记录 `continuationClosedReason`，但先允许当前响应完成。

并行 subagent 或并行请求只剩一个槽时，只能有一个 reservation 成功。已经完成 reservation 并开始执行的 sibling 可以结束，但其结果不得产生新的 Provider dispatch。reservation 一旦成功就不回退：成功、业务错误、stream 中断、超时、用户取消和 transport error 都保留；retry、fallback、compaction 以及同一 attempt 内的下一模型轮次都分配新的 `providerDispatchId` 并再次计数。客户端不能可靠证明失败请求没有到达 Provider，回退预算会让错误路径形成无限重试。

恰好耗尽预算的当前响应按内容收口：如果它是无 tool call 的最终 assistant 文本，允许正常交付并结束，不产生虚假的预算终止消息；如果它包含 tool calls，raw batch reservation 入口在任何工具副作用前把 `continuationClosedReason` 提升为 scope terminal 并拒绝整批工具；如果它触发 retry、compaction、fallback 或其他模型 continuation，则下一次 Provider gate 提升相同 reason 并在 inner invocation 前拒绝。

#### FR-12.4 Provider dispatch 与 Prompt 估算口径

Provider dispatch 指任何可能调用模型 backend 的 provider adapter invocation；远程请求和本地模型调用使用同一计数。它包括初始请求、工具结果后的下一轮、transport retry、auth/profile rotation 后的新请求、model/provider fallback、模型型 compaction / summary、持有 runtime 可信 claim 的 Plan recovery、subagent 请求以及 native IM / Cron 后台请求。预算拒绝且未调用 adapter 的 attempt、本地 Prompt 构建失败和明确未到模型层的凭据刷新不计；P0 Desktop Adapter 的 incomplete / blocked Plan 不发起此类 dispatch。

Provider 抽象新增 versioned、不可选的 Agent 调用上下文：

```ts
declare const runSafetyContextBrand: unique symbol;

export type RunSafetyDispatchContextV1 = {
  readonly contractVersion: 1;
  readonly purpose: 'agent';
  readonly rootInvocationId: string;
  readonly budgetScopeId: string;
  readonly providerDispatchId: string;
  readonly [runSafetyContextBrand]: true;
};
```

该对象只能由 runtime root / controller 创建，Prompt、Agent、Skill 和 Provider plugin 不能伪造或把 `purpose` 降级。所有 embedded agent、subagent、recovery、compaction / summary API 都必须接收非 optional 的 `RunSafetyDispatchContextV1`；provider registration 同时声明 `runSafetyContractVersion: 1`。

Provider 抽象新增强制的 pre-transport final-payload seam：它位于 history sanitizer、compaction、provider-specific message conversion、system prompt 拼装、tool schema projection 和最终 provider/model 选择全部完成之后，同时位于任何网络 I/O 或本地模型 inference 之前。所有 built-in adapter、OpenAI-compatible custom Provider 和 plugin Provider 都必须从该 seam 调用同一个 controller gate；注册时无法证明支持该 seam 的 adapter fail-closed，不能以“自定义 Provider”为由绕过。SDK 内部 retry 必须关闭，或让每一次真实 transport retry 重新进入 seam。

具体 V1 contract 使用结构化 prepare descriptor，而不是把可重复调用的 `dispatch()` callback 交给 Provider：Provider 只返回 `{ finalPayload, transport }`，host 先 await final-payload gate，再且仅再调用一次 `transport`。公开 SDK 不提供“audited legacy stream”自我标记入口；旧 transport 的兼容桥只允许宿主根据 plugin registry 中不可由插件自报的 bundled provenance 启用，伪造 provider ID、plugin ID 或 origin 都不能通过。普通自定义远程模型和本地模型仍走 host contract；无法满足 contract 的 plugin / harness 在 Agent 代码或 transport 执行前 fail-closed。

Provider plugin 是与 OpenClaw 同进程执行的受信任代码边界。上述结构 contract 能阻止未版本化、误接线或自行伪造 marker 的插件被 Agent runtime 调用，但不能声称阻止恶意同进程插件绕开注册接口直接调用全局网络 API；若威胁模型包含恶意插件，必须另行引入进程隔离和网络能力沙箱。这个安全边界不构成按模型来源豁免，也不影响用户通过内置 OpenAI-compatible / local transport 使用自定义模型时的三项预算保护。

conversation label、TTS、标题生成等非 embedded `completeSimple` 调用使用类型隔离的 `purpose: 'utility'` 入口，不接受 Agent 上下文，也不能由 Agent/provider plugin 自行选择。它们不计入本 spec 的 agent `budgetScopeId`，继续受各自现有的一次性调用边界；若未来也需要累计预算，应建立独立 utility scope，不能把 Agent context 改成 optional 来复用。

模型型 compaction / summary 不能只复用普通 `attempt.ts` wrapper；`embedded-agent-runner/compact.ts` 及 plugin / context-engine compaction seam 必须使用同一 `onBeforeProviderDispatch` contract。Provider dispatch count 和 Prompt estimate 都以 seam 实际收到的最终 payload 为准。

已知会在一次表面调用内隐藏额外请求或门前副作用的实现必须逐项收口：Bedrock inference 与 control-plane client 固定 `maxAttempts: 1`，profile discovery 位于 Prompt gate 之后；Gemini 3 的 first-response timeout retry 在 Agent safety scope 内关闭；Anthropic thinking recovery 的第二次调用获得新的 dispatch reservation；Google managed prompt-cache 的 create / PATCH 和 LM Studio best-effort preload 在受保护的 Agent scope 内禁用。它们可以在隔离的 utility scope 保留原行为，但不能与 inference 共用一张 Agent ticket。

Prompt estimate 至少覆盖 system prompt、消息、tool call / result、tool schema、固定协议开销和图片/媒体。fallback 到另一 Provider / Model 时必须按新的 final payload 重新估算；累计值不扣除 cache read，也不读取 `usage.cost.total`：

```text
cumulativeEstimatedPromptTokens += estimatedPromptTokensForThisDispatch
```

估算结果先规范化为有限、非负的 safe integer：对小数向上取整，最小 reservation 为 1；分项加法使用 saturating add，溢出时取 `Number.MAX_SAFE_INTEGER` 并按超限处理。`NaN`、`Infinity`、负值或抛错都视为 estimator 不可用，禁止直接进入 reservation。

无法取得可靠 estimator 时依次降级：

1. 使用最终 payload 的 runtime token estimator；
2. estimator 不可用时，对 `{systemPrompt, messages, toolDefinitions}` 的稳定序列化结果取 UTF-8 byte length，并加 `64 + 8 * messageCount + 32 * toolDefinitionCount` 作为保守 text token-equivalent；
3. 有可靠图片/媒体 estimate 时与 text estimate 做 saturating add；
4. 存在无法估算的媒体但目标模型 `contextWindow` 已知时，使用 `max(knownEstimate, contextWindow)` 作为整个 payload reservation，不能把 context window 与同一 payload 重复相加；
5. 最终 payload 无法稳定序列化，或未知媒体且 context window 也未知时，在 Provider dispatch 前以 `run_prompt_estimate_unavailable` 终止。

该累计量是统一、保守、可在客户端预先阻断的 Prompt 暴露指标，不是 Provider 实际 input tokens，更不是积分金额。实际 usage 若可得只用于 FR-10 遥测，不返还 reservation，也不改变已经作出的 dispatch 决策。

实时 Prompt projection 继续保留既有 `4 × toolResultMaxChars` 工具结果聚合上限，且只改 request-local clone，不改写 append-only session history。缓存稳定性的强保证限定为：相同最终 payload、相同 resolved cap 的 retry / fallback projection 必须字节一致。不能同时承诺“历史任意增长时旧 projection 永远不变”和“总工具结果始终不超过固定 aggregate cap”；前者在预算已经占满后追加非空结果时必然与后者冲突。P0 以固定聚合上限和本节的累计 Prompt 硬止损为优先，参数变化型重复历史另由 FR-9 折叠。这一口径取代旧 `aggregateMaxCharsOverride=null` 的实时无限聚合方案。

#### FR-12.5 终止与上游边界

命中任一预算后，root 和全部 child Run 的后续 gate 都拒绝；不进入 retry、profile rotation、fallback、compaction、自动恢复或模型总结，只由 root delivery owner 发送一次确定性本地提示。`run_provider_dispatch_budget`、`run_prompt_exposure_budget`、`run_prompt_estimate_unavailable`、`run_budget_identity_missing` 和 `run_safety_state_unavailable` 都走 FR-5 / FR-6 的统一 typed safety terminal outcome。

`#97485` 当前 head 不是该能力的替代品：它在第 N+1 个 tool-calling Provider response 已经返回后才阻止工具，正常 exhaustion 路径随后还会调度一次 text-only summary attempt，若到达 Provider 就产生额外请求。即使未来作为 tool-round execution backstop 启用，FR-12 的 pre-dispatch gate 仍是 Provider 调用边界的唯一权威。

本节不要求 Token Proxy 注入运行标识，不新增计费业务码，也不依赖任何远端账本或套餐接口。所有保护在客户端 / bundled runtime 内完成。

## 4. 实现方案

### 4.1 OpenClaw 版本化 patch

为保持职责边界和可审查性，拆成四个按字典序应用的版本化 patch；最终发布把四个文件作为一个 required manifest 原子交付：

```text
scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-core.patch
scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-delivery.patch
scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-native-receipt.patch
scripts/patches/v2026.6.1/openclaw-z-agent-harness-run-safety.patch
```

core patch 负责 detector、`RunSafetyController`、工具 reservation、Provider 前双预算和唯一终止 gate；delivery patch 依赖 core 的 wire type，负责 native 提示与旧历史折叠；native-receipt patch 让 owner 入队、真实发送回执和 root fallback 正确仲裁；harness patch 为 Codex / Copilot `AgentHarness` 补强制版本化 dispatch / compaction seam。四个 patch 合计预期修改 OpenClaw：

- `src/agents/tool-loop-detection.ts`
  - 新增参数族指纹、variant streak 和 post-outcome 判定；
  - 从 controller 的 `Map<runId, ToolLoopDetectorState>` 读写 authoritative history，输出 `variant_no_progress` detector signal，不再让 diagnostic TTL / merge 影响判定。
- `src/agents/tool-loop-detection.test.ts`
  - 现场命令回放、合法变化、未知副作用和预算边界测试。
- 可新增 `src/agents/tool-loop-fingerprints.ts` 及相邻测试
  - 承载 `normalizeToolCallFamily()` 和 live/replay 共用的稳定 outcome canonicalizer，避免 `replay-history.ts` 反向依赖 detector 状态模块。
- `src/logging/diagnostic-session-state.ts`
  - ToolCallRecord 增加 `familyHash`；
  - 只保存 detector history、resolved provider/model 和 Run safety 遥测快照，不拥有硬预算或 terminal state。
- 可新增 `src/agents/run-safety-controller.ts` 及相邻测试
  - 以 `budgetScopeId` 原子维护 detector history、工具数、Provider dispatch 数、累计 estimated Prompt tokens、tool / provider reservation 和 scope terminal reason；
  - 按 runId 隔离 detector reason，并向 root / recovery / subagent 暴露同一个 pre-dispatch gate；
  - 实现 active / draining / ended、30 分钟 tombstone 和 registry 满载 fail-closed；
  - active scope 不受 diagnostic TTL 淘汰；controller 丢失时阻止旧任务自动恢复。
- 可新增 `src/agents/run-safety-root-coordinator.ts` 及相邻测试
  - 在 controller bootstrap 前生成 `rootInvocationId`，处理 bootstrap failure；
  - controller `onDrained` 后异步 `publishTerminalOnce()`，即使 root Run 已先结束也只发布一次产品终态。
- agent-core 原始 `executeToolCalls()` 边界及相邻测试
  - 收到 Provider 原始 batch 后，在工具查找、参数修复、schema 校验、before-tool hook 和 client-hosted 分流之前做同步 reservation；
  - 先检查 Provider / Prompt `continuationClosedReason`；已恰好耗尽时整批不获 ticket，也不产生副作用；
  - controller 分配 scope-unique `toolBatchId`，reservation 使用 `toolBatchId + rawIndex` 作为幂等主键，`toolCallId` 只作关联元数据；
  - 未知工具、非法参数和同批并行工具均不能绕过 `maxToolCallReservationsPerBudgetScope`。
- `src/config/types.tools.ts`、`src/config/zod-schema.agent-runtime.ts` 及相邻 schema test
  - 只增加 detector 开关和 variant 阈值。
- `src/config/types.agent-defaults.ts`、`src/config/zod-schema.agent-defaults.ts` 及相邻 schema test
  - 增加 `agents.defaults.runSafety` 下的三项绝对预算配置。
- `src/infra/diagnostic-events.ts`、`src/logging/diagnostic.ts`
  - 增加新的 detector discriminant。
- `src/agents/embedded-agent-runner/replay-history.ts` 及相邻测试
  - 调用 live 与 replay 共用的参数族/结果 canonicalizer；
  - 扩展现有 `sanitizeSessionHistory()`，从真实 `AgentMessage[]` 重新计算指纹，只在模型请求上下文中折叠旧的重复工具 pair。
- `src/agents/embedded-agent-runner/run.ts`、`run/attempt.ts`、`run/attempt-session.ts`、`src/agents/sessions/sdk.ts`
  - 根入口创建 `budgetScopeId + RunSafetyController`，automatic recovery / retry / fallback / compaction 和 subagent 继承同一 controller；
  - `sessionKey` 只负责路由，`runId` 负责 lifecycle / 交付关联，`attemptId` 负责一次 embedded 执行尝试，`providerDispatchId` 唯一标识一次模型调用；四者都不能重置预算；
  - 在最终 payload 和实际 provider/model 已解析后计算 Prompt estimate，并在每一次 inner provider stream / transport invocation 前调用同步 reservation；
  - scope 级 dispatch ordinal 由 controller 分配，不能使用每个 attempt 重新归零的诊断序号承担计数；
  - 关闭 Provider SDK 隐藏 retry，或把每次真实 transport retry 重新接回 gate；
  - 扩展 `shouldStopAfterTurn` 作为 fast path，但 pre-dispatch gate 始终再次读取 write-once terminal reason；
  - 保持 critical blocked result、post-outcome critical 和预算拒绝进入同一个 terminal owner。
- `src/agents/embedded-agent-runner/compact.ts`、plugin / context-engine compaction seam 及相邻测试
  - 普通 attempt 之外的模型型 compaction / summary 也传入 root controller；
  - 不能直接调用未包装的 `registerProviderStreamForModel` / `resolveEmbeddedAgentStreamFn`。
- provider stream 注册与 adapter contract 相邻模块
  - 为 Agent / compaction 强制非 optional `RunSafetyDispatchContextV1`，与 `purpose: 'utility'` 的非 embedded simple completion 做类型隔离；
  - 为 built-in、OpenAI-compatible custom 和 plugin Provider 强制结构化 final-payload / single-transport contract；
  - 在 final provider conversion 之后、任何 transport / local inference 之前同步 reserve；
  - adapter 不支持 seam、estimate 非法或内部 retry 绕过 seam 时 fail-closed；
  - 公开 SDK 不导出 audited self-marker，legacy 兼容只接受 host-recorded bundled provenance。
- `src/agents/harness/*`、`extensions/codex/*`、`extensions/copilot/*` 及相邻测试
  - `runAttempt` 与 provider-backed `compact` 使用 mandatory V1 host contract；legacy capability 在调用插件 handler 前 fail-closed；
  - Codex 每次 `turn/start`（包括 fresh-thread retry）和 Copilot 每次 `session.sendAndWait` 都在最终 payload 后获得新 ticket，并共享 `params.runSafety.controller`；
  - dispatch / Prompt 超限时对应 RPC / SDK send 调用数为 0；normal、resume、recovery、fallback 和 compact 分别按真实调用重新计数；
  - 同进程恶意插件属于上述 trusted-plugin 边界，不能用 self-reported marker 冒充已接入。
- `src/agents/cli-runner.ts`、`src/agents/cli-runner/*` 及相邻测试
  - 每次外部 CLI harness 启动都在最终 system prompt、消息、图片和 argv 完成后，且在 spawn 之前，扣减同一 root scope 的 Provider dispatch 与 estimated Prompt 预算；
  - fresh、resume、recovery 和 fallback 复用同一 controller，每次实际进程启动使用新的 `providerDispatchId`；
  - CLI 子进程内部自行执行的工具不经过 OpenClaw agent-core，P0 无法观察并逐项做 raw tool-call reservation；不得把该部分宣称为已满足 64 次工具硬上限。CLI 路径的 P0 保证仅为进程启动次数与最终 Prompt 暴露硬止损，若要覆盖其内部工具调用，必须由对应 harness 提供版本化逐调用 seam 后另行接入。
- embedded run result、lifecycle 与 native reply 相邻模块
  - child / attempt 只 signal controller；root coordinator publish 成功后才把 reason 带出；
  - 结束 root Run，并把 `terminationReason` 写入唯一 result / lifecycle terminal event；
  - 生成一次不依赖 Provider 的确定性 native ReplyPayload，不走 error/retry 路径；
  - owner callback 只有拿到真实 delivery receipt 才算成功；入队后发送失败会释放 claim 并由 retained owner / ordinary root fallback 接管，不能因 callback resolve 永久吞掉提示。

本次不直接编辑 `vendor/openclaw-runtime/`。实现必须形成版本化 patch，并通过 runtime build 同步到产物。

四个新 patch 会与 `openclaw-aborted-tool-loop-breaker.patch`、`openclaw-terminate-run-on-critical-tool-loop.patch` 修改相邻代码。文件名保证 `core`、`delivery`、`native-receipt`、`harness` 依次应用，且都按现有字典序位于 `openclaw-terminate-run-on-critical-tool-loop.patch` 之后。生成 patch 时必须以脚本的实际字典序应用结果为基线，并从干净 `v2026.6.1` 完整回放全部 patches；不能只在已经手工修改的 sibling checkout 上验证。

core patch 的设计注释和契约测试应记录 `#112620`、`#97485`、`#110633` 的核对日期与差异，但不得复制未合并 PR 的大段实现。若借鉴其测试场景，fixture 必须在 LobsterAI patch 内独立、脱敏并锁定本文要求的行为，而不是依赖上游 PR branch。特别要锁定 `#97485` 当前 head 的 after-response 限制和额外 summary 行为，防止未来误把它探测成 Provider request budget。

### 4.2 LobsterAI managed config

`src/main/libs/openclawConfigSync.ts` 中扩展 managed 配置：

```json
{
  "agents": {
    "defaults": {
      "runSafety": {
        "maxToolCallReservationsPerBudgetScope": 64,
        "maxProviderDispatchesPerBudgetScope": 32,
        "maxCumulativeEstimatedPromptTokensPerBudgetScope": 2000000,
        "warningRatio": 0.75
      }
    }
  },
  "tools": {
    "loopDetection": {
      "enabled": true,
      "variantWarningThreshold": 2,
      "variantCriticalThreshold": 3,
      "detectors": {
        "genericRepeat": true,
        "knownPollNoProgress": true,
        "pingPong": true,
        "variantNoProgress": true
      }
    }
  }
}
```

原有 `historySize`、generic、known poll、ping-pong 和 Aborted 阈值保持不变。

绝对预算集中在 provider-neutral 的 `agents.defaults.runSafety`，`tools.loopDetection` 只保存 detector 配置；预算字段不包含积分、价格或套餐信息。controller 创建时冻结本 scope 的阈值，运行中的配置刷新不能扩大或重置当前预算。

当前 P0 不生成 `agents.defaults.maxToolCallingRounds`，因为 `#97485` 尚未形成可用的 Provider 请求预算契约。若实施期间该能力进入目标 tag，必须按 FR-11 重新评审；不得把其 round 计数映射到上述 dispatch 计数，也不得启用强制模型总结。

### 4.3 LobsterAI patch 契约

`scripts/apply-openclaw-patches.cjs` 为 core / delivery / native-receipt / harness 四个 patch 增加强校验，并把四个文件列为当前 pinned tag 的 required manifest；任一文件缺失必须在应用任何 patch 前失败，不能静默降级。至少确认：

- `familyHash` 被写入历史；
- `variant_no_progress` detector 存在；
- 参数族只走 allowlist；
- `RunSafetyController` 是 detector / 硬预算 decision 的唯一 owner，`RunSafetyRootCoordinator` 是 product terminal publication 的唯一 owner，diagnostic state 只镜像快照；
- raw tool-call reservation 发生在工具查找 / schema / hook / client-host 分流之前；
- tool batch ID 在 scope 内唯一，相同 batch replay 幂等、不同 child 不碰撞；
- `maxToolCallReservationsPerBudgetScope` 不依赖 historySize 或 runId 变化；
- 每次 Provider adapter / transport invocation 前都经过 dispatch + Prompt 双预算 reservation；
- Provider / Prompt 恰好耗尽后的 final text 可完成，tool-call response 在 raw batch 入口整批阻止；
- Agent / compaction path 的 `RunSafetyDispatchContextV1` 非 optional，和 `purpose: 'utility'` 的 simple completion 类型隔离；
- `compact.ts`、plugin / context-engine compaction 和 custom Provider 均使用强制 `onBeforeProviderDispatch(finalPayload, context)` seam；
- retry、fallback、compaction、recovery 和 subagent 继承原 `budgetScopeId`；
- 预算拒绝后不调用 Provider、不进入 fallback 且不请求模型总结；
- critical 仍返回 `deniedReason: "tool-loop"`；
- history sanitizer 整组删除 pair；
- terminal safety reason 产生唯一 typed product outcome 且不进入自动 retry；当前 normal end 和未来上游 `hook_block` 都映射为同一 wire contract；
- native owner 只有收到真实 delivery receipt 才记为成功，入队后失败会释放 publication task 并允许 retained owner 重试；
- 未版本化的 AgentHarness attempt / compact 在插件代码前 fail-closed；Codex `turn/start`、Copilot `sendAndWait` 和两者 compaction 都从 host-owned V1 seam 扣减共享预算；
- `shouldStopAfterTurn` 只能读取精确匹配当前 runId 的 reason，并且不能在首次读取后清除；
- OpenClaw 与 LobsterAI 的 termination wire value 保持一致；
- `#97485` 的 round exhaustion 不能被错误探测为 pre-dispatch Provider budget。

新增四个独立契约测试：

```text
src/main/libs/openclawPatches/varyingArgsNoProgressCorePatch.test.ts
src/main/libs/openclawPatches/runSafetyDeliveryPatch.test.ts
src/main/libs/openclawPatches/runSafetyDeliveryReceiptPatch.test.ts
src/main/libs/openclawPatches/agentHarnessRunSafetyPatch.test.ts
```

契约测试不能替代 OpenClaw 行为测试，两者都必须存在。

### 4.4 Adapter 与 UI 收口

保持 `openclawRuntimeAdapter.ts` 改动聚焦：

- 识别 lifecycle terminal event 中的结构化 `terminationReason`，不把它归类为 runtime error；
- 按 `rootInvocationId + kind` 幂等写入 Cowork safety system message，并确保该 scope 不进入 recoverable retry / failover；
- 首次桌面用户指令从 Gateway lifecycle 接收 runtime 生成的 `rootInvocationId + budgetScopeId`，并保存在 ActiveTurn / lifecycle 映射中；
- P0 禁止 Adapter 为 incomplete Plan 或 blocked mutating tool 发起隐藏 `chat.send`：前者保留原始可见结果并以普通本地 system 提示正常完成；后者复用 confirmed-stop 语义，只有 `chat.abort` 返回 `aborted:true`、收到明确匹配当前 runId 的 lifecycle terminal，或 resync 确认 remote already-idle 后，才写本地阻断提示并完成；
- blocked Plan 的 `chat.abort` 返回 `aborted:false` / unknown、reject 或 timeout，且 resync 仍为 active / unknown 时，必须保留原 ActiveTurn、streaming 消息和 running 状态；缺失 envelope / data runId 的 terminal 只能触发 resync，不能猜测为当前 run，更不能结束 replacement turn；
- Adapter provider-backed recovery 未来必须使用 OpenClaw 内部签发、一次性消费且绑定原 controller 的可信 claim；在该 seam 存在前，只有用户明确发送的新指令能创建新 IDs / scope 后继续；
- active steering 只有在 runtime 已确认其属于当前 active scope 并提供可信内部 claim 时才能沿用原两个 ID，不能由 Adapter 根据 session / run 缓存自行构造；
- 清理 ActiveTurn 并持久化非 running 状态；
- 新增面向用户操作的 `abortSessionAndConfirm()`；无 ActiveTurn 但有近期 running 证据的 native session 仍调用 `chat.abort`；
- 保留内部同步 `stopSession()`，共用提取后的本地 finalizer，避免改变 lifecycle fallback 与进程退出的即时清理语义；
- Gateway abort 失败时不提前清理本地 running 状态，并通过现有 IPC 失败结果反馈给 Renderer；
- 将安全终止映射到现有 Cowork 系统消息链路。

confirmed stop 需要同步扩展 `CoworkRuntime`、`CoworkEngineRouter` 和 Main IPC handler；Renderer 现有 `stopSessionRuntime()` 已经等待 IPC 结果，失败分支应保留 streaming/running 状态并显示本地化提示，不能自行切换为 idle。

用户可见文案加入：

- `src/main/i18n.ts`
- `src/renderer/services/i18n.ts`

native IM 的中英文终止文案和 locale 选择逻辑属于 OpenClaw 版本化 patch，不从上述 LobsterAI i18n 模块反向调用。

如果逻辑超过 Adapter 内一个窄 helper 的规模，应新增聚焦模块，例如：

```text
src/main/libs/agentEngine/openclawRunSafety.ts
```

不要借此拆分或重构整个 Adapter。

### 4.5 现场回放 fixture

从本次 JSONL 抽取脱敏合成 fixture，不提交用户账号、文件内容或完整目录：

```ts
[
  { n: 15, result: 'partial-a' },
  { n: 25, result: 'partial-b' },
  { n: 40, result: 'partial-c' },
  { n: 60, result: 'partial-d' },
  { n: 80, result: 'full' },
  { n: 100, result: 'full' },
  { n: 120, result: 'full' },
  { n: 150, result: 'must-not-run' },
];
```

fixture 的 fake Provider 每轮只生成一个工具调用。测试必须证明前三个 full 结果形成同一个 familyHash、不同 argsHash 和相同 resultHash；因此第三个 full outcome 后终止时，`N=150` 尚未由 Provider 生成。

### 4.6 上游吸收决策矩阵

| 目标 runtime 状态                             | LobsterAI 动作                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 仍为 `v2026.6.1`                              | 保留现有 aborted / critical termination backport，并新增本文 core / delivery patch                                                                                                                                                                                 |
| tag 已包含 `#94412` 等价行为                  | 先通过 aborted tool run 回归，再删除 `openclaw-stop-loop-after-aborted-tool-run.patch`；`openclaw-aborted-tool-loop-breaker.patch` 是否删除需单独判断                                                                                                              |
| tag 已包含 `#110633` 等价行为                 | 只有 FR-5 的五项行为回归通过后，才让上游成为唯一 core terminal owner 并删除本地重复 hook；保留 detector / budget signal bridge、`hook_block` 到 `RunSafetyTermination` 的产品归一化、retry / failover 抑制和 delivery 增量，否则不去补丁                           |
| tag 已包含 `#112620` 等价行为                 | 保留本文 allowlisted family detector；上游只作为低基数 detector / veto 补充，不提供完整 Run termination。若没有 `#110633` 等价 owner，继续保留本地 terminal backport                                                                                               |
| tag 已包含 `#97485` 等价行为                  | 标记为 `toolRoundExecutionLimit`，不得标记为 `providerDispatchBudget`；若正常 exhaustion 仍强制 summary attempt 则保持关闭，若可禁用才可作为附加 backstop，同时保留 raw tool reservation、Provider dispatch count、累计 estimated Prompt exposure 三项客户端硬边界 |
| PR 仅 Open、Closed-unmerged 或代码只在 `main` | 不改变 bundled runtime patch 方案                                                                                                                                                                                                                                  |

每次 OpenClaw 升级 PR 必须在描述中附一份该矩阵的实际判定、目标 tag/commit、被删除或保留的 patch 列表和对应回归结果。

## 5. 状态与边界处理

| 场景                                                    | 预期行为                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 同一完整参数、相同结果                                  | 继续由 genericRepeat 处理                                                                          |
| 同一完整参数、结果持续变化                              | 本文不做语义归并；由现有 warning、相邻 consecutive detector（若目标 tag 已包含）和 64 次硬预算兜底 |
| 参数只改变 `First N`、结果连续相同                      | 第三次后产生 variant critical                                                                      |
| 41 个窗口参数循环且 historySize=40                      | 不等待完整参数重复；前三个同 family / 同 result 的不同参数即 critical                              |
| 参数改变且结果也改变                                    | streak 重置，继续任务                                                                              |
| 不同 URL / path / query                                 | familyHash 不同，不累计                                                                            |
| 不同工具之间得到相同结果                                | 不由 variant detector 合并；由各自 detector 和 scope 硬预算兜底                                    |
| 已知 process poll                                       | 继续由 known poll 处理                                                                             |
| 同一错误且 `exitCode != 0`                              | 失败 outcome 参与 streak                                                                           |
| 未知或可能写入的 exec                                   | 不做 family 归一化，由硬预算兜底                                                                   |
| 当前 scope 已有 63 个 reservation，新 batch 有 3 个工具 | 只给原始顺序第一个调用 ticket，后两个在执行前 veto；scope 进入 draining                            |
| 混合并行批次中一个调用命中 critical                     | 正常 sibling 完成，turn 边界终止                                                                   |
| 旧历史有 200 组重复 pair                                | 模型上下文只保留最近 2 组，原 JSONL 不改                                                           |
| safety termination 后出现 late event                    | 不重建 ActiveTurn，不恢复 running                                                                  |
| 用户明确继续                                            | 新 `budgetScopeId` 和新 runId；先使用已清理上下文                                                  |
| OpenClaw 内部 automatic recovery 创建新 runId           | 必须携带可信一次性 claim，继承原 `budgetScopeId`、controller 和剩余预算                            |
| Adapter 遇到 incomplete Plan                            | 不调用 `chat.send`；保留当前可见结果、本地提示并完成，等待用户新指令创建新 scope                   |
| Adapter 在 Plan Mode 阻止 mutating tool                 | 只执行 confirmed `chat.abort` / resync，不自动调用 Provider；仅远端确认 stopped 后本地收口          |
| Plan abort 返回 false / reject / timeout，远端仍 active | 保留原 turn、streaming 与 running；后续明确匹配 terminal 到达时再完成                               |
| Plan lifecycle terminal 缺少 runId                      | 不回退猜当前 turn；只 resync，remote idle 未确认时保持 running                                      |
| 第 33 次 Provider dispatch                              | provider adapter / transport 调用前拒绝，root 与 child Run 都不再 dispatch                         |
| 下一次 Prompt estimate 会使累计值超过 2,000,000         | dispatch 前拒绝，不触发 compaction、fallback 或模型总结                                            |
| 无可靠 Prompt estimator                                 | 使用 byte / context-window 保守预占；仍不可估算则 fail-closed                                      |
| 客户端无法得到精确积分                                  | 不伪造金额；以工具 reservation、Provider dispatch 和 estimated Prompt 暴露三项本地上限止损         |
| 上游和本地都包含 critical termination                   | 构建或契约测试失败，禁止双重 terminal owner 进入产物                                               |

## 6. 涉及文件

LobsterAI 侧实现涉及：

- `src/shared/cowork/constants.ts`
- `src/shared/cowork/runSafety.ts`
- `src/shared/cowork/runSafety.test.ts`
- `src/main/libs/agentEngine/types.ts`
- `src/main/libs/agentEngine/coworkEngineRouter.ts`
- `src/main/libs/agentEngine/coworkEngineRouter.test.ts`
- `src/main/libs/agentEngine/runSafetyTermination.ts`
- `src/main/libs/agentEngine/runSafetyTermination.test.ts`
- `src/main/libs/openclawConfigSync.ts`
- `src/main/libs/openclawConfigSync.runtime.test.ts`
- `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
- `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
- `src/main/main.ts`
- `src/main/preload.ts`
- `src/renderer/services/cowork.ts`
- `src/renderer/types/electron.d.ts`
- `src/main/i18n.ts`
- `src/renderer/services/i18n.ts`
- `scripts/apply-openclaw-patches.cjs`
- `scripts/patches/v2026.6.1/openclaw-live-tool-result-cache-stability.patch`
- `scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-core.patch`
- `scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-delivery.patch`
- `scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-native-receipt.patch`
- `scripts/patches/v2026.6.1/openclaw-z-agent-harness-run-safety.patch`
- `src/main/libs/openclawPatches/patchTestUtils.ts`
- `src/main/libs/openclawPatches/varyingArgsNoProgressCorePatch.test.ts`
- `src/main/libs/openclawPatches/runSafetyDeliveryPatch.test.ts`
- `src/main/libs/openclawPatches/runSafetyDeliveryReceiptPatch.test.ts`
- `src/main/libs/openclawPatches/agentHarnessRunSafetyPatch.test.ts`

OpenClaw 侧新增的 controller、raw tool reservation 和 Provider gate 都通过版本化 patch 交付；本方案不需要修改 Token Proxy 或任何远端计费接口。

现有 `stopSession()` 调用点和测试 mock 保持同步兼容，不做全局异步迁移。只有用户点击停止的 Main IPC 路径改为等待 `abortSessionAndConfirm()`；会话删除、IM 轮换、lifecycle fallback 和进程退出继续使用明确的 best-effort stop 语义。

不得直接修改：

- `vendor/openclaw-runtime/` 生成产物；
- 用户机器上的 JSONL；
- 相邻 OpenClaw checkout 的未补丁化源码。

## 7. 发布与兼容策略

### 7.1 P0-A：运行时止损核心门禁

第一发布单元只包含客户端资源止损所需的最短闭环：

1. 参数族 + 结果级 `variant_no_progress` detector；
2. `maxToolCallReservationsPerBudgetScope=64` 硬上限；
3. `maxProviderDispatchesPerBudgetScope=32` 与 `maxCumulativeEstimatedPromptTokensPerBudgetScope=2_000_000`；
4. pre-controller `RunSafetyRootCoordinator`、顶层 `RunSafetyController`，以及跨 OpenClaw 内部 trusted-claim recovery / fallback / compaction / subagent 的两个 ID 继承；
5. Adapter 禁用 incomplete Plan / blocked Plan safety 的 provider-backed automatic recovery，并以本地提示完成原 turn；未来 claim seam 不属于本次 P0；
6. raw tool-call reservation 与每次 Provider invocation 前的统一 gate；
7. typed terminal outcome / lifecycle 携带结构化 `terminationReason`；
8. 现场顺序回放、三项预算边界测试和 patch 强校验。

P0-A 是最先执行的行为门禁，但最终实现已经包含四 patch required manifest，不再允许只漏交 delivery / native-receipt 文件的部分发布。不能只发布 Prompt、UI 加载动画或日志，因为它们不能阻止 Provider 请求继续发生。

### 7.2 P0-B：终止交付与污染历史治理

第二发布单元包含：

1. native IM 确定性终止 ReplyPayload；
2. Adapter / Cowork safety system message 和幂等去重；
3. 旧重复工具 pair 的模型上下文折叠；
4. 结构化诊断与中英文文案。

P0-B 不改变 P0-A 的 detector 和预算判断，但 delivery 与 native-receipt 是当前正式 manifest 的必需组成；P0-B 行为失败会阻止最终发布。

### 7.3 P0-C：用户主动停止确认

第三验证单元新增 `abortSessionAndConfirm()`、无 ActiveTurn 的 native abort 兜底、`aborted` 响应校验、超时和状态 resync。它与既有 `im-stop-session-bug` 边界相邻，应独立回归；最终发布仍要求 P0-A / P0-B / P0-C 全部通过。

### 7.4 P1：交互、长任务模式与渠道完善

P1 可增加：

- 桌面端“继续任务”按钮，本质上发送新用户指令并创建新 `budgetScopeId`；
- 飞书 `/stop`、停止关键词的抢占式处理验证；
- 三项客户端预算达到 75% 时的非打扰式本地提示；
- 用户显式选择的长任务 / job 模式；使用更高但仍有限的 scope 预算，不允许 Prompt 或 Agent 自行提额；
- 文件发送 capability / receipt 的渠道集成测试；
- detector 阈值遥测与误判分析。

### 7.5 灰度

首批灰度记录：

- variant warning / critical 触发率；
- 用户在终止后 10 分钟内继续的比例；
- 被终止 Run 的工具族和结果指纹；
- critical 前累计工具数和 usage；
- 误判申诉；
- safety critical 后是否仍出现下一次 Provider 请求；
- 三项硬预算命中时的 tool reservation、Provider dispatch、累计 estimated Prompt 和 estimator source；
- retry、fallback、compaction、recovery 与 subagent 是否正确继承原 `budgetScopeId`；
- 预算拒绝后 inner Provider 调用数，必须为 0；
- 目标 tag 若启用 `maxToolCallingRounds`，单独记录 per-round count，不能与 dispatch count 混用。

如果 critical 后仍有 Provider 请求，视为 P0 阻断缺陷，不得通过调大阈值规避。

### 7.6 上游复核门禁

实施开始、OpenClaw 目标 tag 变更和正式发布前分别重新核对 `#94412`、`#110633`、`#112620`、`#97485`、`#97577` 与 `#112447`。每次复核必须记录：

- tag / commit SHA 与核对日期；
- PR 是否 merged，以及目标 tag 是否实际包含对应 commit；
- 本地 patch 是保留、缩减还是删除；
- detector / budget / termination / delivery 的最终 owner；
- clean-tag patch replay 和组合回归结果。

上游 PR 仍处于 Open 或 Closed-unmerged 时不得阻塞 P0-A；上游已合并但尚未进入 LobsterAI bundled runtime 时也不得提前删除本地保护。

## 8. 测试与验证计划

### 8.1 P0-A：core 止损门禁

OpenClaw core 单元测试：

1. PowerShell 现场命令的 `N=80/100/120` 生成相同 familyHash。
2. warning 满足 `streak=2/distinctArgs=2`，critical 满足 `streak=3/distinctArgs=3`。
3. 三次相同结果后，当前 runId 的 detector state 调用 scope `tryTerminate()`；`shouldStopAfterTurn` 读取同一 controller，root coordinator `publishTerminalOnce()` 只成功一次，且不进入下一次 Provider 请求。
4. 结果变化时 streak 重置；path、URL、query、cursor 改变时 familyHash 不同。
5. 含删除、写入、重定向或未知管道的 exec 不生成 familyHash。
6. 非零 exitCode 即使 `isError=false` 仍生成稳定失败 outcome。
7. raw tool batch 在 lookup / schema / hook 前同步 reservation：已有 63 个槽、batch 含 3 个调用时，仅原始顺序第一个获得 ticket，后两个在执行前 veto。
8. unknown tool、非法参数、policy denied 和 client-hosted tool 只要获得 reservation 就计数；同一 `toolBatchId + rawIndex` 重放不重复计数，两个 child 即使本地 ordinal 相同也获得不同 scope-unique batch ID 并分别计数。
9. automatic recovery 和 active steering 即使获得新 runId 也继承原 budgetScope/controller；上一 scope 结束后的新外部用户指令即使错误复用旧 runId，也创建新 scope。内部 Provider 路径缺失 controller 时 fail-closed。
10. 混合并行批次中已经开始的正常 sibling 完成，variant critical 后 Provider 不进入下一轮；不要求拦截同批次已经开始的第四个 sibling。
11. termination 通过 typed lifecycle terminal outcome + `terminationReason` 结束，不进入 error fallback、retry 或 failover；当前 backport 的 normal end 和未来上游 `hook_block` 都归一为同一产品结果。
12. 模拟 Provider fallback 后触发 detector，诊断身份等于最后一次实际 resolved provider/model，不等于 session 元数据。
13. `historySize=40` 且连续参数均不同的回放不依赖任何完整 argsHash 重复；`N=80/100/120` 仍在第三个相同结果后 critical。
14. 一个未登记 family 的普通工具执行 15 个业务参数并完整重复两遍，不触发 `variant_no_progress`；证明没有把 `#112620` 的通用 churn 规则误塞进本文 allowlist detector。
15. 同一完整参数但结果每次变化、以及不同工具返回相同结果时，variant detector 均不误判；如果持续执行，独立 64 次 raw tool reservation 预算仍能终止。
16. 分别覆盖 `#112620 + 本地 terminal owner`、`本地 family detector + #110633 owner`、两者同时存在三种组合；加入低基数 A/B churn 正向用例，且每种组合都必须零后续 Provider dispatch、一次 terminal reason、一次 callback 和一次交付。
17. 对 `#97485` 当前时序做契约 fixture：max=N 时第 N+1 个 Provider response 已发生但工具不执行，随后会调度 summary attempt；P0 保持该能力关闭。未来关闭 summary 后不得有 N+2 dispatch，而 FR-12 若先命中则连 N+1 dispatch 都不得发生。
18. 清空、TTL 淘汰或合并 diagnostic snapshot 不改变 controller 中的 authoritative detector history；不同 runId 的 detector state 不串线。

LobsterAI core 门禁：

```bash
npm test -- src/main/libs/openclawPatches/varyingArgsNoProgressCorePatch.test.ts
npm test -- src/main/libs/openclawConfigSync.runtime.test.ts
npm test -- src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts
npm run compile:electron
```

还必须从干净 `v2026.6.1` 回放包含 core / harness / delivery / native-receipt 的 required manifest，完成行为测试和 runtime build；P0-A 专项断言至少覆盖 core + harness。harness patch 是 Codex / Copilot Provider 与 Prompt 预算闭环的一部分，不能推迟到全量发布回归。P0-A 的 Adapter 测试要求 incomplete Plan 与 blocked Plan safety 均不产生第二次 `chat.send` / Provider request；blocked Plan 只有取得远端 stop confirmation 后才能以本地提示退出 running，`aborted:false` / reject / timeout / identity-less terminal 在 remote active 或 unknown 时必须继续保持原 turn running。

现场顺序回放使用每个 Provider turn 只产生一个工具调用的 fake provider 和 fake exec：前四个结果不同，`N=80/100/120` 相同；断言 `N=150` 未生成、Provider request 不再增加、总工具调用不超过 20。不得调用真实计费模型。

### 8.2 P0-B：终止交付与历史门禁

1. history sanitizer 使用真实 `AgentMessage[]`，按 toolCallId 配对并重新计算 family/result Hash；200 组重复 pair 最多保留最近 2 组，且没有孤儿消息。
2. 原始 JSONL 不变，只有 Provider transcript 被折叠。
3. session → attempt callback 只触发一次；native delivery receipt 只在发送成功后落位；发送失败不会因 callback flag 被抑制。
4. native 飞书收到一次确定性终止 ReplyPayload，桌面端按 `rootInvocationId + kind` 只写入一次 Cowork safety message；bootstrap failure、child / recovery runId 变化均不重复交付。
5. 中英文文案按各自端的 locale 来源生成，不调用 Provider。

```bash
npm test -- src/main/libs/openclawPatches/runSafetyDeliveryPatch.test.ts
npm test -- src/main/libs/openclawPatches/runSafetyDeliveryReceiptPatch.test.ts
npm test -- src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts
npm run compile:electron
```

P0-B 在已经通过 P0-A 的 core + harness 基线上，再验证 delivery + native-receipt；四个 patch 必须从干净 `v2026.6.1` 按字典序完整应用，并确认 runtime bundle 包含 history sanitizer、termination delivery 与真实 delivery receipt 仲裁。

### 8.3 P0-C：confirmed stop 门禁

1. 有 ActiveTurn 时使用精确 sessionKey + runId abort。
2. 无 ActiveTurn、但有近期 running 证据时使用映射 runId；缺少 runId 时使用 sessionKey-only abort。
3. `aborted:true` 返回 `aborted` 并清理本地状态。
4. `aborted:false` 后 resync 为 idle 返回 `already_idle`；resync 仍 running 或未知返回 `failed`。
5. RPC 超时/失败返回 `failed`，Renderer 保持真实状态并显示提示。
6. 已确认停止后的 late event 不恢复 running；内部同步 `stopSession()` 行为不回归。

```bash
npm test -- src/main/libs/agentEngine/coworkEngineRouter.test.ts
npm test -- src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts
npm run compile:electron
```

### 8.4 全量发布回归

三个验证单元全部通过后，运行官方 `npm test`、changed-file ESLint、`npm run compile:electron`，从干净 OpenClaw tag 完整回放全部 patches，并实际验证 runtime startup、managed config、Gateway 与 native 飞书收发。发布证据还必须包含 FR-11 的上游能力快照、最终 patch 列表，以及对 bundled runtime 的符号/行为检查，证明不是只在 sibling OpenClaw checkout 中生效。四 patch manifest 原子交付，任一专项门禁失败都阻止发布。

### 8.5 P0-A：客户端 Provider / Prompt 预算专项门禁

1. 将 dispatch 测试阈值设为 2 时，前两次 reservation 成功；第三次在 inner provider stream / transport 前被拒绝，inner 调用数保持 2；相同 `providerDispatchId` 重入返回同一 decision，绝不产生第二次 dispatch。
2. Prompt 累计后恰好等于阈值时允许；该响应若为最终文本则正常结束，若含 tool calls 则整批在副作用前拒绝；下一次 continuation 会超过阈值时拒绝，payload 不到达 Provider。
3. runtime 内部 retry、auth/profile rotation、model/provider fallback、compaction、summary、持有可信 claim 的 recovery、empty-response recovery 以及同一 attempt 的下一模型轮次都使用新 `providerDispatchId`、原 budgetScope，并重新计数；P0 Adapter 不发起 Plan provider recovery。
4. Provider 成功、业务错误、timeout、stream 中断、transport error 和用户取消都不返还 reservation；下一次 retry 继续累计。
5. 两个并行请求只剩一个 dispatch 槽时只能一个成功；只剩一份 Prompt 额度时也只能一个原子 reservation 成功；多个 subagent 共同使用 root aggregate budget。
6. OpenClaw 内部 automatic recovery / active steering 只有携带可信一次性 claim 时，创建新 runId 后仍继承原 counter；P0 Adapter 不构造 claim，上一 scope 结束后的新外部用户指令创建新 scope 和干净 counter。
7. fallback 后必须按最终目标 Provider / Model 的实际 payload 重新估算 system prompt、messages、tool definitions 和 media，不能复用旧估算；自营、OpenAI-compatible custom remote、本地模型和 plugin adapter 都从 `onBeforeProviderDispatch(finalPayload, context)` 进入同一 gate。
8. estimator 用固定 payload fixture 验证 UTF-8 byte / structure-overhead 公式、媒体加法、context-window 替代、向上取整和 saturating add；`NaN`、`Infinity`、负数、溢出与完全不可估算均不能 fail-open。
9. Provider SDK 隐藏 retry 已关闭或逐次经过 gate；用 transport spy 证明没有 gate 外的实际请求。
10. scope ID 缺失时产生不带 `budgetScopeId` 的 `run_budget_identity_missing`；ID 存在但 controller 丢失时产生带该 ID 的 `run_safety_state_unavailable`；两者 inner Provider 调用数均为 0，并各自只产生一次 root-coordinator 产品终态 / 用户交付。
11. 两个 child 同时命中预算时只能一个 `tryTerminate()` reason 和一个 root coordinator `publishTerminalOnce()` 成功；root / 其他 child 均不能继续 dispatch，lifecycle、native delivery 和 Adapter message 各一次。
12. Desktop 新用户根指令、native IM、Cron、OpenClaw 内部 trusted-claim recovery 与 subagent 的 fake-provider E2E 都携带或继承正确 `rootInvocationId + budgetScopeId`；Adapter incomplete / blocked Plan 用 transport spy 证明没有第二次 `chat.send` / Provider request，并覆盖 `aborted:true`、`aborted:false + still-running`、already-idle resync、reject、timeout、later matching lifecycle、缺失 envelope 但 data.runId 为旧 run、两处 runId 都缺失以及 stale replacement turn。
13. active scope 期间刷新 managed config 不扩大或重置已经冻结的三个阈值。
14. Gateway / App 中途崩溃后旧 controller 丢失，P0 不恢复 checkpoint；旧任务的自动恢复在 Provider 前 fail-closed，新的明确用户指令可以创建新 scope。
15. active → draining → ended 正常清理，ended tombstone 拒绝 late event；active registry 已有 128 个 scope 时，新 root fail-closed、零 Provider dispatch 且只交付一次 bootstrap failure，任何 active controller 都不被淘汰；tombstone 的 512 项 LRU / TTL 独立生效。
16. 非整数 warning 边界按 `ceil(limit * ratio)`，三个维度各 warning 一次；非法 limit / ratio 回退安全默认，active scope 的冻结阈值不受 managed config 刷新影响。
17. 纯本地 credential refresh 不计数；refresh 后真正调用 Provider 的 adapter invocation 正常计数。
18. `compact.ts` 和 plugin / context-engine 直接 compaction 路径也扣减 root scope；transport spy 证明没有绕过 gate 的 stream construction。
19. root Run 先结束、后台 child 随后命中 critical 时，controller `onDrained` 仍能唤醒 root coordinator，发布一次 safety terminal 并完成清理。
20. provider registration 拒绝不声明 V1 contract 的 Agent adapter；Agent / compaction 缺 `RunSafetyDispatchContextV1` 时零 transport 调用，而 conversation label / TTS 等 `purpose: 'utility'` simple completion 只能走类型隔离入口，不能被 Agent 或 plugin 降级选择。
21. 外部 CLI harness 的 fresh / resume / recovery / fallback 每次 spawn 都重新扣减共享 scope 的 dispatch 与最终 Prompt 预算；测试与发布说明明确不把 CLI 子进程内部、runtime 不可观察的工具调用计入 raw tool reservation 覆盖。
22. Codex / Copilot `AgentHarness` 的 attempt、retry / recovery、fallback 与 compact 每次都获得同一 controller 下的新 ticket；未版本化 handler 在插件代码前拒绝，达到 dispatch / Prompt 上限时真实 `turn/start` / `sendAndWait` / compact transport 调用数为 0。

所有测试使用 fake / stub Provider 和本地 token estimator，不调用真实计费模型，也不需要任何账号凭据。

## 9. 验收标准

### 9.1 P0-A 验收

- [ ] 每轮单工具的现场 fixture 在第三个相同结果后终止，`N=150` 不执行，同一 Run 不再发生下一次 Provider 请求。
- [ ] 参数不同但同 familyHash、同 resultHash 能累计；不同 URL、path、query、变化结果或未知副作用 exec 不误判。
- [ ] 41 个不同完整参数、`historySize=40` 的回归不依赖 argsHash 重复，仍在前三个同 family / 同 result 变体后终止。
- [ ] raw tool reservation 位于 lookup / schema / hook 之前；已有 63 个槽的三调用 batch 只执行第一个，unknown / invalid / client-hosted 路径不能绕过。
- [ ] 所有 Agent / compaction provider adapter 携带非 optional V1 context，在 final payload 转换后、transport / local inference 前进入统一 seam；第 33 次 dispatch 被阻止，失败、timeout 或取消不返还计数。
- [ ] dispatch / Prompt 恰好耗尽时，最终文本正常结束，tool-call batch 在副作用前被拒绝；超过 2,000,000、fallback 重估、非法 estimator 与媒体 fallback 行为符合 FR-12。
- [ ] retry、fallback、compaction、OpenClaw 内部 trusted-claim recovery 和 subagent 共享 root invocation / budget scope；Adapter incomplete / blocked Plan 不调用 Provider，仅上一 scope 结束后的新外部用户指令创建干净 IDs 和预算。
- [ ] 混合批次中已经开始的正常 sibling 完成；两个 child 同时命中也只产生一个 root typed product safety terminal outcome。
- [ ] 与目标 tag 已有 argument-churn / critical-termination / round-budget 能力组合后，仍只有一个 terminal owner、一次 callback 和一次用户交付。
- [ ] 旧 scope 的 terminal reason 不会终止新外部指令；同一 scope 内 runId 变化不能重置 counter，callback 只投递一次。
- [ ] typed safety termination 不触发 Provider failover、自动 retry、compaction、模型总结或旧 Run 复活。
- [ ] 诊断使用最后一次实际 resolved provider/model，不使用 session model 猜测，并且不记录用户正文及敏感数据。
- [ ] controller active / draining / ended、registry 满载 fail-closed、30 分钟 tombstone 和进程丢失后禁止自动恢复均满足 FR-12。
- [ ] 本事故回放不超过 20 次工具调用，不能再次出现 200+ 调用或千万级 Token 消耗。

### 9.2 P0-B 验收

- [ ] 真实 `AgentMessage[]` 旧会话中的 200 组重复工具 pair 在模型上下文中最多保留 2 组完整 pair，且没有孤儿消息。
- [ ] 原始 JSONL 不被删除或改写。
- [ ] native delivery receipt 与 core callback 状态分离，发送失败不会被误记为成功。
- [ ] 桌面端和 native 飞书都收到一次明确自动停止提示，不额外调用 Provider。

### 9.3 P0-C 验收

- [ ] native channel 无 ActiveTurn 但有近期 running 证据时，点击停止仍调用 Gateway `chat.abort`。
- [ ] `aborted` 或 resync 确认的 `already_idle` 显示成功；远端仍 running、状态未知、超时或失败返回 `failed`，不伪装成 idle。
- [ ] confirmed stop 不改变内部 best-effort `stopSession()` 的 lifecycle/退出行为。

### 9.4 客户端保护与产品口径

- [ ] LobsterAI 自营模型、OpenAI-compatible 自定义远程 Provider、本地模型和 plugin Provider 都走同一个 `RunSafetyController`；不支持强制 seam 的 adapter fail-closed，不能按 Provider 类型静默豁免。
- [ ] 在一个 live `budgetScopeId` 内，raw tool reservation、runtime 可观察 Provider dispatch 和累计 estimated Prompt 暴露均不会超过本地阈值。
- [ ] Provider 预算拒绝后，inner adapter / transport 调用数为 0；并行、fallback、retry、compaction、recovery 和 subagent 不能绕过。
- [ ] 实时工具结果 projection 保持固定 aggregate cap；相同 payload 的 retry / fallback 字节一致，projection 只作用于请求副本，不改写原始 session history。
- [ ] 客户端不把 estimated Prompt tokens 或 `usage.cost.total` 展示成精确积分、余额或账单，也不在预算提示中引导充值。
- [ ] 发布说明使用“客户端模型调用次数与累计 Prompt 暴露硬止损”，不得宣称“精确积分金额绝对上限”。

## 10. 风险与后续项

### 10.1 误判风险

参数族必须是 allowlist，而不是通用数字归一化。首发宁可让未知工具只受 64 次 raw reservation 硬预算，也不能把有副作用的不同调用错误合并。

### 10.2 终止后无用户回复

这是本次现场的核心体验问题之一。测试必须覆盖 native 飞书实际收到一次 terminal message，不能只断言内部 `agent_end`。

### 10.3 合法超长任务

64 次工具 reservation、32 次 Provider dispatch 和 2,000,000 estimated Prompt tokens 都是一次外部任务 scope 的上限，不是整个会话上限。用户明确继续后创建新 `budgetScopeId`，任务可以分段完成。后续若产品需要无人值守的大批量任务，应建立独立的 job 模式、有限预算和进度协议，而不是放宽通用聊天任务或让自动恢复重置 counter。

### 10.4 客户端预算的能力边界

不同 Provider 的缓存、价格、倍率、输出计费和 SDK 行为并不统一，因此本文不承诺精确积分金额。它承诺在一个 live `budgetScopeId` 内，客户端可观察的 raw tool reservation、Provider dispatch 和累计 estimated Prompt exposure 不超过本地阈值。Provider SDK 若存在 runtime gate 不可观察的内部 retry，必须关闭或接入 gate；否则该 Provider 不得被标记为满足 dispatch 硬边界。本地模型即使没有积分概念，也继续受相同保护以避免资源和时间失控。

外部 CLI harness 是明确例外边界：OpenClaw 能在 spawn 前限制该进程对应的 dispatch 和最终 Prompt 暴露，但无法观察 CLI 子进程内部的每一次工具调用，因此不能把内部调用计入 `maxToolCallReservationsPerBudgetScope`。这不是按模型来源豁免；同一 CLI 路径仍然 fail-closed 地受另外两项预算保护，只是 raw tool-call 能力必须等 harness 暴露逐调用 seam 后才能补齐。

Codex app-server 与 Copilot SDK 的 `AgentHarness` 不属于上述“opaque CLI 子进程内部工具”例外：host 能观察它们的 turn / send / compact 边界，因此这些调用必须通过强制 V1 dispatch seam 计入 Provider 与 Prompt 预算。只有其内部未向 host 暴露的细粒度工具动作仍适用不可观察边界；不能因此让整个 harness turn 计数为 0。

### 10.5 工具调用数与模型轮次混淆

`maxToolCallReservationsPerBudgetScope` 和上游候选 `maxToolCallingRounds` 保护不同边界。只保留轮次预算会放大单轮并行工具的执行面；只保留调用预算又不能完整表达 Provider retry、fallback 和 compaction 成本。本文 P0 同时固定 per-call、pre-dispatch request 和累计 Prompt 暴露三项上限；若未来加入 per-round 上限必须分别观测和测试，不能用一个计数器同时承担多种语义。

### 10.6 上游漂移与双重补丁

OpenClaw PR 可能在合并前改名、缩小范围、关闭未合并，或合并后被重构。仅凭 PR 号删除本地 patch 会重新暴露事故；反过来，在已经包含等价 upstream hook 的 tag 上继续应用完整本地 patch，可能造成双重终止、重复消息或状态竞争。FR-11、4.6 和 clean-tag 组合回归是发布硬门禁。

### 10.7 默认阈值误伤

32 次 Provider dispatch 或 2,000,000 estimated Prompt tokens 可能提前终止合法长任务。P0 优先可恢复地停止并保留已有结果；用户可用新指令继续。灰度只允许基于遥测调整 managed 默认，不能在单个运行中由模型自行提额。正式支持更长任务时使用显式 job 模式，而不是取消通用保护。

## 11. 与既有设计的关系

- `openclaw-critical-tool-loop-termination`：负责 detector 已经 critical 后真正结束 Run；本文复用，不重复设计终止语义。
- `openclaw-aborted-tool-loop-token-burn`：负责 `Aborted` 专项累计和 aborted 历史污染；本次 205 次结果大多成功，不能由该 detector 覆盖。
- `openclaw-oversized-transcript-oom`：处理 transcript 物理体积和 Gateway OOM；本文处理在形成超大历史之前主动终止无进展 Run。
- `im-stop-session-bug`：处理 IM 停止后的状态和再激活；本文只补 native session running 但本地无 ActiveTurn 时的真实 abort 兜底。
- OpenClaw `#112620`：候选的低基数 argument churn detector；本文处理其当前算法抓不到的 allowlisted 高基数参数族，不把该 PR 当作替代品。
- OpenClaw `#97485`：候选的工具轮次执行上限；当前 head 的正常 exhaustion 路径会调度额外模型 summary attempt，不是 Provider 请求预算。本文保持关闭，并保留 raw tool reservation、Provider dispatch count、累计 estimated Prompt exposure 三项客户端硬边界；未来只有在 summary 可关闭且接入唯一 terminal owner 后才考虑叠加。
- OpenClaw `#110633` / `#94412`：分别对应 critical 后终止和 aborted tool run 后终止；升级时按 4.6 做去补丁，不重复 terminal owner。
- OpenClaw `#97577` / `#112447`：分别代表跨工具/参数稳定结果和相同参数变化结果的相邻盲区；本文 P0 不做宽泛语义合并，由 scope 级三项硬预算兜底。
