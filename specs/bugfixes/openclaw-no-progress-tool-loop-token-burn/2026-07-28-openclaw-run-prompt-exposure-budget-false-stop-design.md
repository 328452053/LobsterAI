# OpenClaw 累计 Prompt 暴露预算误停修复设计文档

> 状态：Draft — 待评审，未实施
>
> 最后更新：2026-07-28
>
> 本文交付门槛：P0；P1/P2 为不阻塞 P0 的后续方向，实施前需独立评审
>
> LobsterAI 目标 OpenClaw：`v2026.6.1`
>
> 上游核对快照：OpenClaw `v2026.7.2-beta.5` 与 2026-07-28 的相关 PR head
>
> 取代范围：本文只取代 2026-07-22 设计中“累计 estimated Prompt 暴露达到
> 2,000,000 后硬停止”及其关联的估算失败、warning、终止和验收契约；raw tool、
> Provider dispatch、Run scope、semantic detector、唯一 terminal owner、历史折叠和
> native stop 等其余契约继续有效。

## 1. 概述

### 1.1 用户问题与现场证据

2026-07-27 的用户日志显示，同一桌面 Cowork 会话
`de103925-b033-4b61-8294-8813269fb625` 在执行一个持续推进的本地任务时，连续三次被
`run_prompt_exposure_budget` 自动停止。用户在前两次停止后分别发送新的继续指令，但新的
Run 仍在数分钟后因同一原因停止。

三段 Run 的关键数据如下。累计值来自对当前 `RunSafetyController` reservation 规则的离线
重建：

| 任务段 | `rootInvocationId` | 首次 Prompt estimate | 已放行 Provider dispatch | 被拒绝的 dispatch 序号 | raw tool result | 被拒绝时预计累计暴露 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 原始任务段 | `04d5a81d-4de4-43c7-8d3b-23140da3288f` | 114,849 | 15 | 16 | 15 | 2,096,802 |
| 第一次用户继续 | `50a02631-2036-40b9-8629-0373c618ae28` | 152,508 | 14 | 15 | 14 | 2,136,105 |
| 第二次用户继续 | `21783951-c505-4df3-b011-845c234b121d` | 163,869 | 13 | 14 | 13 | 2,107,423 |

证据来源为用户提供的
`lobsterai-logs-20260727-232858/main-2026-07-27.log`：三次 terminal 分别位于
60273、61548、62360 行；三段首次 context precheck 分别位于 59307、60457、61716 行。

三段 Run 均满足：

- OpenClaw context precheck 为 `route=fits`；
- `overflowTokens=0`；
- 模型 `contextTokenBudget=1,000,000`；
- 没有达到 32 次 Provider dispatch；
- 没有达到 64 次 raw tool reservation；
- 没有命中 `variant_no_progress` 或其它 semantic critical detector；
- 每段 Run 都返回了多个不同工具结果，未呈现原事故的稳定相同结果循环特征。

Transcript 回放中，三段 Run 分别产生 15、14、13 个工具结果，其中精确内容分别有
15、12、13 种。它们不是 2026-07-20 事故中的“205 次稳定相同结果”循环。

因此，本次停止不是模型上下文溢出，也不是整个聊天累计耗尽预算。三个不同的
`rootInvocationId` 证明每条外部用户指令都创建了新的执行过程；误停发生在每个新 Run
内部。

### 1.2 当前根因

当前 managed 配置为：

```ts
const MANAGED_RUN_SAFETY = {
  maxToolCallReservationsPerBudgetScope: 64,
  maxProviderDispatchesPerBudgetScope: 32,
  maxCumulativeEstimatedPromptTokensPerBudgetScope: 2_000_000,
  warningRatio: 0.75,
} as const;
```

当前 controller 在每次 Provider dispatch 前执行：

```text
nextPromptTotal =
  cumulativeEstimatedPromptTokens + estimatedPromptTokensForThisDispatch

if nextPromptTotal > 2_000_000:
  terminate(run_prompt_exposure_budget)
```

Agent 每取得一次工具结果，下一轮模型请求通常会再次携带 system prompt、历史消息、
tool call、tool result 和 tool definitions。累计公式按每次完整 Provider-visible payload
相加，因此近似成本为：

```text
累计 raw Prompt exposure ≈ 当前上下文大小 × Provider dispatch 次数
```

当单次 Prompt 已达到 15 万左右时，只需约 13～14 次正常模型请求就会接近 200 万。该
指标优先惩罚的是“上下文已经较长”，而不是“任务是否陷入循环”。

2026-07-20 的原始事故中，2,000,000 阈值是为了给 semantic detector 漏报提供额外止损；
但当前实现已经同时拥有：

- `variant_no_progress` 参数族 detector；
- exact repeat、known poll、ping-pong 等上游 detector；
- 64 次 raw tool reservation 硬边界；
- 32 次 Provider dispatch 硬边界；
- critical 后的唯一终止闭环。

继续把完整 Prompt 的单调累计值作为默认硬停止条件，会在已知循环保护之外制造独立的正常
任务误伤。

### 1.3 为什么不能只把 2M 调大

把阈值改成 20M、200M 或按模型 context window 成比例扩大，只能延后误伤，不能修复指标
语义：

1. 同一个正常任务仍会因为上下文较长而更早停止；
2. 不同 Provider 的 tokenizer、媒体估算、缓存和 fallback payload 不同，统一阈值无法
   稳定代表成本；
3. raw Prompt exposure 不等于 Provider 实际 input usage，更不等于积分；
4. 上下文缓存可能降低部分重复前缀的实际计费，但缓存命中、倍率和失效策略因 Provider
   而异；
5. 真正需要硬边界的无人干预执行已经由 64 次 raw tool 和 32 次 Provider dispatch 约束。

Prompt exposure 仍然是有价值的诊断指标，但不应在当前证据下继续作为通用聊天任务的默认
硬停止条件。

### 1.4 为什么不能按“任意进度”直接清零

一个直观方案是：工具返回新结果或 assistant 输出可见文本时，把 2M 计数清零。该方案能
放过本次现场，但不能建立可靠的通用安全语义：

- 时间戳、PID、随机 ID、滚动日志、进度条和 cursor 都会制造新的 `resultHash`；
- 模型每轮输出“仍在处理”之类文本即可持续清零；
- 工具返回 `success` 只代表调用成功，不代表用户目标推进；
- argument novelty 和 result novelty 只能清除某个具体 detector 的模式证据，不能证明整个
  任务取得进展；
- parent、recovery 和 subagent 共享 root `budgetScopeId`，任一 child 清零全局计数会替
  parent 或 sibling 续期；
- 如果改成每个 run 独立 2M，又会丢失 root aggregate 语义，并被 subagent 数量放大。

因此本文不重置总 Prompt exposure，也不在 P0 建立模糊的全局 progress oracle。

### 1.5 上游方向核对

截至 2026-07-28：

| 上游工作 | 状态 | 已验证语义 | 本文结论 |
| --- | --- | --- | --- |
| [`#112620`](https://github.com/openclaw/openclaw/pull/112620) stable tool argument churn | 已合并，并进入 [`v2026.7.2-beta.5`](https://github.com/openclaw/openclaw/releases/tag/v2026.7.2-beta.5) | 至少两个参数变体各重复三次且共享稳定 `resultHash` 后产生 warning-only churn 信号；独立 semantic liveness clock 负责 stale recovery | 证明“停滞应由语义证据处理”的方向，但 distinct result 或 later model output 只是该 detector 的证据清除条件，不是全局任务进展证明 |
| [`#97485`](https://github.com/openclaw/openclaw/pull/97485) `maxToolCallingRounds` | Open | 当前 head 默认关闭，按工具调用轮次计数；一次响应的多个并行工具只算一轮；耗尽后强制再做一次 text-only summary | 只能作为未来的 tool-round 补充上限，不能替代 64 raw tool 或 32 Provider dispatch |
| [`#114598`](https://github.com/openclaw/openclaw/pull/114598) sliding run deadline | Open | activity 可滑动 timeout，但最多扩展 10 次、总时长硬上限 120 秒 | 可参考“活动窗口仍需绝对上限”的设计思想，但它是 wall-clock timeout，不是 Prompt 或账单预算 |
| [`#110633`](https://github.com/openclaw/openclaw/pull/110633) critical 后终止 Run | Open | 目标是让 critical detector 真正终止 Run，当前仍有兼容语义和 exact-head proof 待决 | 合并并进入目标 stable tag 后可接管部分 terminal owner，当前不能假设已交付 |

上游没有累计 Prompt hard cap 只能作为方向信号，不能单独证明任何本地安全策略错误。本文的
修改依据是本次现场误停、当前 controller 语义和已有绝对次数边界的共同证据。

### 1.6 旧契约与新契约

| 维度 | 2026-07-22 契约 | 本文契约 |
| --- | --- | --- |
| raw tool reservation | root scope 最多 64 次，硬停止 | 不变 |
| Provider dispatch | root scope 最多 32 次，pre-transport 硬停止 | 不变 |
| legacy Prompt estimate units | 超过 2,000,000 时硬停止 | 单调遥测，不参与停止 |
| Prompt estimator 不可用 | `run_prompt_estimate_unavailable` 硬停止 | 记录 unavailable telemetry，若 32 次预算仍有槽则允许 transport |
| Prompt 75% warning | `prompt_exposure` warning dimension | 从 safety warning 中移除；2M 只产生一次内部 diagnostic event |
| semantic detector | critical 后终止 | 不变 |
| Run scope | 新外部指令创建；retry、fallback、compaction、recovery、subagent 继承 | 不变 |
| legacy Prompt terminal | 新旧 runtime 均可能发出 | 新 runtime 不再发出；LobsterAI 继续解析和展示旧事件 |
| 进度感知 exposure | 无 | P1 只做 shadow telemetry，不终止、不刷新绝对预算 |

### 1.7 修复目标

1. 正常长上下文任务即使累计 legacy Prompt exposure units 超过 2,000,000，只要未达到其它
   硬边界，仍可继续执行。
2. 保留 64 次 raw tool 和 32 次 Provider dispatch 的 root-scope 原子硬边界。
3. 保留 semantic loop detector 和唯一安全终止闭环，原始无进展事故仍能提前停止。
4. Prompt exposure 继续单调记录，明确区分已知 estimate、不可估算 dispatch 和实际 usage。
5. Prompt estimator 失败不再伪装成任务安全终止。
6. 新 runtime 不再产生 Prompt exposure 两种 terminal kind，同时兼容历史持久化消息和旧
   runtime 事件。
7. P1 可另行建立可审计的 lane-level shadow state-change 数据，为后续是否引入停滞
   exposure guard 提供证据；P1 不属于本文 P0 完成条件。
8. OpenClaw patch、managed config、patch manifest 和 bundled runtime 以原子方式升级，不能
   只改 LobsterAI config。

### 1.8 非目标

- 不把 64 次 raw tool 改成 100 次；阈值调整需要独立产品证据。
- 不取消 32 次 Provider dispatch 硬边界。
- 不把 Prompt exposure 换算成精确积分、金额或账单。
- 不假设 context cache 必然命中、免费或跨 Provider 等价。
- 不把任意 assistant 文本、成功工具结果、新参数或新 `resultHash` 定义为 confirmed
  progress。
- 不允许 subagent、retry、fallback、compaction 或 recovery 重置 root 的 64/32 计数。
- 不在 P0 新增长任务模式、用户自定义预算或模型可修改阈值。
- 不在本次升级 LobsterAI 固定的 OpenClaw tag；上游升级是后续独立发布工作。
- 不删除原始 transcript，不改写历史 Run 的终止原因。
- 不在 P1 shadow 数据完成评估前启用 `noProgressLegacyExposureUnits` 硬停止。

## 2. 用户场景

### 场景 1：正常长上下文任务累计超过 2M

**Given** 单次最终 Prompt estimate 约 15 万<br>
**And** fixture 连续构造 20 个不同的最终 Provider payload 与不同工具结果<br>
**And** raw tool 少于 64、Provider dispatch 少于 32<br>
**When** legacy Prompt exposure estimate 总和超过 2,000,000<br>
**Then** Run 继续执行<br>
**And** 不产生 `run_prompt_exposure_budget`<br>
**And** 不关闭 continuation<br>
**And** 记录一次内部 Prompt exposure threshold diagnostic

### 场景 2：原始稳定结果参数循环

**Given** Agent 依次执行同一 allowlisted 只读命令族<br>
**And** `N=80/100/120` 得到相同 canonical `resultHash`<br>
**When** 第三个参数变体完成<br>
**Then** `variant_no_progress` 仍进入 critical<br>
**And** Run 通过唯一 terminal owner 结束<br>
**And** `N=150` 不执行<br>
**And** 不依赖 Prompt exposure hard stop

### 场景 3：达到 Provider dispatch 硬边界

**Given** 同一 root `budgetScopeId` 已完成 32 次 Provider reservation<br>
**When** retry、fallback、compaction、subagent 或主 Run 尝试第 33 次 dispatch<br>
**Then** 在 provider adapter、transport 或本地 inference 前拒绝<br>
**And** 产生 `run_provider_dispatch_budget`<br>
**And** Prompt telemetry 不得改变该决定

### 场景 4：达到 raw tool 硬边界

**Given** 同一 root `budgetScopeId` 已 reservation 63 个 raw tool call<br>
**When** 下一批同时包含第 64、65、66 个 raw call<br>
**Then** 第 64 个获得 ticket，并立即产生 `run_tool_budget`、使 scope 进入 draining<br>
**And** 第 65、66 个在工具 lookup、schema validation、hook 和副作用前拒绝<br>
**And** 单轮并行工具仍逐项占用 raw tool 槽位

### 场景 5：Prompt estimator 不可用

**Given** 最终 payload 含无法可靠估算的媒体或 estimator 抛错<br>
**And** Provider dispatch 预算仍有可用槽位<br>
**When** host 到达 pre-transport seam<br>
**Then** 当前 dispatch 仍计入 32 次硬预算<br>
**And** telemetry 记录一次 unavailable estimate<br>
**And** transport 可以执行<br>
**And** 不产生 `run_prompt_estimate_unavailable`

### 场景 6：内部自动路径不能获得新预算

**Given** 当前外部任务仍处于 active scope<br>
**When** runtime 发生 retry、profile rotation、fallback、compaction、summary、recovery 或
subagent 调用<br>
**Then** 使用原 `rootInvocationId + budgetScopeId`<br>
**And** 继续扣减 root 32 次 Provider 与 64 次 raw tool 预算<br>
**And** 不因 runId、attemptId 或 provider/model 变化获得新预算

### 场景 7：用户发出新的明确指令

**Given** 上一个 scope 已正常结束或安全停止<br>
**When** 用户提交一条新的非空外部指令<br>
**Then** 创建新的 `rootInvocationId + budgetScopeId`<br>
**And** 获得新的 64/32 预算<br>
**And** 保留原会话历史和 Prompt telemetry 供审计

若产品提供“继续处理”按钮，该按钮不能静默重放旧任务或由系统自动创建 scope。它只能聚焦
输入框或预填可编辑文本；用户显式提交后才创建新的外部任务。

### 场景 8：读取历史 Prompt terminal

**Given** SQLite、session JSONL 或旧 bundled runtime 中存在
`run_prompt_exposure_budget` 或 `run_prompt_estimate_unavailable`<br>
**When** LobsterAI 解析该历史事件<br>
**Then** 继续按 legacy safety terminal 展示和去重<br>
**And** 不把历史事件改写成其它原因<br>
**And** 新 bundled runtime 的正向路径不得再产生这两个 kind

### 场景 9：subagent 产生噪声结果

**Given** parent lane 无进展<br>
**And** child lane 返回包含时间戳、随机 ID 或滚动日志的新结果<br>
**When** P1 shadow progress collector 观察该结果<br>
**Then** 不刷新 parent 或 sibling lane<br>
**And** 不重置 root 的 64/32 预算<br>
**And** 普通 child success 不得记录为 host-verified state change

### 场景 10：host 可验证的状态变化

**Given** host 能证明一个新 artifact revision 已提交，或 trusted tool 返回带 before/after
版本和幂等 receipt 的状态迁移<br>
**When** P1 shadow collector 记录该事件<br>
**Then** 可以开启当前 `progressLaneId` 的新 shadow epoch<br>
**And** 仍不改变任何 hard gate<br>
**And** 该事件的来源、lane、epoch 和 receipt 类型可审计<br>
**And** `goalRelevance` 保持 `unknown`，不能称为 confirmed progress

## 3. 功能需求

### FR-1：managed Run Safety 改为两项硬预算加 Prompt 观测

新的 managed config 使用独立的 Prompt 观测结构，不能复用旧
`maxCumulativeEstimatedPromptTokensPerBudgetScope` 名称：

```ts
export const RunSafetyPromptExposureMode = {
  Observe: 'observe',
} as const;

export type RunSafetyPromptExposureMode =
  typeof RunSafetyPromptExposureMode[keyof typeof RunSafetyPromptExposureMode];

const MANAGED_RUN_SAFETY = {
  maxToolCallReservationsPerBudgetScope: 64,
  maxProviderDispatchesPerBudgetScope: 32,
  warningRatio: 0.75,
  promptExposure: {
    mode: RunSafetyPromptExposureMode.Observe,
    legacyDiagnosticThreshold: 2_000_000,
  },
} as const;
```

要求：

1. 从 LobsterAI managed config、OpenClaw config type 和 Zod schema 中删除
   `maxCumulativeEstimatedPromptTokensPerBudgetScope`。
2. 不把旧字段解释为 telemetry threshold。
3. `warningRatio` 只作用于 raw tool 和 Provider dispatch 两个硬预算。
4. `promptExposure.legacyDiagnosticThreshold` 只控制内部一次性 diagnostic，不产生 warning、
   continuation close 或 terminal。
5. `promptExposure.mode` 只能由 host-managed config 生成；Prompt、Agent、Skill、Provider
   响应和模型输出不能修改。
6. 新 runtime 必须显式支持该结构。只删除 config 字段但继续使用旧 runtime 默认 2M
   的组合不允许发布。

### FR-2：64 次 raw tool 硬边界保持不变

- 每个 root `budgetScopeId` 最多 reservation 64 个原始工具调用。
- batch 中每个 raw call 独立占槽，一次十个并行工具占十个槽。
- reservation 继续位于 lookup、validation、policy hook 和副作用之前。
- unknown、invalid、client-hosted 和 plugin tool 不能绕过 host 可观察的 reservation seam。
- 第 64 个 reservation 获得 ticket 后立即写入 `run_tool_budget` 并使 scope 进入 draining；
  该 ticket 已获准执行，但同 batch 的第 65 个及后续调用不得获得 reservation。
- 已经 reservation 并开始执行的 sibling 可以正常收尾；terminal 后未开始的调用不得执行。
- tool count 不因 Prompt threshold、Prompt estimator 状态或 P1 progress epoch 重置。

### FR-3：32 次 Provider dispatch 硬边界保持不变

- 每个 root `budgetScopeId` 最多 32 次实际可能到达模型 backend 的 dispatch。
- 第 33 次在远程 transport 或本地 inference 前拒绝。
- retry、auth/profile rotation 后的新请求、fallback、模型型 compaction/summary、recovery、
  subagent、AgentHarness turn 和 host 可观察的 CLI spawn 都重新占用 dispatch 槽。
- 失败、timeout、stream 中断、业务错误和用户取消不返还已 reservation 槽位。
- 同一个 `providerDispatchId` 重入只返回已有 accounting decision，不能重复计数；调用方不得
  把同一个 ID 用于第二次 transport，真正的新 retry/fallback 必须创建新 ID。
- 只剩一个槽位时，并发 root/child 最多一个 reservation 成功。
- 第 32 个响应如果是无工具最终文本，允许正常交付；如果包含 tool calls，continuation close
  在任何工具副作用前提升为 `run_provider_dispatch_budget` terminal。

### FR-4：Run scope 生命周期保持不变

Run 是由一条外部用户指令或一个独立 external trigger 发起的完整自动执行过程。

创建新 root scope 的入口：

- 上一 scope 已结束后的桌面端新用户消息；
- native IM 新入站消息；
- Cron 的一次独立 fire；
- 安全停止后用户显式提交的新指令。

继承当前 scope 的路径：

- active Run 中的 steering/follow-up；
- retry、fallback、profile rotation；
- compaction、summary、automatic recovery；
- parent 创建的 subagent；
- native IM background continuation；
- 同一外部任务的其它 attempt。

内部路径即使创建新 runId，也不能生成新的 root 64/32 预算。缺少 scope identity 和
controller state 的现有 fail-closed 契约保持不变：

- `run_budget_identity_missing`；
- `run_safety_state_unavailable`。

### FR-5：拆分 Provider dispatch reservation 与 Prompt observation

当前 `reserveProviderDispatch({ estimatedPromptTokens })` 同时承担 hard gate 和 Prompt 累加。
P0 保持“先预占 Provider 次数，再进入 provider-controlled code”的现有计数语义，只把
Prompt hard gate 拆成一次性的 final-payload observation：

```ts
export const PromptObservationStatus = {
  Pending: 'pending',
  Known: 'known',
  Unavailable: 'unavailable',
} as const;

export type PromptObservationStatus =
  typeof PromptObservationStatus[keyof typeof PromptObservationStatus];

export const PromptEstimateSource = {
  StableTextTokens: 'stable_text_tokens',
  ContextWindowFloor: 'context_window_floor',
} as const;

export type PromptEstimateSource =
  typeof PromptEstimateSource[keyof typeof PromptEstimateSource];

export const PromptEstimateUnavailableReason = {
  SerializationFailed: 'serialization_failed',
  UnknownMediaWithoutContextWindow: 'unknown_media_without_context_window',
  EstimatorThrew: 'estimator_threw',
  InvalidEstimate: 'invalid_estimate',
  PayloadNotObservedBeforeCompletion: 'payload_not_observed_before_completion',
} as const;

export type PromptEstimateUnavailableReason =
  typeof PromptEstimateUnavailableReason[keyof typeof PromptEstimateUnavailableReason];

export type PromptObservationState =
  | { status: typeof PromptObservationStatus.Pending }
  | {
      status: typeof PromptObservationStatus.Known;
      legacyEstimatedExposureUnits: number;
      source: PromptEstimateSource;
    }
  | {
      status: typeof PromptObservationStatus.Unavailable;
      reason: PromptEstimateUnavailableReason;
    };

export type FinalPromptObservation = Exclude<
  PromptObservationState,
  { status: typeof PromptObservationStatus.Pending }
>;

declare function reserveProviderDispatch(params: {
  runId: string;
  providerDispatchId: string;
}): RunSafetyProviderReservationDecision;

declare function observeProviderPromptEstimate(params: {
  providerDispatchId: string;
  observation: FinalPromptObservation;
}): void;
```

执行顺序：

1. wrapper 为这次逻辑 dispatch 创建新的 `providerDispatchId`；
2. 在调用 provider-controlled code 前原子 reservation Provider dispatch count，并把该
   reservation 的 Prompt observation 初始化为 `pending`；
3. reservation 被拒绝时，不进入 provider adapter、payload prepare 或 transport；
4. reservation 成功后调用 V1 provider path，继续强制 `maxRetries=0`；
5. `onPayload` 先取得原 hook 可能替换后的 final payload，再估算并把 observation 原子终结为
   `known` 或 `unavailable`；两种状态都允许后续 transport；
6. provider 在 `onPayload` 前同步失败、取消或结束时，统一 settlement helper 把仍为
   `pending` 的 observation 终结为
   `unavailable(payload_not_observed_before_completion)`，随后 complete reservation；
   helper 同时挂到同步 `catch` 与 `stream.result()` 的 resolve/reject 路径。

约束：

- Prompt observation 不返回 `allowed: false`；
- known legacy estimate 规范化为正 safe integer 并使用 saturating add；
- 每个 dispatch 只有一次 immutable final observation，不再支持向上/向下 refinement；
- 相同 observation 的重复提交幂等；冲突的第二次提交只记录低基数 diagnostic，不覆盖首次
  状态、不重复累计；
- actual usage、cache read 和失败响应不返还 legacy total；
- 正常可控退出时，每个已 reservation dispatch 必须归类为 known 或 unavailable；
- 进程崩溃可能来不及执行 settlement helper，scope snapshot 必须单独记录
  `pendingObservationDispatchCount`，不能伪装成 known 或 unavailable；重启后的现有
  fail-closed recovery 契约保持不变；
- provider path 在 final payload 构建前失败仍消耗一次 dispatch 槽，这是对现有
  pre-provider reservation 语义的刻意保留；
- provider-controlled SDK 内部 retry 必须关闭或重新进入 host seam。

### FR-6：Prompt exposure 只保留单调 telemetry

每个 root scope 维护：

```ts
export type PromptExposureTelemetrySnapshot = {
  legacyEstimatedExposureUnitsTotal: number;
  knownEstimateDispatchCount: number;
  estimateUnavailableDispatchCount: number;
  pendingObservationDispatchCount: number;
  maxLegacyEstimatedExposureUnitsPerDispatch: number;
  estimateSourceCounts: Partial<Record<PromptEstimateSource, number>>;
  unavailableReasonCounts: Partial<Record<PromptEstimateUnavailableReason, number>>;
  legacyDiagnosticThresholdCrossed: boolean;
};
```

语义：

- `legacyEstimatedExposureUnitsTotal` 只包含成功取得 estimate 的 dispatch；
- 值从 0 开始，只能单调增加或 saturate 到 `Number.MAX_SAFE_INTEGER`；
- unavailable dispatch 不用 0 静默伪装成精确 estimate；
- 使用 model context window 保守兜底时必须显式标记
  `source=context_window_floor`，不能伪装成 `stable_text_tokens`；
- `knownEstimateDispatchCount + estimateUnavailableDispatchCount` 必须等于已经完成 Prompt
  observation 的 Provider reservation 数；
- 三种 observation 状态的 dispatch count 之和必须等于所有已允许 Provider reservation
  数；
- `pendingObservationDispatchCount` 正常收口时必须为 0，只用于表达进程崩溃等无法执行
  settlement hook 的不完整 snapshot；
- threshold crossing 后继续累计；
- telemetry 不参与 `tryTerminate()`、`continuationClosedReason`、fallback 选择或用户提示；
- scope end 记录结构化 summary；
- 若现有 provider result 已提供 actual usage、cache read/cache write 或账单字段，继续由原
  usage 通道记录；P0 不新增 usage 聚合 API，也不能从 raw estimate 中推导、扣除或改变
  safety decision。

`legacyEstimatedExposureUnits` 明确保留当前 estimator 的历史口径，用于衡量“旧 2M gate
本来会在何时触发”。当前实现不是 runtime tokenizer，也不是 UTF-8 byte count：
`stable_text_tokens` 对稳定序列化后的 final payload 使用 CJK-aware
`estimateStringChars + estimateTokensFromChars`，并叠加结构与媒体开销；
`context_window_floor` 在存在未知远程媒体时以 model context window 作为保守下限。因此：

- 该总量不得继续命名或展示为精确 token；
- 不同 `PromptEstimateSource` 的值不得用于 Provider 间成本比较；
- `legacyDiagnosticThreshold` 只是旧策略的反事实观测阈值；
- 若未来需要真实 token telemetry，应另加带明确 unit/model tokenizer version 的字段，
  不能静默改义 legacy 总量。

### FR-7：Prompt diagnostic 不属于 safety warning

Telemetry event 使用集中常量：

```ts
export const RunSafetyTelemetryEvent = {
  PromptExposureThresholdCrossed: 'run_prompt_exposure_threshold_crossed',
  PromptEstimateUnavailableObserved:
    'run_prompt_exposure_estimate_unavailable_observed',
  ScopeSummary: 'run_safety_scope_summary',
} as const;

export type RunSafetyTelemetryEvent =
  typeof RunSafetyTelemetryEvent[keyof typeof RunSafetyTelemetryEvent];
```

Prompt telemetry 达到 `legacyDiagnosticThreshold=2_000_000` 时：

- 每个 `budgetScopeId` 最多记录一次 `run_prompt_exposure_threshold_crossed`；
- 日志包含 root/scope/run identity、resolved provider/model、legacy total、已估算 dispatch 数、
  unavailable 数和最大单次 estimate；
- 不记录 Prompt 正文、工具参数、工具结果、文件内容、Token、API key 或用户标识；
- 不写入 `RunSafetyWarningDimension`；
- 不通过 renderer、IM 或系统通知打扰用户；
- 不生成 `run_prompt_exposure_budget`；
- 不触发 retry、fallback、compaction 或自动 summary。

Prompt estimator 首次不可用时可以记录一次
`run_prompt_exposure_estimate_unavailable_observed`，后续同 scope 只累计次数，避免热路径刷屏。

### FR-8：Prompt estimator 不可用不再 fail-closed

`run_prompt_estimate_unavailable` 从新 runtime 的 terminal producer 中移除。

以下行为保持 fail-closed：

- 缺少 `budgetScopeId`；
- controller 丢失；
- provider adapter 没有实现强制 V1 pre-transport seam；
- 第 33 次 Provider dispatch；
- 第 64 个 raw tool reservation 后关闭 scope，第 65 个及后续 reservation 拒绝；
- semantic detector critical。

以下行为改为 telemetry incomplete，但不阻断：

- final payload 稳定序列化失败；
- 存在未知远程媒体且 model context window 不可用；
- estimator 抛错、返回 `NaN`、`Infinity`、负数或溢出值。

Prompt estimate 的不确定性不能弱化 Provider dispatch count gate。

### FR-9：legacy Prompt terminal 只接收、不再产生

为兼容旧持久化数据和旧 runtime：

- LobsterAI `RunSafetyTerminationKind` 暂时保留
  `run_prompt_exposure_budget` 和 `run_prompt_estimate_unavailable`；
- OpenClaw patch 内的 `RunSafetyTerminationKind` 也暂时保留这两个 wire value，标记为
  receive-only；delivery/native compatibility code 可以继续引用；
- parser 继续验证并解析旧 payload；
- Adapter、terminal 去重、metadata 和中英文 i18n 继续支持旧 kind；
- 历史 system message 不迁移、不删除、不改写；
- 旧 terminal 收到后仍按一次安全终止处理。

新 bundled OpenClaw runtime：

- controller 不得再对 Prompt total 调用 `tryTerminate()`；
- 不得再把 Prompt threshold 写入 `continuationClosedReason`；
- 不得再 emit 上述两个 Prompt terminal kind；
- patch contract test 必须检查 `tryTerminate()`、`continuationClosedReason` 和 emit call
  site 中不存在这两个 kind；不能用全局搜索“字符串不存在”作为证明，因为 receive-only enum
  与 legacy parser 仍会合法包含这些字符串。

“保留 legacy wire kind”不等于“保留旧 managed config”。

### FR-10：唯一 terminal owner 与交付闭环不变

下列真实 hard terminal 继续进入同一个 root coordinator：

- `variant_no_progress` 和其它 critical semantic detector；
- `run_tool_budget`；
- `run_provider_dispatch_budget`；
- `run_budget_identity_missing`；
- `run_safety_state_unavailable`。

要求：

- root、child 或 recovery 并发命中时只发布一个 terminal reason；
- root 结束后后台 child 命中安全终态时仍能唤醒 coordinator；
- native delivery、Desktop system message 和 lifecycle 各最多一次；
- ended controller 的 late event 不能复活 Run；
- Prompt diagnostic 和 P1 shadow progress 不能进入 terminal owner。

### FR-11：产品提示与“继续”行为

P0 不新增 Prompt exposure 用户预警。

- 75% warning 只保留 48/64 raw tool 和 24/32 Provider dispatch 两个维度；
- Prompt telemetry 不显示为余额、积分、成本或“即将停止”倒计时；
- legacy Prompt terminal 文案保留，只用于历史和旧 runtime 兼容；
- 新的 tool/provider/semantic terminal 继续说明真实停止原因；
- 若增加“继续处理”入口，不能自动发送通用 continuation，也不能绕过用户提交创建 scope；
- UI 可以预填类似“继续处理 `<目标>` 的剩余步骤”的可编辑文本，用户提交后按普通外部指令
  创建新 scope。

### FR-12：P1 只观测 lane-level 状态变化，不阻塞 P0

P1 不是本文 P0 的交付项。实施 P1 前必须另立设计，明确 typed event seam、lane owner、内存
上界和数据保留期。本文只冻结以下方向，避免把“状态发生变化”误写成“用户目标取得进展”：

- P1 使用 `HostVerifiedStateChange`、`Candidate`、`Rejected` 等名称，不使用
  `ConfirmedProgress`；
- host 能证明 artifact revision 或持久状态版本发生变化时，
  `goalRelevance` 仍为 `unknown`；
- 只有绑定 immutable task/checkpoint ID、且由 host 验证接受的 typed checkpoint 才能进入
  “与目标绑定”的候选集合；模型自报文本不能创建 checkpoint；
- assistant 文本、thinking、tool start、普通 `success=true`、argument/resultHash novelty、
  时间戳、PID、随机 ID、cursor、retry、fallback、compaction 和 cache activity 都不能
  证明目标进展。

若 P1 后续实施，lane 与 observation 必须形成闭环：

1. root task 创建 root `progressLaneId`；每个 subagent 创建独立 child lane；
2. Provider reservation 需要不可变地保存 `runId + progressLaneId`，Prompt observation 只按
   reservation 中保存的 lane 归属累计，不能信任调用方临时传入另一个 lane；
3. retry、fallback、compaction 和 recovery 继承原 lane；
4. known observation 增加当前 lane 的 shadow exposure；unavailable 只增加不完整计数；
5. host-verified state change 可以结束当前 shadow epoch，但不能清零 root Prompt telemetry，
   也不能刷新 parent 或 sibling；
6. child completion receipt 最多向 parent 上报 candidate，不直接开启 parent 新 epoch；
7. lane 在 scope end 统一关闭；实现必须设置 active lane 数和 summary 大小的固定上界。

无论 P1 数据达到何值，都不得：

- 调用 `tryTerminate()` 或关闭 continuation；
- 产生用户 warning；
- 改变 raw tool / Provider reservation；
- 重置 root 64/32；
- 被远程配置切换为 enforce mode。

至少完成一个发布周期的真实遥测、事故回放和误判/逃逸评估后，若仍需 hard stagnation
guard，必须新建独立 spec 和发布门禁。

### FR-13：可观测性与隐私

每个 scope end 至少记录：

- `rootInvocationId`、`budgetScopeId`、最终 runId；
- 实际 resolved provider/model；
- tool reservation count；
- Provider dispatch count；
- Prompt telemetry snapshot；
- estimator unavailable reason 的低基数分类计数；
- semantic warning/terminal kind；
- 是否正常完成、用户取消或安全终止。

若 P1 已通过独立评审并启用 shadow collector，scope summary 可以额外记录有固定上界的 lane
epoch 与 evidence 类型计数；该字段不属于 P0 schema 的必需项。

不得记录：

- Prompt 正文；
- assistant 正文；
- 工具参数和结果；
- 文件内容和完整路径；
- API key、Token、Cookie；
- 高基数随机 error body。

日志中的 legacy exposure estimate、actual usage、cacheRead 和 cacheWrite 必须使用不同字段，不能把
其中任意一个展示成精确账单。

### FR-14：原子升级与 runtime capability 门禁

只修改 `openclawConfigSync.ts` 会留下严重版本错配：旧 `v2026.6.1` patch 在缺少
`maxCumulativeEstimatedPromptTokensPerBudgetScope` 时会回退默认 2M，误停仍然存在。

本文采用“build manifest + pre-spawn 校验”，不新增 Gateway RPC handshake：

1. `package.json#openclaw.runSafetyContract` 是 host 期望值，P0 固定为
   `count-hardcaps-prompt-observe-v1`；
2. `apply-openclaw-patches.cjs` 的 strong contract 验证 controller、schema、V1 seam、
   AgentHarness 和 legacy producer call site；
3. runtime build 只在上述验证和目标测试通过后，把同一 contract ID、OpenClaw version、
   commit 与 patch hash 写入现有 `runtime-build-info.json`；
   build cache 命中条件必须同时比较 version、patch hash 和 contract ID，旧 build info
   缺少 marker 时强制重建；
4. `OpenClawEngineManager` 在 Gateway spawn 和配置解析前读取 build info，精确比较
   contract ID 与 pinned version；缺失或不匹配时设置专用
   `RuntimeContractMismatch` 状态，不 spawn Gateway；
5. contract marker 不是行为证明本身；行为证明来自 clean-tag patch replay、contract tests
   和 fake-provider probe，marker 只防止运行时拿错已构建产物。

升级启动顺序固定为：

```text
停止旧 Gateway
  → 解析并验证新 runtime-build-info
  → ConfigSync 从当前应用状态重新生成完整 managed config
  → 以现有 temp + rename 方式原子替换 openclaw.json
  → 校验新 config 不含 legacy hard-limit 字段
  → spawn 已匹配的新 Gateway
  → /ready
```

fake-provider behavior probe 在 CI、runtime 构建验收和发布前 E2E 执行，不在普通用户每次
启动时调用。

用户磁盘上的旧 `openclaw.json` 初始可以含 legacy 字段；它不能先交给新 schema 解析。若
runtime marker 不匹配、config 生成失败或原子 rename 失败：

- 不启动新旧任一 Gateway；
- 原文件保持可恢复，不写半截配置；
- 开发环境提示运行 `npm run openclaw:runtime:host`；
- 正式包显示可重试的 runtime/config mismatch 状态，不静默回退旧 2M。

active controller 在创建时冻结完整 policy snapshot，包括 64/32、
`promptExposure.mode` 和 `legacyDiagnosticThreshold`。配置刷新只影响新 scope，不能让同一
scope 的反事实 diagnostic 口径漂移。

### FR-15：上游迁移门禁

升级 OpenClaw 前必须重新核对目标 stable tag，而不是只看 PR 状态：

- `#112620` 进入目标 stable 后，可接管低基数 argument churn warning 与 semantic stale
  clock；本地 allowlisted high-cardinality family detector 是否删除仍需现场 fixture 证明；
- `#110633` 合并并进入目标 tag 后，才评估接管 critical terminal owner；
- `#97485` 只可新增 tool-round 维度；当前 forced summary 语义不能替代 Provider gate；
- `#114598` 只影响 timeout，不替代 64/32 或 Prompt telemetry；
- 任一去补丁都必须验证零重复 terminal、零重复 delivery 和无后续 Provider dispatch。

## 4. 实现方案

### 4.1 OpenClaw core controller

在 `openclaw-varying-args-no-progress-core.patch` 中：

1. `RunSafetyBudgetDefaults` 删除累计 Prompt hard limit。
2. `RunSafetyBudgetLimits` 只保留 64、32 和 `warningRatio`。
3. 新增独立 `PromptExposureTelemetrySnapshot`。
4. `RunSafetyWarningDimension` 删除 `prompt_exposure`。
5. `reserveProviderDispatch()` 不再接收 Prompt hard-limit 参数，只原子处理 dispatch count。
6. `refineProviderPromptEstimate()` 改为不产生 decision 的
   `observeProviderPromptEstimate()`。
7. 删除两处 Prompt total 超限的 `tryTerminate()`。
8. 删除 Prompt threshold 对 `continuationClosedReason` 的赋值。
9. estimator unavailable 记录 telemetry，不创建 terminal。
10. scope end 输出完整 telemetry summary。
11. 保留 saturating add，并用 immutable observation finalization 避免 counter 溢出或重入
    重复累计。

核心伪代码：

```text
reserveProviderDispatch(id):
  if duplicate id:
    return existing decision
  if existing terminal or controller not active:
    reject
  if providerDispatchCount + 1 > 32:
    terminate(run_provider_dispatch_budget)
    reject
  providerDispatchCount += 1
  save reservation(observation = pending)
  record 75% provider warning if needed
  if providerDispatchCount == 32:
    close continuation with run_provider_dispatch_budget
  allow

observeProviderPromptEstimate(id, observation):
  if reservation missing:
    record low-cardinality invalid-observation diagnostic
    return
  if observation already finalized:
    return idempotently when equal; diagnose conflict when different
  if known:
    add normalized legacy estimate to legacy total
    update source count and max
    emit threshold diagnostic once if crossed
  else:
    increment unavailable count
    emit first-unavailable diagnostic once
  finalize observation
```

### 4.2 Provider pre-transport seam

`run-safety-gate.ts` 和所有 Provider V1 adapter 保持 host-owned seam：

```text
create providerDispatchId
  → reserve Provider dispatch count before provider-controlled code
  → provider locally prepares payload
  → onPayload obtains the final replaced payload
  → estimate/finalize observation
  → invoke transport
  → stream settlement hook finalizes any pending observation and completes reservation
```

要求：

- fallback 使用最终目标 Provider/Model 的 payload 重新 observation；
- retry 使用新的 `providerDispatchId`；
- prompt cache create/PATCH、preload 和隐藏 SDK retry 继续遵守现有 side-effect 收口；
- estimator 抛错只转成 unavailable observation；
- count reservation 被拒绝时 provider prepare、estimator 和 transport 都不执行；
- provider prepare、取消或同步错误发生在 `onPayload` 前时仍消耗已预占的 dispatch，并由
  settlement hook 将 observation 收口为 unavailable；
- `providerDispatchId` 只提供 accounting 幂等，不是 transport 去重 key；调用方每次真实
  transport 都必须使用新的 ID；
- AgentHarness、Codex/Copilot host path、plugin Provider 和本地模型保持一致。

### 4.3 LobsterAI managed config

`openclawConfigSync.ts`：

- 删除旧 `maxCumulativeEstimatedPromptTokensPerBudgetScope`；
- 写入 `promptExposure: { mode: 'observe', legacyDiagnosticThreshold: 2_000_000 }`；
- 保留 64、32 和 0.75；
- 配置刷新不能改变 active scope 已冻结的 64/32、Prompt mode 或 diagnostic threshold；
- sync 后验证生成配置不再含旧字段。

OpenClaw config type/Zod patch：

- 严格接受新的 `promptExposure` 结构；
- 拒绝未知 mode、非正 safe diagnostic threshold 和遗留 hard-limit 字段；
- 配置缺失时 bundled runtime 默认也必须是 observe-only，不能回退 2M hard stop。

### 4.4 shared wire 与 Adapter

`src/shared/cowork/runSafety.ts`：

- 保留两个 legacy Prompt terminal kind；
- 注释为 receive-only compatibility；
- 保持 parser 对旧字段的严格验证；
- 新增测试证明旧 payload 仍可解析。

`runSafetyTermination.ts`、main i18n 和 Adapter：

- 保留 legacy 文案与去重；
- 新 runtime 正向测试不得走这两个分支；
- Prompt diagnostic 不写 Cowork system message；
- 不向 renderer 增加 Prompt countdown。

### 4.5 patch manifest 与 runtime 检查

`scripts/apply-openclaw-patches.cjs` 和 patch contract tests：

- 删除“必须存在 2M hard gate”的断言；
- 增加“不得存在 Prompt total `tryTerminate()`”的负向断言；
- 增加 observe-only config schema、telemetry API 和 unavailable fail-open 的正向断言；
- core、AgentHarness、delivery 和 native receipt 仍按 required manifest 原子应用；
- clean `v2026.6.1` patch replay 后构建 runtime；
- build info 写入 `count-hardcaps-prompt-observe-v1` 与 patch hash；
- `OpenClawEngineManager` 在 spawn 前比较 app 期望与 build info；
- bundled runtime 通过 targeted call-site 检查和 fake-provider 行为检查。

### 4.6 P1 shadow collector（非 P0 交付项）

P1 实现前必须先列出现有 typed artifact/state receipt seam，并另立 spec 决定模块边界、
lane 存储上限、reservation-to-lane 绑定和 summary schema。若某类状态变化只能通过解析
assistant 文本或猜测工具结果获得，则不得把它记录为 host-verified state change。

### 4.7 上游 stable 升级

后续目标是 OpenClaw `v2026.7.2` stable 或更新 stable tag，但升级不是本文 P0 的前置条件。

升级步骤：

1. 核对目标 tag 是否包含 `#112620` merge commit；
2. 重新读取 `#97485`、`#110633`、`#114598` 的目标 head 与合并状态；
3. 从 clean tag 回放 LobsterAI patches；
4. 对冲突按能力矩阵决定去补丁，不手工修改 vendor 输出；
5. 回放本次正常长任务、原始稳定结果事故、并发 subagent 和 legacy terminal；
6. 确认只有一个 terminal owner 和一次用户交付；
7. 再更新 `package.json` pinned version。

## 5. 状态与边界处理

| 场景 | Provider dispatch | Prompt telemetry | terminal / UI |
| --- | --- | --- | --- |
| legacy total 从 1.9M 跨到 2.1M，dispatch count < 32 | 允许 | 单调增加，threshold diagnostic 一次 | 无 terminal、无 UI |
| 单次 Prompt estimate > 2M，但模型 precheck 允许 | 允许 | 记录该 estimate | 普通模型结果或普通 Provider error |
| estimate 为 `NaN` / 抛错 | 允许，仍占 dispatch 槽 | unavailable +1 | 无 Prompt terminal |
| provider 在 `onPayload` 前失败/取消 | 已预占并计数 | finally 记 unavailable | 普通 Provider error/cancel |
| fallback 到新 Provider | 新占一个 dispatch 槽 | 按最终新 payload 重估 | 受 32 次硬边界 |
| cache hit / cache miss | safety decision 相同 | raw estimate 与已有 usage 通道分开 | 不按 cache 返还 |
| 第 32 次返回最终文本 | 已允许 | 正常记录 | 正常完成 |
| 第 32 次返回 tool calls | response 已发生 | 正常记录 | 工具执行前提升 Provider budget terminal |
| 第 33 次 dispatch | transport 前拒绝 | 不新增已发送 payload estimate | `run_provider_dispatch_budget` |
| 第 64 个 raw tool | 获得 ticket | 不相关 | 写入 `run_tool_budget`，进入 draining |
| 第 65 个及后续 raw tool | reservation 前拒绝 | 不相关 | 复用既有 `run_tool_budget` |
| semantic detector critical | 不再继续 dispatch | scope summary 保留 | detector terminal |
| external 新用户指令 | 新 scope | 新 scope total 从 0 开始 | 新 64/32 |
| active steering / internal continue | 继承 scope | 继续原 total | 不重置 64/32 |
| child 有噪声结果 | 按 root 扣减 | root total 增加 | 不刷新 parent shadow lane |
| legacy Prompt terminal 入站 | 不继续旧 Run | 读取 legacy fields | 按历史原因展示一次 |
| controller ended 后 late event | 拒绝复活 | 可记录 dropped-late 诊断 | 不重复交付 |
| runtime/config capability 不匹配 | Gateway 不宣告 ready | 记录 mismatch | 提示重建/修复 runtime |

## 6. 涉及文件

### 6.1 P0 预计修改

| 文件 | 变化 |
| --- | --- |
| `package.json` | 声明 host 期望的 `openclaw.runSafetyContract` |
| `src/main/libs/openclawConfigSync.ts` | managed run-safety 改为 64/32 + Prompt observe |
| `src/main/libs/openclawConfigSync.runtime.test.ts` | 锁定新配置，证明旧 hard-limit 字段消失 |
| `src/main/main.ts` | 冻结“runtime 校验 → config 原子重写 → Gateway spawn”启动顺序 |
| `src/main/libs/openclawEngineManager.ts` | pre-spawn 读取 build info 并拒绝 contract mismatch |
| `src/main/libs/openclawEngineManager.test.ts` | runtime marker 缺失/错配/匹配回归 |
| `src/shared/openclawEngine/constants.ts` | 增加集中式 `RuntimeContractMismatch` error code |
| `src/main/i18n.ts` | 增加开发重建/正式修复所需的中英文错误文案 |
| `scripts/build-openclaw-runtime.sh` | 把 contract ID 与 patch hash 写入 runtime build info |
| `scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-core.patch` | controller、config schema、Provider seam、telemetry 与 tests |
| `scripts/patches/v2026.6.1/openclaw-z-agent-harness-run-safety.patch` | AgentHarness 使用 count reservation + Prompt observation |
| `scripts/apply-openclaw-patches.cjs` | required manifest 和行为符号检查 |
| `src/main/libs/openclawPatches/varyingArgsNoProgressCorePatch.test.ts` | 替换 2M hard-gate contract 断言 |
| `src/main/libs/openclawPatches/agentHarnessRunSafetyPatch.test.ts` | estimator unavailable 和 >2M fail-open contract |
| `src/shared/cowork/runSafety.ts` | 标记 legacy receive-only kind，保持 parser 兼容 |
| `src/shared/cowork/runSafety.test.ts` | 历史 Prompt terminal 解析回归 |
| `src/main/libs/agentEngine/runSafetyTermination.test.ts` | legacy 文案/metadata 回归 |
| `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` | 旧 terminal 可接收、新 runtime 不产生 |

### 6.2 P0 预计不改行为

| 文件 | 原因 |
| --- | --- |
| `scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-delivery.patch` | Prompt legacy terminal 仍可交付；新 runtime 不再生产 |
| `scripts/patches/v2026.6.1/openclaw-varying-args-no-progress-native-receipt.patch` | 同上，保留旧事件兼容 |
| `src/main/i18n.ts` | legacy Prompt 文案保留，不新增 Prompt warning |
| renderer Cowork 组件 | P0 不增加 Prompt countdown 或自动继续按钮 |

### 6.3 P1 可能新增

P1 的具体文件边界必须在确认 OpenClaw typed state-change seam 后由独立 spec 决定。若最终
需要修改 OpenClaw，仍以版本化 patch 交付，不直接修改 sibling checkout 或生成的
`vendor/openclaw-runtime` 源文件。

## 7. 发布与兼容策略

### 7.1 P0：停止正常长任务误伤

P0 必须一次性交付：

- 64/32 两项 hard gate；
- Prompt observe-only telemetry；
- estimator unavailable fail-open；
- legacy wire receive-only；
- core + AgentHarness patch；
- managed config；
- patch manifest；
- clean-tag replay、runtime build 和 Gateway restart。

P0 不等待上游 stable 升级，也不等待 P1 shadow collector。

### 7.2 P1：影子状态变化数据（不阻塞 P0）

P1 在 P0 稳定后灰度：

- 只采集低基数 lane/epoch/evidence 计数；
- 不展示用户 warning；
- 不影响 Run outcome；
- 对正常长任务、原始事故、timestamp/PID churn、assistant 状态话术和并发 subagent 回放；
- 至少观察一个发布周期；
- 分开输出 host-verified state change、goal-bound checkpoint candidate 和 rejected activity 的
  命中率、错误刷新率和漏报样本。

没有完成上述评估前，不得把 shadow counter 改成 hard gate。

### 7.3 P2：上游吸收

- 只升级 stable tag；
- `#112620` 可减少本地通用 churn patch 面；
- `#97485` 最多增加 tool-round 维度；
- `#110633` 合并后评估 terminal owner；
- 32 Provider dispatch 在上游没有等价 pre-transport aggregate gate 前继续保留；
- 64 raw tool 在上游 round budget 不能逐 call 约束时继续保留。

### 7.4 兼容与回滚

- 历史 Prompt terminal 继续可读；
- 旧 config 字段不迁移为新含义；
- 生成的 OpenClaw config 由 config sync 移除旧字段；
- runtime/config 不匹配时不静默运行；
- 回滚必须回滚完整 LobsterAI 包和 bundled runtime，不能只回滚 renderer/main；
- 若 P0 出现 telemetry 问题，可关闭 diagnostic 日志，但不能通过远程配置恢复旧 2M hard
  stop；
- 若未来确需重新引入 Prompt hard boundary，必须用新的字段、明确的产品模式和独立 spec。

## 8. 测试与验证计划

所有行为测试使用 fake/stub Provider、本地 fixture 和 transport spy，不调用真实计费模型，也
不需要账号凭据。

### 8.1 P0 Prompt 误停回归

1. fixture 生成连续 20 个不同 final payload 与不同工具结果，初始 estimate 约 150k，
   legacy total > 2M、dispatch < 32、raw tools < 64：Run 正常完成。
2. 回放 2026-07-27 三段现场：原先在第 16/15/14 个 reservation 被 Prompt gate 拒绝，
   修改后均不产生 Prompt terminal。
3. 单次 estimate > 2M 但 context precheck 为 `fits`：允许 transport。
4. legacy total 恰好等于、刚超过和远超过 2M：都只记录一次 diagnostic。
5. threshold crossing 后 `continuationClosedReason` 仍为空。
6. `getWarnings()` 只含 tool/provider 两个维度。
7. 新 runtime 的 termination producer 搜索不到 Prompt total `tryTerminate()`。

### 8.2 Provider reservation 与 telemetry

1. dispatch limit=2 时前两次成功，第三次 transport spy 保持 2。
2. controller 对相同 `providerDispatchId` 的重复 reservation 不重复 count；相同 observation
   幂等，冲突 observation 不覆盖首次状态。transport caller 的测试另行断言每次真实 retry
   都创建新 ID。
3. 每个 dispatch 只接受一次 immutable final-payload observation，不存在 refinement delta。
4. `onPayload` 后的 failure、timeout、cancel、business error 不返还 dispatch 或 legacy
   total；`onPayload` 前失败由 `finally` 记 unavailable。
5. estimator 抛错、未知远程媒体且无 context window、serialization failure：transport 仍
   执行，unavailable +1。
6. 正常完成/错误/取消路径最终为 known 或 unavailable，不留 pending；模拟进程崩溃的
   snapshot 用 `pendingObservationDispatchCount` 如实表达不完整。
7. concurrent requests 在 Prompt total 跨 2M 时均可继续；只剩一个 dispatch 槽时只有一个
   成功。
8. 在相同剩余硬预算的独立 scope 中，cache hit/miss 不影响 Prompt gate；同 scope 的真实
   retry 仍额外消耗 dispatch。
9. fallback 按最终新 payload observation；已有 actual cache usage 通道不写入 legacy
   total。
10. `stable_text_tokens` 保持当前 CJK-aware chars-to-token 算法；
    `context_window_floor` 保持显式 source，不改成 byte estimator。
11. saturating add 不溢出，不触发 terminal。

### 8.3 其它 hard gate 不回归

1. 已使用 63 槽时提交三项并行 batch：第 64 项获准并立即进入 draining，第 65/66 项在
   副作用前拒绝。
2. 第 33 次 Provider dispatch 在 transport 前拒绝。
3. retry、fallback、compaction、summary、recovery、subagent 和 AgentHarness 共享 root
   controller。
4. 两个 child 竞争最后一个 dispatch 槽时最多一个成功。
5. root 先结束、child 后命中 terminal 时只交付一次。
6. ended controller 的 late event 不复活。
7. `run_budget_identity_missing` 和 `run_safety_state_unavailable` 继续 fail-closed。
8. 未实现 Provider V1 seam 的 adapter 在插件或 transport 前拒绝。

### 8.4 semantic detector 事故回放

1. 原始 `N=80/100/120` stable-result fixture 仍在第三个结果后
   `variant_no_progress` critical。
2. `N=150` 不执行。
3. 41 个参数、`historySize=40` 的回放不依赖 exact args 重复。
4. 普通 15 参数批处理、不同 URL/path/query 和变化结果不误判。
5. 上游 `#112620` 与本地 detector/terminal owner 三种组合都只有一个 terminal。

### 8.5 legacy wire 与产品交付

1. `run_prompt_exposure_budget` 旧 payload 仍能解析、格式化、去重和交付一次。
2. `run_prompt_estimate_unavailable` 同上。
3. 新 runtime 正向执行永不 emit 两种 Prompt terminal。
4. Prompt threshold diagnostic 不写 Cowork message、IM reply 或 Desktop notification。
5. tool/provider/semantic terminal 的中英文文案不回归。
6. “继续处理”入口若实现，不自动调用 `chat.send`；只有用户提交才创建新 scope。

### 8.6 P1 shadow state-change 建议测试（不阻塞 P0）

1. assistant 每轮输出“仍在处理”后继续调用工具：不产生 host-verified state change。
2. result 每轮只变化时间戳、PID、随机 ID、cursor 或进度条：不产生 host-verified state
   change。
3. tool start、普通 `success=true`、retry、fallback、compaction 和 cache activity 不刷新
   epoch。
4. host-verified artifact revision 只刷新当前 lane 的 shadow epoch，且
   `goalRelevance=unknown`。
5. child 普通新结果不能刷新 parent/sibling。
6. child completion receipt 只上报 parent candidate。
7. root 64/32 始终不随 epoch 重置。
8. shadow counter 达到任意值都不产生 terminal 或用户 warning。

### 8.7 配置、patch 与 bundled runtime

1. generated config 含 64、32、0.75 和 Prompt observe 结构。
2. generated config 不含旧 `maxCumulativeEstimatedPromptTokensPerBudgetScope`。
3. clean `v2026.6.1` 完整 patch manifest 可应用。
4. core 与 AgentHarness 使用相同 Prompt observe 语义。
5. runtime build info 含匹配的 pinned version、patch hash 与
   `count-hardcaps-prompt-observe-v1`。
6. build cache 的 version + patch hash 相同但 contract ID 缺失/错配时仍强制重建。
7. marker 缺失或错配时 `OpenClawEngineManager` 在 spawn 前返回
   `RuntimeContractMismatch`。
8. fixture 从含 legacy 字段的旧 config 启动时，先原子重写新 config，再启动新 Gateway；
   新 schema 不会先解析旧文件。
9. config 生成/rename 失败时不 spawn Gateway，原文件可恢复。
10. targeted call-site probe 证明 Prompt hard producer 不存在、64/32 gate 存在。

建议验证命令：

```bash
npm test -- src/main/libs/openclawPatches/varyingArgsNoProgressCorePatch.test.ts
npm test -- src/main/libs/openclawPatches/agentHarnessRunSafetyPatch.test.ts
npm test -- src/main/libs/openclawConfigSync.runtime.test.ts
npm test -- src/main/libs/openclawEngineManager.test.ts
npm test -- src/shared/cowork/runSafety.test.ts
npm test -- src/main/libs/agentEngine/runSafetyTermination.test.ts
npm test -- src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts
npm run compile:electron
```

实现完成后还必须：

- 对所有 touched TypeScript 文件运行 changed-file ESLint；
- 运行官方 `npm test`；
- 从 clean pinned tag 回放 patches；
- 构建当前平台 OpenClaw runtime；
- 启动 Gateway；
- 用 fake Provider 完成三类现场 E2E；
- 发布前在 Windows 与至少一个 native IM 渠道验证真实 bundled runtime。

## 9. 验收标准

### 9.1 P0 行为验收

- [ ] 当前 checkout 的 hard budget 明确为 64 raw tool / 32 Provider dispatch，不写成
      100/32。
- [ ] 不同 final payload 的 deterministic fixture 在 legacy Prompt exposure total 超过 2M
      后继续执行。
- [ ] 新 runtime 不产生 `run_prompt_exposure_budget`。
- [ ] estimator 不可用时不产生 `run_prompt_estimate_unavailable`，但 dispatch 仍计入 32。
- [ ] legacy exposure total 单调记录；正常退出时 known/unavailable 状态完整，崩溃
      snapshot 可显式记录 pending。
- [ ] 2M threshold 只记录一次内部 diagnostic，不进入 warning、terminal 或 UI。
- [ ] 第 33 次 Provider dispatch 仍在 transport 前拒绝。
- [ ] 第 64 个 raw tool 获准后立即进入 draining，第 65 个及后续在副作用前拒绝。
- [ ] retry、fallback、compaction、recovery 和 subagent 不能重置 64/32。
- [ ] 新外部用户指令创建新 scope；系统内部自动 continue 不创建。

### 9.2 事故与 detector 验收

- [ ] 2026-07-27 三段正常 Run 回放不再因 2M 停止。
- [ ] 2026-07-20 stable-result 参数循环仍在第三个相同结果后停止。
- [ ] `N=150` 不执行，不重新出现 200+ 工具调用。

### 9.3 兼容与交付验收

- [ ] 两种 legacy Prompt terminal 仍可解析和展示一次。
- [ ] Prompt diagnostic 不产生用户可见安全消息。
- [ ] tool/provider/semantic terminal 的唯一 owner、一次 delivery 和 lifecycle 收口不回归。
- [ ] generated config 与 bundled runtime 使用同一 observe-only policy。
- [ ] runtime contract marker 在 Gateway spawn 前校验；旧 config 先原子重写再交给新 schema。
- [ ] clean-tag patch replay、runtime build、Gateway startup 和 fake-provider E2E 通过。
- [ ] 当前平台自动化通过；Windows 与 native IM E2E 在发布前补齐。

### 9.4 产品口径验收

- [ ] UI、日志说明和发布说明不把 raw Prompt estimate 描述为精确积分或账单。
- [ ] 不把 context cache 描述为必然命中或免费。
- [ ] 不展示 Prompt exposure 75% 倒计时。
- [ ] 如展示 hard budget 进度，只展示 raw tool / Provider dispatch 的真实计数。
- [ ] “继续处理”不能静默续命，必须由用户提交新的外部指令。
- [ ] 不宣称上游 iteration budget 已替代本地 64/32。

### 9.5 P1 后续验收方向（不阻塞 P0）

- [ ] 时间戳、PID、随机结果和 assistant 状态话术不会被记录为 host-verified state change。
- [ ] artifact/state receipt 即使由 host 验证，仍显式标记 `goalRelevance=unknown`。
- [ ] subagent 噪声不能刷新 root 或 sibling lane。
- [ ] reservation-to-lane 绑定、active lane 上限和 summary 大小上限由独立 spec 验证。
- [ ] 任意 shadow counter 都不影响 terminal、warning 或 64/32。

## 10. 风险与后续项

### 10.1 移除 2M hard stop 后的最坏暴露上界

Prompt total 不再硬停后，通用最坏 raw exposure 上界近似：

```text
32 × 单次 Provider-visible Prompt
```

对 1M context 模型理论上可接近 32M raw exposure。它不是精确账单，但说明 32 次 Provider
dispatch 是不可重置的关键硬帽。本文不能在取消 2M 的同时放宽或移除 32。

### 10.2 estimator fail-open 的观测不完整

Prompt estimator 不可用时允许 transport，会导致 raw exposure summary 不完整。必须通过
unavailable count、reason 分类和 Provider dispatch hard cap 明确表达，而不是写入 0
伪装完整。

### 10.3 context cache 误读

缓存可能降低重复前缀的实际 input 成本，也可能因 payload、Provider、TTL、fallback 或配置
变化失效。Prompt telemetry 与 cache usage 必须分栏；任何安全决定都不能依赖“预计会命中
缓存”。

### 10.4 progress oracle 误判与逃逸

即使 host 能确认 artifact 或状态变化，也不一定能证明它与用户目标相关。P1 只做 shadow，
未来启用 hard stagnation guard 前必须评估：

- 正常任务错误停滞率；
- 噪声结果错误刷新率；
- 模型刻意制造低价值 artifact 的逃逸率；
- parent/child lane 传播准确性；
- 不同 Provider 和工具类型的覆盖率。

### 10.5 runtime/config 版本错配

旧 runtime 在缺失旧字段时默认回退 2M。任何只更新 main/config、未更新 bundled runtime 的
产物都仍会误停。原子 patch、runtime rebuild、Gateway restart 和行为探针是发布硬门禁。

### 10.6 legacy kind 长期维护

两个 Prompt terminal kind 在新 runtime 中不再产生，但持久化消息和旧版本事件仍可能长期
存在。删除 wire kind 必须等到：

- 支持窗口内版本均不再产生；
- 数据迁移策略明确；
- 历史导入/导出兼容测试完成。

### 10.7 上游 PR 漂移

Open PR 的配置名、summary 行为、hard cap 和合并状态都可能变化。后续升级必须读取目标 tag
源码，不能引用本文快照直接删除本地保护。

### 10.8 服务器侧账单边界仍独立

客户端 64/32 只能限制可观察的自动运行，不是账号级积分上限。若产品需要精确金额保护，
仍需服务端按账号、runId/providerDispatchId、模型倍率和真实账本建立独立幂等与额度策略。
该工作不应复用 Prompt estimate 作为精确金额。

## 11. 与既有设计的关系

### 11.1 对 2026-07-22 文档的取代范围

本文取代：

- FR-12.1 中 2,000,000 Prompt hard limit 和 Prompt 75% warning；
- FR-12.3 中 Prompt exposure 作为统一 gate 的部分；
- FR-12.4 中 estimator 不可用 fail-closed、Prompt total 超限 reservation；
- FR-12.5 中两种 Prompt terminal 的新生产路径；
- 7.4 中“三项预算均作为用户可见硬边界”的表述；
- 8.5 中 Prompt exact-limit、超限阻断和 estimator fail-closed 测试；
- 9.1、9.4 中累计 Prompt 不超过阈值的验收；
- 10.3、10.4、10.7 中把 2M 作为合法长任务硬帽的风险处理。

本文不取代：

- FR-1～FR-11；
- 64 raw tool reservation；
- 32 Provider dispatch；
- `budgetScopeId` 生命周期；
- Provider V1 pre-transport seam；
- semantic detector 和 critical termination；
- history sanitizer；
- native stop 与 terminal delivery；
- 上游 capability detection 和去补丁门禁。

旧文档保留为历史设计，不回写状态或删除原始决策。

### 11.2 相邻本地设计

- `openclaw-critical-tool-loop-termination`：继续负责 detector critical 后终止 Run。
- `openclaw-aborted-tool-loop-token-burn`：继续负责 aborted outcome 循环。
- `openclaw-oversized-transcript-oom`：处理 transcript 物理体积和 Gateway OOM，不由本文的
  Prompt telemetry 替代。
- `cowork-context-compaction`：处理模型上下文收缩与质量，不以成本名义强制在 2M 时触发。

### 11.3 上游能力

- `#112620`：通用低基数 argument churn 与 semantic liveness 信号。
- `#97485`：可选 tool-calling round hard limit；当前不能替代 raw tool/provider dispatch。
- `#114598`：有绝对帽的 sliding timeout；只作为进度窗口设计参考。
- `#110633`：未来可能接管 critical terminal owner。

本文的长期方向是减少 LobsterAI 自维护 patch，但任何上游吸收都必须以目标 stable tag 的
源码、clean-tag 回放和现场行为测试为准。
