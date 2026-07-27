# Windows 安装目录未归属内容保护设计文档

| 字段 | 值 |
|---|---|
| 状态 | Reviewed，P0.5/P1 边界已冻结；止损切片与 packaged-tree evidence 基础已实现，destructive content guard 尚未启用 |
| Owner | Windows Installer DRI（待指定） |
| 评审基线 | 2026.7.17、2026.7.23 与首个修复版候选产物 |
| 最后更新 | 2026-07-25 |
| 发布门禁 | content guard 只有在 P0.5 Must 项全部通过后，才可为其接管的 destructive mutation 签发放行结果 |

## 0. 评审收口与不可弱化边界

本节记录 2026-07-25 多轮代码级评审后的最终共识。后续实现若与本节冲突，
必须先更新本 spec 并重新完成 Windows Installer 安全评审，不能以兼容
fallback、best-effort cleanup 或用户确认绕过。

### 0.1 P0.5 与 P1 分期

P0.5 只做保守门禁和既有 mutation 面收窄：

1. 支持矩阵内的 source version 才能使用受信 historical inventory；
2. unknown、foreign、`inventory-unavailable` 和 `scan-incomplete` 在
   mutation 前稳定中止，不提供“忽略并继续”；
3. P0.5 不执行旧安装树中的卸载器或其他代码；
4. 现有 `.old` 和 `.failed` 异步递归清理全部移除。P0.5 可继承
   covered-version 的既有 stage/rollback rename，但所有隔离树均保留，
   不做自动 deferred cleanup；
5. P0.5 不新增 unknown whole-tree quarantine。用户确认不能替代对象身份；
   `rename-preserve-only`、consent receipt、write-ahead journal、逐级
   no-follow 祖先验证和 handle-bound rename 整组能力进入 P1；
6. `/S` 保持零 UI 和稳定非零退出码；`--updated` 是 progress-visible
   assisted mode，禁止流程中段门控弹窗，但 guard 阻断必须进入 installer
   自身的终态结果页，不能依赖被恢复的旧应用理解新 attempt schema。

P1 才引入签名 helper、ownership manifest、精确卸载、foreign recovery、
opaque whole-root quarantine、跨权限 consent/policy receipt 和对象身份
绑定。任何 P1 能力都不能被拆成“不安全的半套”下放给 P0.5。

### 0.2 信任链

注册表、旧安装树和用户可写目录只提供候选发现信息，不提供授权：

- HKCU/HKLM 的 `InstallLocation`、`UninstallString` 和 `DisplayVersion`
  都不能单独授权提权执行、删除或 inventory 选择；
- source version、architecture、scope 和 inventory key 必须来自同一条
  已鉴真的 candidate/install footprint 信任链；
- P0.5 不执行旧树代码。P1 如确需执行旧卸载器，必须验证版本绑定的
  digest/build identity、预期 publisher/product，并在受保护 staging 中
  防止验证后替换；“任意有效 Authenticode 签名”不足以授权执行；
- `deletionOwnership` 与 `executionTrust` 分开计算。可被替换或删除不代表
  可被提权执行；执行身份失败返回 `legacy-uninstaller-untrusted`。

当前安装器使用 manifest 级 `RequestExecutionLevel admin`。因此
current-user scope 不等于非提权；权限模型必须正交描述
`scope × registry root × integrity × token SID`。HKCU 只能用于 discovery，
在 elevated context 中不得成为 capability 来源。

### 0.3 已知阶段性风险

P0.5 对 covered-version 保留现有路径型 `MoveFileW` stage/rollback，是
“不扩大既有 mutation 面”的阶段性兼容选择，不是 TOCTOU 已关闭的声明。
权限模型 ADR 必须对“高完整性进程 + 用户可写祖先链”给出规范性门禁；
否则该根不得进入 stage rename。

可选的 rename 后 identity 检查只能用于检测和恢复：

- destination root identity、parent identity 和授权 snapshot 均匹配，且
  original path 仍为空时，才可尝试回滚同一对象并再次复验；
- identity 缺失或不匹配时，不得回移、删除、继续安装或提交；必须进入
  `recovery-required` 并保留所有观测到的位置；
- detect-and-undo 是 mutation 后的补偿恢复，不能追溯把本次 attempt 记为
  `FailedBeforeMutation`，也不能让本次 attempt 继续。

final component junction 的移动行为只能作为真机观察记录，不能作为安全
论证；ancestor/root reparse 与路径替换风险仍受上述门禁约束。

### 0.4 当前实施快照（2026-07-25）

当前工作树已经完成不依赖权限 ADR 的止损切片：

- 候选安装器不再执行旧 `UninstallString`、copy-out 卸载器或 in-place
  旧树 EXE；版本固定的 app-builder-lib 模板在存在产品自定义 hook 时连
  stock legacy-uninstaller 函数也不编入；
- commit/rollback 后不再派发对 `.old`、`.failed` 的异步路径型递归删除，
  隔离树保留并写明 `cleanup_mode=disabled-p0.5`；
- assisted guard failure 已有 installer-native 终态页，`/S` 跳过页面并
  保留 typed non-zero exit；旧应用 relaunch 只有在未来取得独立
  `trusted-inventory-hash` execution trust 后才可能执行；
- 已新增 deterministic packaged-tree evidence 生成/校验工具及静态单测。

这些改动只收窄既有危险面，不等于 content guard 已完成。当前没有可信
runtime selector、安装树扫描器、lifecycle ownership rules、
`customRemoveFiles` 卸载门禁、admin-only durable journal 或权限 ADR
结论，因此本 spec 的 P0.5 Must 仍全部保持未勾选，destructive
authorization 也不得启用。

## 1. 概述

### 1.1 问题

有用户会在 LobsterAI 安装目录下创建自己的文件夹，例如：

```text
C:\Program Files\LobsterAI\MyData\
```

现有 Windows 更新路径可能先把整个旧安装树重命名为备份目录，再在安装
成功后递归删除该旧树；普通覆盖安装和卸载也可能执行递归目录清理。由于
安装器目前没有可靠的 payload ownership manifest，用户创建的目录会被
当作旧应用文件一起删除。

这不是 2026.7.23 安装失败的直接根因。安装失败属于安装器启动和旧数据
保护流程的可靠性问题；本问题属于文件归属、危险删除和恢复策略问题。
两者共用 NSIS 安装路径，但验收边界不同，因此单独设计、单独测试。

关联文档：

- [Windows 安装与更新可靠性修复设计](../windows-install-update-reliability/2026-07-24-windows-install-update-reliability-fix-design.md)

### 1.2 产品策略结论

安装目录仍定义为“应用管理目录”，不是受支持的用户数据目录。用户可管理、
不可替代的数据应放在 Documents、用户选择的工作目录或产品明确提供的
userData 目录；产品不承诺安装目录里的自建脚本、DLL 或资源在新版本中
继续可被应用加载。

但是，“不是受支持的数据目录”不等于“可以静默删除未知内容”。更新器和
卸载器只应删除能够证明由 LobsterAI 安装的内容。无法证明归属的文件或
文件夹必须原位保留、迁移到可恢复位置，或在任何破坏性操作前中止。

因此采用以下兼容策略：

1. 不鼓励用户继续把数据放进安装目录；
2. 不把未知内容自动复制回新安装目录；
3. 更新和卸载不得静默删除未知内容；
4. P0.5 先通过保守扫描和中止阻止继续丢数据；
5. P0.5 同时识别经过真实生命周期取证的精确可选生成路径，避免把
   LobsterAI 合法生成的安装树形态误判为 foreign；
6. P1 再通过 ownership manifest 和签名 helper 支持事务保护及精确卸载。

唯一的 P0.5 窄例外是既有 legacy Skills 迁移：只有精确位于已验证旧 source
的 `resources\SKILLs\<skillName>`、无 reparse point 且由可靠性 spec 的
legacy inspector 完整复制/校验并出具 receipt 的候选目录，才可从“待保护”
升级为 `foreign-content-protected`。这不是通用 unknown 内容自动迁移能力。

### 1.3 目标

1. 更新、覆盖安装和卸载前识别安装树内的未归属内容。
2. 扫描失败或发现未保护内容时，在 mutation 前 fail closed。
3. 不跟随 reparse point，不遍历或删除安装树外部目标。
4. P0.5 不依赖运行时猜测，使用经过真实产物核验的递归 historical owned
   inventory 和经过代码审计、真实生命周期取证的精确生成规则。
5. P1 使用构建期 ownership manifest 精确区分 app-owned 与 foreign。
6. P1 可把 foreign content 事务化保护到安装树之外的恢复区。
7. 静默更新和卸载具有稳定、无弹窗的状态与退出码。
8. 所有保护结果可由安装日志和应用日志导出。
9. 应用生成但承载用户配置、凭据或不可替代状态的内容不可因“应用生成”
   而被当成可重建 payload 删除。

### 1.4 非目标

- 不把安装目录改造成正式用户数据目录。
- 不保证未知 DLL、脚本或插件在新版本中继续生效。
- P0.5 不自动移动、合并或恢复未知内容。
- legacy Skills 的窄保护接口由关联可靠性 spec 定义，不扩展到安装树其他
  unknown/foreign 内容。
- 不把“删除全部用户数据”自动解释为删除安装目录中的未知内容。
- 不在本 spec 中解决安装包 Authenticode 鉴真或 Defender 排除策略。

## 2. 术语与归属

### 2.1 内容类别

```text
packaged
installer-generated
app-generated
app-generated-user-state
foreign
unknown
scan-incomplete
```

- `packaged`：可以由受信任 manifest 或版本绑定 historical inventory
  证明属于 LobsterAI payload、卸载器或静态安装元数据。
- `installer-generated`：不一定存在于构建产物中，但可以由受信安装器的
  精确写入路径、格式和版本规则证明属于安装器生命周期，例如安装/恢复
  marker。
- `app-generated`：由 LobsterAI 在首次启动、恢复或模式切换期间生成，
  可以安全重建且不承载用户状态的内容。可执行内容必须命中受信输出摘要
  集，不能只凭路径归属。
- `app-generated-user-state`：虽然由应用写入，但可能承载用户配置、账号、
  凭据或不可替代状态的内容，例如出现在 bundled Skill 目录内的 `.env`
  或 `accounts.json`。该类在删除授权上等同于待保护 foreign，不得因 writer
  是 LobsterAI 而自动删除。
- `foreign`：已确认不属于 app-owned 的用户或第三方内容。
- `unknown`：存在内容，但当前证据不足以确认归属。
- `scan-incomplete`：ACL、锁、I/O、路径长度、reparse point 或其他错误
  导致扫描不能完整结束。

只有通过对应生命周期规则验证的 `packaged`、`installer-generated` 和
`app-generated` 构成可替换的 `app-owned` 集合。`app-generated-user-state`、
`unknown` 和 `scan-incomplete` 的安全处理等同于 foreign 未保护状态，
不得因为“看起来像应用文件”或“由应用写入”而删除。

每条 ownership 记录至少包含：

```text
relativePath
entryType
ownershipClass
presence             # required | optional
contentPolicy        # replaceable-by-path | immutable-hash | trusted-output-digest-set | exact-schema | preserve-only
writer               # package | installer | app-first-run | app-recovery | app-mode-switch
versionRange
architecture
scope
```

规则必须精确绑定相对路径、版本、架构、scope 和 writer。目录规则只有在
完整子树均可证明是可重建输出且不存在任何用户写入接口时才可使用。禁止
使用 `*.pyc`、`node_modules/**`、`.venv/**` 等宽泛 glob 放宽删除范围；
`.venv` 在完成写入路径和生命周期取证前保持 `unknown`。

`contentPolicy` 的 match/mismatch 语义必须显式：

| policy | match | mismatch |
|---|---|---|
| `replaceable-by-path` | 相对路径、entry type、版本和 scope 匹配即可授予 replacement/deletion ownership；不承诺保留原位字节修改 | 路径或 entry type 不匹配时为 foreign/unknown |
| `immutable-hash` | 命中唯一受信摘要后才属于对应 immutable entry | `content-integrity-mismatch`；不得删除或执行 |
| `trusted-output-digest-set` | 命中版本、模式和 writer 绑定的允许摘要集合后才属于 app-generated output | `content-integrity-mismatch`；路径本身不得授权删除或执行 |
| `exact-schema` | schema/version/size/字段约束全部通过后才属于 installer-generated entry | `content-integrity-mismatch`；不得按同名路径删除 |
| `preserve-only` | 始终进入保护或中止，不产生 deletion capability | 同左；永不降级为 app-owned |

`manifest-untrusted` 表示规则载体不可信。只有相对路径、entry type、
版本和 scope 已选择到一条可信 policy 记录，但该记录的 hash/digest set/
schema predicate 不通过时，才使用 `content-integrity-mismatch`。没有匹配
规则的额外路径仍是 `foreign`/`unknown`；不能把三类失败混成一个状态。

### 2.2 稳定门禁结果

内容保护模块必须只返回以下稳定结果：

```text
content-guard-empty-write-only-target
safe-to-replace
legacy-skill-protection-required
foreign-content-detected
foreign-content-protected
scan-incomplete
inventory-unavailable
manifest-untrusted
content-integrity-mismatch
```

root guard result 只描述该根的内容和 ownership 证据评估，不承载
`executionTrust`，也不能独立签发 mutation capability。旧卸载器的执行
身份属于独立状态域：

```text
legacy-uninstaller-execution-not-evaluated
legacy-uninstaller-execution-trusted
legacy-uninstaller-untrusted
```

P0.5 永远停留在 `legacy-uninstaller-execution-not-evaluated`，因为它不
执行旧树代码；P1 只有 `legacy-uninstaller-execution-trusted` 才能取得
执行 capability。root mutation 授权必须同时匹配稳定的
`plannedMutation`：

```text
write-only-empty-target
stage-whole-source-tree
restore-staged-source-tree
replace-whole-tree
delete-manifest-owned-set
quarantine-whole-opaque-source
```

授权矩阵：

| root status | P0.5 允许 | P1 允许 |
|---|---|---|
| `content-guard-empty-write-only-target` | `write-only-empty-target` | 同 P0.5 |
| `safe-to-replace` | `stage-whole-source-tree`、`replace-whole-tree`；不得因此自动取得 cleanup capability | 同 P0.5；精确删除仍需 delete-set authorization |
| `foreign-content-protected` | legacy protection receipt 仅可授权 `stage-whole-source-tree` 及满足新快照/identity 条件的 `restore-staged-source-tree`；永不授权 cleanup/delete | receipt 精确绑定的 mutation |
| `foreign-content-detected` | 无 destructive authorization | 仅可在独立授权下执行 `delete-manifest-owned-set` 或 `quarantine-whole-opaque-source` |
| `inventory-unavailable` | 无 destructive authorization | 只有可信 bootstrap、consent/policy receipt 与 handle-bound root identity 全部有效时，才可 `quarantine-whole-opaque-source`；不得执行、删除或按 inventory 授权 |
| 其他状态 | 无 destructive authorization | 无 destructive authorization |

`content-guard-empty-write-only-target` 不得用于非空 source、无法扫描的根
或任何 delete/rename 对象。`foreign-content-detected` 即使在 P1 获得
精确删除授权，也绝不能进入整树 rename 后自动清理、旧卸载器递归清理或
`RMDir /r`。

每份 mutation authorization 使用判别联合。公共字段至少包括：

```text
authorizationReceiptId
attemptId
rootId
snapshotId
plannedMutation
plannedMutationDigest
evidenceKind
evidenceRef
```

`evidenceKind/evidenceRef` 必须精确指向下列一种受信证据：

| plannedMutation | 条件字段 |
|---|---|
| `write-only-empty-target` | `emptyTargetProofId` |
| `stage-whole-source-tree` | `inventoryId` 或 `legacyProtectionReceiptId`；`rollbackPlanDigest` |
| `restore-staged-source-tree` | 原 stage receipt、post-stage snapshot、source/destination identity evidence 与原 `rollbackPlanDigest` |
| `replace-whole-tree` | `inventoryId` 或 `manifestId` |
| `delete-manifest-owned-set` | `manifestId` 与 `exactDeleteSetDigest` |
| `quarantine-whole-opaque-source` | P1 `consentOrPolicyReceiptId`、handle-bound `rootIdentityDigest` 与 `protectedSetDigest` |

不存在 manifest 的 P0.5 inventory/empty-target 操作不得伪造 `manifestId`；
非 delete-set mutation 不得伪造空 `exactDeleteSetDigest`。rollback 不能
复用已消费的 stage authorization，必须根据 stage 后的新快照和 identity
证据取得一次性 `restore-staged-source-tree` authorization。

授权一次性消费，不能跨 root、snapshot、attempt 或 mutation kind 复用。
目录只有在逐项删除后重新枚举确认为空且自身不是 reparse point 时才能删除。
`legacy-skill-protection-required` 是 preflight 中间状态，不允许任何
mutation；只有校验 protection receipt 并完成快照复验后才能升级为
`foreign-content-protected`。

不得跨领域复用裸 `not-applicable`。其他模块应分别使用有领域含义的值，
例如：

```text
legacy-source-not-present
registration-repair-not-required
phase-skipped
```

NSIS、status journal 和 TypeScript 类型必须使用领域常量；一个领域的
“无需动作”不能作为另一个领域的删除授权。

### 2.3 安全不变量

1. 所有可继续的动作遵循
   `Scan -> Stop -> Rescan/ProtectLegacySkillCandidates ->
   Final Revalidate -> Mutation`。
   早期扫描发现确定性 foreign/错误时可在 Stop 前中止；除此之外必须先
   停止所有可能写安装树的相关进程，再基于静止目录重扫、保护和最终复验。
   任一步发现条目、属性或 reparse 状态变化时重新扫描或 fail closed。
2. 扫描失败不得退化成“未发现 foreign content”。
3. reparse point 本身可记录，但不得跟随其目标。
4. 未知内容不得被 guard/helper 执行、注册或加载，也不得被主动新增为
   Defender exclusion；现有目录级 exclusion 的隐式覆盖风险由独立
   Defender hardening spec 处理。
5. 恢复区不得位于安装目录，也不得被本功能主动加入 Defender exclusion。
6. 保护副本未完成数量、大小和完整性校验前，不得删除原件。
7. 安装失败回滚时，原安装和 foreign content 至少保留一个完整来源。
8. 清单来源或签名不可信时，必须退回保守扫描，不得放宽删除范围。
9. 同名覆盖、路径穿越、junction/symlink 和大小写规范化冲突必须阻断。
10. 日志不得记录用户文件内容，只记录相对路径、计数、大小、状态和错误。
11. mutation 前必须确认恢复卷具有足够空间；复制期间的 ENOSPC、quota
    或短写必须失败并保留原件。
12. 当原件已因已提交的 mutation 不再存在时，恢复区副本成为唯一恢复
    来源，不得因年龄、容量配额或自动清理任务静默删除。
13. P0.5 的 `.old`、rollback `.failed` 和其他 attempt-scoped quarantine
    不得自动递归清理；清理失败不能通过下一次“按路径重试”绕过身份门禁。
14. 用户确认只授权展示并绑定的 mutation，不证明路径仍指向原对象，也不
    自动授权执行、删除、覆盖或扩大 delete set。

## 3. 场景与行为

### 3.1 行为矩阵

| 场景 | 内容状态 | P0.5 | P1 |
|---|---|---|---|
| 应用内更新 | `safe-to-replace` | 继续 | 继续 |
| 应用内更新 | 仅含已验证的 optional lifecycle entries | 继续 | 继续 |
| 应用内更新 | 只有合规 legacy Skill candidates | receipt 完整并复验后继续 | 同 P0.5 或统一 helper 保护 |
| 应用内更新 | `app-generated-user-state` | mutation 前中止 | consent/policy receipt 与 handle-bound 对象身份均有效，且保护校验成功后继续 |
| 应用内更新 | foreign/unknown | mutation 前中止 | consent/policy receipt 与 handle-bound 对象身份均有效，且保护校验成功后继续 |
| 手动覆盖安装 | `safe-to-replace` | 继续 | 继续 |
| 手动覆盖安装 | foreign/unknown | mutation 前提示并中止 | 经非提权 bootstrap 取得有效 receipt、绑定对象身份并保护成功后继续 |
| `/S` | foreign/unknown | 零 UI、稳定非零退出 | 仅有受信 managed-policy receipt 时自动保护，否则稳定中止 |
| `--updated`（无 `/S`） | foreign/unknown | 保留进度窗口、无流程中段门控弹窗，进入终态结果页并返回稳定非零 | 仅有显式策略时自动保护，否则进入终态结果页并稳定中止 |
| 修复版生成的普通卸载器 | `safe-to-replace` | `customRemoveFiles` 前置门禁通过后正常卸载 | 精确删除 app-owned |
| 修复版生成的普通卸载器 | foreign/unknown | mutation 前中止并提示迁出 | 只消费精确 delete-set authorization 删除 app-owned；foreign 留在原位或保护到恢复区 |
| 修复版之前已安装的旧卸载器 | 任意 | 无法回溯接管；只提供先做安装树外完整备份的版本边界警告 | 同 P0.5；旧入口不会因安装新包而自动变安全 |
| 扫描失败 | `scan-incomplete` | 中止，原文件不变 | 中止，原文件不变 |
| historical inventory 缺失/不可信 | `inventory-unavailable` | mutation 前中止 | 仅可走完整 P1 handle-bound opaque quarantine；能力不可用或任一证据失败则中止 |
| P1 manifest 不可信 | `manifest-untrusted` | 不适用 | 回退 historical inventory；仍不能证明则中止 |

“全新安装”不等于“用户选择的目标目录可以非空”。只有目标不存在或完成
扫描后确认为空，且 planned mutation 仅写入时，才可使用
`content-guard-empty-write-only-target`。非空 target 必须按 repair/
relocate 场景解析来源并扫描；无法证明归属时提示选择空目录或迁出内容，
不得把 nonempty target 当成 fresh install 绕过。

### 3.2 交互模式

P0.5 文案必须明确：

> 安装目录中发现非 LobsterAI 管理的文件。为避免删除你的文件，本次操作
> 尚未修改原目录。请先把这些文件移到其他位置，然后重试。

允许展示：

- 检测到的顶层相对路径；
- 条目数量和总大小；
- 推荐迁移目录；
- 打开安装目录和导出日志入口。

不得提供“忽略并删除”按钮。

所有结果页、阻断文案、按钮、恢复路径说明和人工补救警告必须同时提供
中文与英文 i18n；底层 `failureKind`、Win32 error 和内部路径只进入可展开
详情/日志，不能替代本地化主文案。

P1 可新增“保护文件并继续”，但必须在外部恢复区校验成功后才能执行替换。
P1 也不得把未知内容自动写回新 `$INSTDIR`；完成后只提供恢复目录入口。

P0.5 对未覆盖 source version 不提供原位 destructive fallback。支持原位
升级的每个版本必须进入显式 inventory 支持矩阵；其他版本只提供阻断和
非破坏性指引。side-by-side 安装涉及卸载注册键、APP_ID、协议、快捷方式
和自动更新归属，必须独立设计，不能在本 spec 中视为廉价默认出口。

用户可在完整导出并验证整个旧安装目录及 userData 后，自行通过 Windows
设置卸载旧版并运行已验证的新安装包。该路径调用旧版自带卸载器，只是
manual out-of-band remediation，不是修复版安装器的自动 fallback，也不
提供 unknown 内容保护保证。指引不能只要求“移动个人文件”：在 inventory
不可用时产品无法证明哪些嵌套内容属于用户，必须明确要求安装树外的完整
副本和验证。修复版不能回溯保护已经安装在用户机器上的旧卸载器。

P1 的 standalone 安装包也必须先进入非提权 bootstrap：由原始用户上下文
创建 attempt、采集 SID 并校验候选安装器身份，再通过受约束的
`ShellExecuteEx(runas)` 启动提权 worker。直接启动提权 worker、旧入口
无法关联原始 SID，或 UAC 改用另一管理员凭据且 handoff 校验失败时，只能
保守中止 foreign content 保护，不能降级为宽 ACL 或猜测用户。因此上表
“手动覆盖保护后继续”指通过该 bootstrap 的 P1 正式入口，不承诺任意直启
提权 worker 都可继续。

### 3.3 UI 与静默模式

`updatedFlag`、`uiMode` 与 prompt policy 正交：

```text
uiMode=wizard
uiMode=progress-visible
uiMode=silent

promptPolicy=interactive-decisions-allowed
promptPolicy=no-gating-prompts
promptPolicy=no-ui
```

`--updated` 本身不等于 `${Silent}`。应用内更新默认使用
`progress-visible + no-gating-prompts`：保留安装进度窗口，所有 stock/
custom 流程中段 `MessageBox` 必须被枚举并压制，但 guard 阻断后允许显示
installer-native 终态结果页。终态页不是继续 mutation 的授权提示，只能
展示第 3.2 节文案、打开安装目录/日志和关闭操作。

`/S` 使用 `silent + no-ui`，包括与 `--updated` 同时出现时也不得显示
MessageBox、结果页或其他窗口；无人值守卸载同样零 UI。

P0.5 guard failureKind：

```text
install-root-foreign-content-found
install-root-scan-incomplete
install-root-inventory-unavailable
install-root-content-integrity-mismatch
install-root-destructive-fallback-blocked
```

P0.5 遇到以上状态时：

1. mutation 尚未开始；
2. 返回稳定非零退出码；
3. 写 attempt 日志和 status；
4. 保留旧应用可运行；
5. 不自动重试确定性失败。

这里的 `status` 是提权 worker 写入 admin-only control journal 的控制面
状态，不是 `%APPDATA%`/`userData` 下的用户态 terminal attempt。P0.5
不能由 elevated NSIS 猜 original SID 或向当前解析到的 `%APPDATA%` 写
结果；over-the-shoulder UAC 时该路径属于管理员 profile，同账号 UAC 时
它又是 medium-integrity 可预写面。用户态 terminal attempt 只能由 P1
非提权 launcher 在校验 control result 后原子写入。

首个修复版被 guard 阻断时，恢复启动的 2026.7.17/2026.7.23 应用没有
新 attempt reader，因此 P0.5 主反馈必须由安装器终态页承担，不能只写
“FR-21 重启后由旧应用展示”。进入 P1 后，非提权 launcher 是唯一终态
writer 和 relaunch owner，顺序固定为：

```text
wait NSIS
  -> validate protected result
  -> atomically write user terminal attempt
  -> relaunch exactly once
```

trusted launcher handoff 存在时 NSIS 不得同时 relaunch。legacy/no-handoff
场景才允许 NSIS 使用可靠性 spec 的受控恢复启动。终态页、退出码、status
写入和 relaunch 的真机合同必须覆盖：旧应用至多启动一次，终态页不会经
既有 `Quit` 路径直接消失，旧应用拉起失败后下次手动启动仍可诊断。

P1 保护复制或验证失败使用独立 failureKind
`foreign-content-protection-failed`，它不是 content guard status。
空间和实际写入错误进一步使用：

```text
foreign-content-recovery-space-insufficient
foreign-content-recovery-write-failed
```

跨阶段还必须保留以下稳定映射，不能降级成通用
`custom-install-failed`：

```text
manifest-untrusted
  -> install-root-manifest-untrusted
legacy-uninstaller-untrusted
  -> install-root-legacy-uninstaller-untrusted
post-rename identity mismatch
  -> install-root-identity-mismatch-recovery-required
```

最后一种发生在 mutation 已开始之后，必须进入 `recovery-required`，
不得误报为 `FailedBeforeMutation`。

## 4. P0.5：保守内容门禁

本阶段依赖可靠性 spec 的“Windows 安装权限模型 ADR”。writer 审计、
historical inventory 取证、纯扫描/规划逻辑和测试样本可以提前并行；
但涉及 original SID、提权 bootstrap、ACL、admin-only control/recovery
journal、跨权限 recovery root 或 privileged mutation 的最终设计与实现，
必须等待 ADR 批准。ADR 未批准时不得用当前始终提权的行为反向固化安全
边界，也不得因此阻塞 P0-hotfix 独立发布。

P0.5 上线必须先经过 report-only 灰度：只执行扫描、记录判定和耗时，不
签发 destructive capability，也不修改安装目录。灰度按 source version、
scope、文件数和扫描耗时统计误报/漏报；启用 enforcement 时保留关闭自动
更新入口的 kill switch，但 kill switch 只能回退到阻断和人工安装指引，
不能关闭 guard 后继续 destructive mutation。

report-only 只能运行在明确不进入 mutation 的 dry-run/诊断入口或受控
cohort。禁止“shadow scan 得到阻断结果后，仍沿旧路径执行 rename、旧
卸载器或递归删除”；这种模式既不是 report-only，也不得用于灰度。

### 4.1 版本绑定 historical owned inventory

在没有历史 ownership manifest 的版本上，构建或发布流程为每个受支持的
升级来源维护经过真实安装产物与运行期生命周期核验的递归 owned
inventory，至少覆盖：

- 2026.7.17；
- 2026.7.23；
- 首个修复版。

inventory 必须：

1. 来源可追溯到对应已发布安装包；
2. 绑定版本、架构和安装范围；
3. 递归列出能够确定为 app-owned 的每个相对文件和目录及 entry type；
4. 缺失或版本不匹配时不得选用“最相近版本”；
5. 作为构建输入接受静态契约测试；
6. 编译或嵌入候选签名安装器/受信 guard 二进制，只能按精确的
   version + architecture + scope key 选择；
7. 不得从 `$INSTDIR`、恢复区或其他用户可写位置加载 loose inventory，
   也不得让命令行参数覆盖 inventory 路径。
8. 支持精确的 `presence=optional` lifecycle entry；“构建产物中不存在”
   不得被错误解释为运行期一定是 foreign；
9. 每条 required/optional entry 都必须携带 `ownershipClass`、
   `contentPolicy`、`writer`、`versionRange` 和 scope，不能只登记一个
   白名单路径；
10. app-generated 可执行文件必须命中与版本/模式绑定的
    `trusted-output-digest-set` 或等价的确定性生成证明，路径命中本身
    不授权删除；
11. `preserve-only` 条目永远不能使根变成 `safe-to-replace`，必须进入
    保护或中止路径。

当前已落地的
[`scripts/windows-install-inventory.cjs`](../../../scripts/windows-install-inventory.cjs)
只生成 `evidenceKind=packaged-tree-evidence` 的构建证据，并固定写入：

```text
authorization.kind=build-evidence-only
authorization.destructiveMutation=false
authorization.execution=false
```

其输入为显式 version/x64、已解包 packaged app tree、显式
`win-resources.tar`、uninstaller candidate 和可选 provenance。工具递归
记录 package tree，将 tar header 建模为 `resources/**` 的预期物化路径并
补齐隐式祖先目录，同时生成两个 exact scope record；这些 record 只引用
同一 tree digest，不能证明旧安装的真实 scope。

使用留存于本次取证环境中的 2026.7.17、2026.7.23 官方安装产物重新生成并
通过 canonical validation 的 smoke 结果为：

| source | entryCount | treeDigest |
|---|---:|---|
| 2026.7.17 | 34,331 | `960ebeb9280ddde9c23353feb0f799de12893a3f490e02fb0c454e354aa73960` |
| 2026.7.23 | 35,909 | `1d7cc273c948b1739490c31f89eedd9f6eb0370d52e6687e313cb30f015b6ebc` |

这组数字是 packaged tree、tar 物化成功路径、恢复 marker 与 uninstaller
candidate 的 canonical evidence union，不是在线安装根快照，也不是
ownership/deletion capability。CLI version/path/provenance 仍是构建方
输入；PE certificate-table presence 只是结构证据，不是 WinVerifyTrust
或 Authenticode publisher 鉴真；Node tar header 模型尚未由 Windows
`tar.exe` 真机物化结果证明等价。当前 evidence 尚未嵌入候选安装器，也未
接入 runtime selector、scanner 或 NSIS authorization，所以不能授权任何
mutation 或执行。

source version 不能直接相信注册表 `DisplayVersion`。HKCU/HKLM 记录只
用于发现候选 source；inventory selector 必须由候选签名安装器内嵌支持
矩阵、已验证 source footprint/主程序版本资源、scope 与 architecture
共同导出并记录证据。任一证据不一致返回 `inventory-unavailable`。
不得接受 CLI、旧树 loose 文件或用户可写 receipt 覆盖 selector。

P0.5 的运行时信任边界是发布流水线产生的候选签名安装器及其嵌入资源。
无法验证载体、找不到精确 key 或嵌入资源解析失败时返回
`inventory-unavailable`/`manifest-untrusted`，不得继续整树清理。完整的
安装包发布鉴真仍由单独 Authenticode spec 负责，但本功能不能把旧安装树
中的文件当作可信删除清单。

只比较顶层名称不能满足本 spec：用户放在 `resources` 等已知目录内部的
新增内容仍会随整树删除。P0.5 必须递归比较所有相对路径；任何 inventory
和精确 lifecycle rules 之外的嵌套条目均为 foreign/unknown。

在冻结 inventory 前，Owner 必须完成一次“所有写入
`process.resourcesPath` 或 `$INSTDIR` 的代码路径”审计，并使用至少以下
真实生命周期样本取证：

1. 刚完成安装、尚未启动；
2. 首次启动并完成资源恢复；
3. OpenClaw 正常启动；
4. bundle-only 模式切换前后；
5. 资源恢复成功和失败；
6. Skills 同步成功、同步失败及 bundled fallback；
7. 从 2026.7.17、2026.7.23 升级到修复版；
8. 普通卸载与保留 userData 的卸载。

审计产物必须记录代码 writer、调用条件、生成路径、内容变化范围、是否含
凭据/用户状态以及对应自动化测试。不能从某一台机器的目录差异直接推导
宽泛白名单。

首批必须建模的合法安装树形态：

| 路径 | ownership | presence | contentPolicy | writer / 生命周期 |
|---|---|---|---|---|
| `resources\.win-resources-extracted` | `installer-generated` | optional | `exact-schema` | installer 或 app-recovery；两种 writer 的内容允许不同，但都必须符合精确 schema |
| `resources\cfmind\gateway-launcher.cjs` | `app-generated` | optional | `trusted-output-digest-set` | app-first-run / app-mode-switch；首次生成并可在 bundle-only 切换时覆写 |
| `resources\win-resources.tar` | `packaged` | optional | `immutable-hash` | package；资源恢复成功后删除、失败时可合法保留 |
| `resources\SKILLs\<exact-skill>\.env` | `app-generated-user-state` | optional | `preserve-only` | bundled fallback 写入路径；出现频率不影响保护等级 |
| `accounts.json` 的任何已取证安装树路径 | `app-generated-user-state` | optional | `preserve-only` | 可能含账号或凭据，只能保护或阻断 |

表中仍需用真实发布产物和代码 writer 生成精确的版本、架构与 scope 记录；
它不是允许同名路径自动归属的手写通配清单。`.venv` 当前没有已确认 writer，
必须保持 `unknown`，直到审计与生命周期测试证明其归属。

首轮 writer 审计还必须覆盖 bundled `web-search` Skill 的实际安装/构建/
运行产物，包括 `node_modules/`、`dist/`、`.server.pid`、`.server.log` 和
连接状态文件。打包脚本对 `.env`、`.venv`、`.bin` 等路径的排除意味着
payload 与运行期安装树天然不同构，不能只用构建产物 diff 推导 ownership。
上述路径在完成 writer、内容策略、用户可编辑面和版本范围取证前保持
unknown；不得为避免误报直接加入宽目录白名单。

扫描发现 inventory 外内容时，只有同时满足以下条件才返回
`legacy-skill-protection-required`，而不是普通 foreign：

1. 根角色为旧 `source`，且 source/version/inventory 均可信；
2. 路径是 `resources\SKILLs` 的直接子目录；
3. 目录及子树没有 reparse point、逃逸路径或扫描错误；
4. legacy inspector 能以“不执行内容”的方式完整枚举该目录；
5. 该根没有候选集合之外的其他 foreign/unknown。

任一条件不满足仍返回 `foreign-content-detected` 或 `scan-incomplete`。

只有 `replaceable-by-path` 条目在相对路径、entry type、版本和 scope
命中时，才允许字节变化后继续属于可替换应用管理范围。P0.5 不得把
“路径均命中”表述为“文件内容与官方 payload 相同”。
`immutable-hash`、`trusted-output-digest-set` 和 `exact-schema` 必须按
第 2.1 节处理 mismatch，不能借用 `replaceable-by-path` 的语义。

### 4.2 扫描

扫描输入：

- 带角色的规范化安装根路径（`source|target`）；
- 来源版本和架构；
- 对应版本 historical inventory 与精确 lifecycle rules；
- 本次 `attemptId`。

扫描至少检查：

- 全树相对文件和文件夹路径；
- file attributes；
- reparse point；
- 无法读取的条目；
- 规范化后是否仍位于安装根之下；
- 是否存在 inventory/lifecycle rules 外内容；
- lifecycle entry 的 presence、contentPolicy、writer 和 versionRange 是否
  匹配；
- `preserve-only` 用户状态是否存在。

P0.5 普通 guard 不读取或 hash 通用 foreign 内容，也不自动复制 unknown
内容。扫描必须生成可复验快照，至少含规范化相对路径、entry type、关键
attributes、大小和 last-write metadata。`immutable-hash`、
`trusted-output-digest-set` 和已进入窄 legacy Skill 保护流程的 exact
candidates 必须做强字节摘要；不得读取其他 foreign 内容的正文。
`exact-schema` 必须使用受限 parser，显式限制最大字节数、编码、schema
版本、字段集合、字段类型和嵌套深度；未知字段、尾随数据、非法编码或解析
超限均返回 `content-integrity-mismatch`。解析正文不得写入日志。

扫描必须具有显式资源上限和 watchdog。至少记录文件/目录数量、枚举耗时、
hash 耗时、总耗时和停止原因；不能使用不受控 PowerShell 管道扫描 3–5 万
文件。超时、取消、进程终止失败或 watchdog 状态未知均返回
`scan-incomplete`，不能根据部分结果放行。性能门禁和阈值必须通过真实
Windows Defender 开启状态下的 p50/p95/p99 样本冻结；阈值超出时允许
中止并给出人工指引，不允许跳过扫描。

门禁结果必须按 canonical root 保存为数组或 map，而不是单个全局状态：

```text
rootId
rootRole
canonicalRoot
plannedMutation
inventoryKey
lifecycleRuleSetVersion
status
snapshotId
legacyCandidatePaths
protectionReceiptId
```

`rootId` 在候选根解析时由受信安装器按 canonical root + role + attempt
nonce 派生，attempt 内唯一，并写入 admin-only secure journal；不得从
命令行、旧安装树或用户可写日志接受。所有 guard、receipt、backup、
recovery 和日志记录必须复用同一 rootId。

`relocate-reinstall` 至少分别处理旧 source 和新 target：旧 source 会被
stage/删除，非空 target 会被覆盖或 rename，因此两者都必须独立
preflight、snapshot 和 revalidate。全新安装的空 target 可记录为
`content-guard-empty-write-only-target`。任一将被 mutation 的非空根
未通过，聚合动作即失败。

legacy protection receipt 必须绑定同一 attemptId、rootId、canonical
source、preflight snapshotId 和精确 candidate path 集合，并包含复制/
校验统计及逐文件 SHA-256（或等价强摘要）。保护只能发生在 StopProcesses
之后的重扫结果上；不得基于仍在运行进程期间得到的 preflight snapshot
直接复制。mutation 紧邻前必须重新计算 source candidate 摘要并与
backup/receipt 比较；receipt 覆盖不足、覆盖范围过宽、来自另一根/
attempt、字节变化或快照变化时不得升级状态。其他 foreign 内容永远不能
借用该 receipt 放行。

### 4.3 与可靠性 spec 的接口

可靠性安装状态机在任何 destructive mutation 前调用内容门禁：

```text
ResolveCandidateRoots
  -> BuildRootsToMutate
  -> ScanInstallRootContentPreflightForEachRoot
  -> PlanFinalAction
  -> StopProcesses
  -> RescanInstallRootContentForEachRoot
  -> ProtectLegacySkillCandidatesAndValidateReceiptWhenRequired
  -> FinalRevalidateInstallRootContentForEachRoot
  -> StageOldInstall / UninstallOldVersion
```

早期 Scan 只用于发现确定性阻断条件和形成停止进程计划：

- 已确定存在普通 foreign、`app-generated-user-state`、扫描错误或不可信
  inventory 时，在 Stop 前直接失败；
- 可能继续的 `safe-to-replace`、optional lifecycle entry 或仅 legacy
  candidate 场景才进入 Stop；
- Stop 后必须重新完整扫描，shutdown hook 产生的新条目不得沿用旧快照；
- legacy backup/receipt 只消费 Stop 后的重扫快照；
- Final Revalidate 必须紧邻 mutation，期间不得启动任何可能写安装树的
  进程。

其他结果：

```text
foreign-content-detected
scan-incomplete
inventory-unavailable
manifest-untrusted
  -> FailedBeforeMutation
```

最终复验必须与 mutation 紧邻，中间不得再启动可写安装树的外部流程。
快照变化时返回 `scan-incomplete`；不得在未重新执行完整
`Rescan -> Protect -> Final Revalidate` 的情况下原地重试放行。

每个 mutation 只能消费同一 canonical root 的已复验 snapshot；不得用
source 的 `safe-to-replace` 为 target 放行，也不得用聚合 success 隐藏
某个根的扫描失败。

可靠性模块不得自行把扫描错误改写成 success，也不得绕过门禁调用 stock
uninstaller，因为旧卸载器本身可能递归删除整个安装目录。

P0.5 不执行旧卸载器。`UninstallString` 和旧 EXE 只能作为候选发现/诊断，
不能作为执行授权；copy-out 成功或失败都不得触发原位执行。修复版自己的
普通卸载必须把 guard 接在 electron-builder 的 `customRemoveFiles` 前置
hook，不能使用删除后的 `customUnInstall`。构建合同测试必须验证该 hook
实际位于 `atomicRMDir`/`RMDir /r` 之前。

### 4.4 卸载

修复版生成的 uninstaller 必须在 `customRemoveFiles` 进入 stock
`atomicRMDir`/`RMDir /r` 之前完成 guard；发现 foreign 或 unknown 时
在任何卸载 mutation 前中止，用户迁出内容后重试。P0.5 不启动旧树中的
uninstaller，因此不存在“先检查再执行旧卸载器”的兼容路径。

版本边界必须明确：新安装包无法修改已经安装在用户机器上的旧 uninstaller；
通过 Windows 设置直接运行旧版卸载器仍可能递归删除安装树。支持文档必须
要求先建立并验证安装树外完整副本，不能宣称旧卸载入口已被修复版保护。

P0.5 的 update/rollback 提交路径不得派发 `.old` 或 `.failed` 的异步
`Remove-Item -Recurse`。这些目录使用 attempt-scoped retention class
保留并记录，P0.5 不提供自动清理重试。只有 P1 helper 对精确对象身份、
逐项 ownership 和最终快照重新授权后，安装器才能自动删除。用户自行在
产品外手工删除属于 out-of-band 操作；“确认已有另一副本”按钮不得触发
P0.5 安装器代删，也不能替代对象身份和 delete-set authorization。

P1 具备可信 ownership manifest 后：

1. 删除 manifest 中的 app-owned 文件；
2. 自底向上删除已经为空的 app-owned 目录；
3. foreign 内容保持原位；
4. 安装根非空时保留目录；
5. userData 是否删除由独立、明确的卸载选项控制。

## 5. P1：ownership manifest 与事务保护

### 5.1 构建期 manifest

每个 Windows 安装包生成不可由运行时用户修改后继续被信任的 manifest，
至少包含：

```text
schemaVersion
productId
version
architecture
scope
relativePath
entryType
ownershipClass
presence
contentPolicy
writer
versionRange
```

policy-specific 字段使用 discriminated union，不能用一个可选 `sha256`
同时表达所有策略：

```text
replaceable-by-path:
  expectedEntryType

immutable-hash:
  algorithm
  digest
  size

trusted-output-digest-set:
  digestSetId
  digestSetVersion
  modeKey
  algorithm
  allowedDigests[]

exact-schema:
  schemaId
  schemaVersion
  maxSize

preserve-only:
  noDeletionCapability=true
```

目录项不强制携带 file `size/digest`；字段有效性由 `entryType ×
contentPolicy` 校验。manifest 本身绑定 product/version/architecture/
scope，条目不能跨 scope 复用。

manifest 必须覆盖：

- 主程序；
- 卸载器；
- `resources` payload；
- 安装器创建的固定元数据；
- 允许在首次启动、恢复或模式切换后出现/变化的精确条目及其特殊归属规则；
- 已知 `app-generated-user-state` 路径及 `preserve-only` 策略。

签名或信任验证失败时，manifest 不得参与删除决策。
构建期清单必须与第 4.1 节写入审计产生的 lifecycle rules 合并校验；构建
产物 inventory 不能覆盖或降级 `preserve-only` 分类。

### 5.2 签名 helper

复杂扫描、进程枚举、复制、校验和精确删除由随应用签名的原生 helper
完成，不在 NSIS 中继续堆叠复杂 JSON、递归路径和 ACL 逻辑。

helper 必须：

- 接受安装根、scope、attemptId 和固定操作类型；
- 只接受由受认证用户态 launcher 绑定的 original user SID；
- 拒绝任意 status-file、backup 或删除目标路径；
- 自行从固定根派生 attempt 目录；
- 验证所有规范化路径仍位于允许的根下；
- 对外返回稳定枚举状态，不返回仅供人阅读的自由文本作为控制信号；
- 不执行 foreign 文件。
- 对任何候选旧卸载器执行独立 `executionTrust` 验证，不能用路径归属、
  注册表来源或 deletion ownership 代替；
- 删除前消费一次性、精确 delete-set mutation authorization；delete set
  发生扩张、跨 snapshot/root 或重复消费时 fail closed。

P1 安装包对外入口是非提权 bootstrap，提权 helper/worker 不是受支持的
用户直启入口。bootstrap handoff 至少绑定候选 worker identity、attemptId、
original SID、source/target canonical roots、scope 和一次性 nonce；
提权端验证后才允许保护或删除。校验失败保持原树并返回稳定错误。

P1 用户确认和静默 managed policy 必须形成独立 authorization receipt，
不能复用 legacy Skill protection receipt。至少绑定：

```text
authorizationReceiptId
attemptId
rootId
scope
sourceVersion
snapshotId
protectedSetDigest
plannedMutation
plannedMutationDigest
exactDeleteSetDigest
authorizationMode       # interactive | managed-policy
originalUserSid
promptSummaryDigest     # interactive
policyId
policyVersion           # managed-policy
consentedAt
expiresAt
nonce
```

helper 在保护/删除前验证 receipt，在 Final Revalidate 后再次确认其仍绑定
当前 snapshot 和 mutation，并一次性消费。无 receipt、过期、跨 root/
snapshot/mutation、prompt 摘要变化或 managed policy ID/version 不匹配时
均中止。

### 5.3 恢复区

提权保护阶段统一使用机器级 canonical staging：

```text
%ProgramData%\LobsterAI\Installer\foreign-content\<attemptId>\<rootId>\
```

不能在提权进程中直接展开 `%LOCALAPPDATA%`：UAC 可能使用另一管理员凭据，
此时该变量属于管理员 profile，不是原始发起用户。

恢复区 ACL 只允许 `SYSTEM`、Administrators 和经过验证的原始发起用户
SID。原始 SID 必须在非提权用户上下文中采集，并通过受认证的 launcher/helper
协议绑定到 attempt；不得接受任意 SID 或任意恢复路径。无法可靠绑定原始
SID 时，保留旧树并中止保护，不得把恢复内容暴露给所有本机用户。

新应用在原始用户身份下可把已验证内容导入该用户
`%LOCALAPPDATA%\LobsterAI\Installer\foreign-content\<attemptId>\<rootId>`，
但 machine staging 在逐根导入确认前不得删除。

恢复 manifest 至少记录：

```text
attemptId
rootId
rootRole
originCanonicalRoot
sourceVersion
scope
originalUserSid
snapshotId
authorizationReceiptId
protectedSetDigest
plannedMutation
plannedMutationDigest
relativePath
entryType
size
sha256
protectedAt
onlyRecoveryCopy
onlyRecoveryCopyPhase
```

`rootId` 必须由受信 helper 对 `rootRole + originCanonicalRoot` 生成稳定、
attempt 内唯一且不泄露路径内容的标识，不能由用户提供。source 与 target
即使存在相同 `relativePath`，也必须写入不同 rootId 子目录；保护、校验、
导入、展示和清理都按根执行，不得扁平合并或互相覆盖。

保护事务：

1. 枚举 foreign 内容；
2. 计算逐根待保护字节数、条目数、manifest/ACL/临时文件开销和安全余量；
3. 使用 `GetDiskFreeSpaceEx`（或等价可信 API）检查 staging 所在卷的
   available bytes；不足时返回
   `foreign-content-recovery-space-insufficient`；
4. 复制到 attempt-scoped staging，并把 ENOSPC、quota、短写和实际写入
   少于计划值视为失败；
5. 验证条目数、总大小和文件 hash；
6. 原子提交恢复 manifest 和对应 authorization receipt 引用；
7. 标记 `foreign-content-protected`；
8. 在任何可能使原件消失的 mutation 前，先 write-ahead 提交
   `onlyRecoveryCopyPhase=will-become-only-copy`，flush 并复读校验；
9. 才允许旧安装替换；
10. mutation 完成并确认原件已消失后，原子升级为
    `onlyRecoveryCopy=true`/`onlyRecoveryCopyPhase=only-copy`；
11. 新版本可用后展示恢复路径和“当前是否为唯一恢复副本”；
12. 清理只能遵循下述保留规则。

任一步失败时保留原件，不进入安装树 mutation。

空间检查只是前置门禁，不消除 TOCTOU：预检通过后任何实际复制/flush/
rename 的空间错误都必须安全失败。安全余量必须包含 manifest、ACL、目录
元数据、临时文件和至少一个可配置比例；具体比例由实现和真机故障注入
共同确定，不能使用“待保护字节数恰好等于可用空间”的判断。

“完整副本”必须按 Windows 对象语义定义，不能只比较默认 data stream：

- 枚举并处理 alternate data streams；不能读取或复制时返回
  `foreign-content-recovery-ads-unsupported`；
- 检测 EFS；不得在提权管理员上下文中把无法由 original SID 解密的内容
  静默复制成错误权限或明文，返回
  `foreign-content-recovery-efs-unsupported`；
- 记录 sparse/compression 属性和实际 allocated size，复制后复验；
- hardlink 必须记录 link identity/count；不能保证语义时拆成独立副本并
  在 manifest 标明，绝不能跟随到允许根外后删除源对象；
- DACL、owner、integrity label 和继承状态必须按恢复目标最小权限模型
  验证。提权复制出的内容不能统一授权给“当前管理员”；必须绑定 original
  SID，无法绑定时 fail closed；
- unsupported reparse tag、cloud placeholder、离线文件或备份语义不明的
  对象返回独立 typed failure，不得误报为复制成功。

上述 typed failure 都发生在 source mutation 前，原件保持不变。

恢复区保留规则：

1. 原安装树仍完整存在时，失败 attempt 的未提交 staging 可以按明确的
   失败清理策略回收；
2. `will-become-only-copy` 与 `only-copy` 都按唯一恢复副本保留。进程在
   mutation 与最终状态写入之间掉电时，恢复流程先检查原件是否仍存在，
   未确认前不得把状态降回可清理；
3. 原件已被已提交 mutation 移除后，恢复区副本是唯一恢复来源，必须在
   manifest 中标记 `onlyRecoveryCopy=true`；
4. `onlyRecoveryCopy=true` 或 write-ahead pending 的内容不得因年龄、
   全局容量配额、版本升级或
   后台自动清理静默删除；
5. 只有用户完成恢复/导出并明确确认删除，或另一个经过 hash 校验的完整
   副本已建立后，才能清除此标记并删除；
6. 空间不足时宁可中止新的保护和 mutation，也不得删除既有唯一恢复副本
   为本次更新腾空间。

## 6. 日志与错误

每次扫描记录：

```text
attempt_id
install_scope
source_version
root_id
root_role
install_root
planned_mutation
planned_mutation_digest
evidence_kind
evidence_ref
inventory_key
inventory_version
inventory_selector_evidence
lifecycle_rules_version
manifest_version
content_policy
content_policy_match
scan_pass
snapshot_id
scan_status
scan_file_count
scan_directory_count
scan_enumeration_ms
scan_hash_ms
scan_total_ms
scan_watchdog_outcome
app_generated_entry_count
user_state_entry_count
foreign_entry_count
foreign_total_bytes
reparse_point_count
recovery_required_bytes
recovery_available_bytes
recovery_only_copy
only_recovery_copy_phase
mutation_started
recovery_path
exact_delete_set_digest
authorization_receipt_id
authorization_consume_outcome
deletion_ownership
execution_trust
pre_mutation_root_identity
post_mutation_root_identity
ui_mode
prompt_policy
result_page_outcome
relaunch_outcome
enforcement_mode
failure_kind
win32_error
```

示例：

```text
phase=install-root-scan-complete status=foreign-content-detected entries=1 bytes=4096 mutation_started=false
phase=preflight-complete status=failed failure_kind=install-root-foreign-content-found mutation_started=false
```

不得把文件内容、用户密钥或恢复区 ACL 机密写入日志。

## 7. 测试计划

### 7.1 静态与单元测试

已落地的 build-evidence 子集由
[`tests/windowsInstallInventory.test.ts`](../../../tests/windowsInstallInventory.test.ts)
覆盖 deterministic canonical JSON、exact/no-nearest selector、显式 scope、
policy-specific 字段、Win32 alias/ADS/尾点空格/reserved name、绝对路径、
`..`、duplicate/case-fold collision、link/tar-link、entry budget，以及
`build-evidence-only` 不得扩张为删除或执行授权。它不覆盖 Windows
reparse/ADS/EFS/DACL 真机语义、runtime lifecycle 或受信 selector。

- historical inventory 与真实 2026.7.17、2026.7.23 产物递归路径一致；
- 写入 `process.resourcesPath`/`$INSTDIR` 的代码路径审计有 writer、条件、
  路径、版本和用户状态分类，且每条 optional rule 都有真实生命周期样本；
- `.win-resources-extracted` 的 installer/app-recovery 两种合法 schema
  均通过；超长输入、非法编码、未知字段、尾随数据和过深嵌套不通过；
- `gateway-launcher.cjs` 只有命中版本/模式绑定的受信摘要时才归为
  `app-generated`；
- `win-resources.tar` 的存在/已删除两种合法形态都通过；
- `.env`、`accounts.json` 命中已取证路径时仍返回待保护状态，不能返回
  `safe-to-replace`；
- `.venv` 或其他未经取证路径不会被宽 glob 归类为 app-owned；
- bundled `web-search` 的 `node_modules/dist/.server.*` 等运行期产物在
  没有精确 lifecycle rule 时保持 unknown；
- 未知条目不会被归类 app-owned；
- inventory 缺失、版本不匹配或不可信时 fail closed；
- registry `DisplayVersion`、CLI 或旧树文件不能覆盖受信 inventory key；
- `replaceable-by-path` 修改允许替换；`immutable-hash`、
  `trusted-output-digest-set` 和 `exact-schema` mismatch 分别返回稳定
  `content-integrity-mismatch`；
- build manifest 缺 scope、scope 错配、digest set 缺失或 policy-specific
  字段非法时构建失败；
- `resources` 等 app-owned 目录内新增条目仍被识别；
- 路径规范化后逃逸安装根时拒绝；
- reparse point 不被跟随；
- 扫描失败不会返回 `safe-to-replace`；
- 状态值不存在跨领域裸 `not-applicable`；
- 顺序固定为 `Scan -> Stop -> Rescan/ProtectLegacySkillCandidates ->
  Final Revalidate -> Mutation`；
- Stop 后新生成或变化的内容由 Rescan 检出；
- Protect 后快照变化会在 Final Revalidate fail closed；
- stock uninstaller 和 `RMDir /r` 前存在内容门禁；
- 编译产物确认 guard hook 是 `customRemoveFiles`，且位于
  `atomicRMDir`/`RMDir /r` 之前；
- P0.5 不调用旧 `UninstallString`，copy-out 和 in-place 执行路径均不可达；
- `.old` 与 `.failed` 不存在 `Remove-Item -Recurse` 或其他异步自动清理；
- `/S` 失败路径不包含阻塞弹窗或结果页；
- `--updated` guard failure 进入 installer-native 终态页，不落入会直接
  `Quit` 的 stock/custom 失败分支；
- 状态 × `plannedMutation` 矩阵拒绝跨 root/snapshot/mutation capability；
- authorization 判别联合不要求 empty/stage 操作伪造 manifest/delete-set，
  restore 使用新快照和独立的一次性 capability；
- P1 delete-set 与 consent/policy receipt 过期、扩张、跨 snapshot 或重复
  消费时 fail closed；
- scan watchdog 超时、取消和 child 状态未知都返回 `scan-incomplete`；
- report-only 阻断结果后，rename、旧卸载器和递归删除路径全部不可达。

### 7.2 Windows 集成测试

| 现场 | 操作 | 期望 |
|---|---|---|
| 安装根只有官方 payload | 更新 | 正常完成 |
| 首次安装未启动、首次启动、OpenClaw 启动、bundle-only 切换 | 更新 | 三种合法 runtime 形态均不被误判为 foreign |
| marker 具有 installer/app-recovery 合法内容 | 更新 | 规则按精确 schema 识别 |
| `gateway-launcher.cjs` 被用户修改 | 更新 | 摘要不匹配，mutation 前中止 |
| `win-resources.tar` 恢复成功后缺失/恢复失败后保留 | 更新 | 两种版本绑定形态均正确识别 |
| bundled Skill 内 `.env` 或已取证路径内 `accounts.json` | 更新/卸载 | 视为用户状态，P0.5 mutation 前中止 |
| 安装根出现 `.venv` | 更新/卸载 | 未经取证时按 unknown 阻断 |
| `MyData\sentinel.txt` | 应用内更新 | P0.5 mutation 前中止，文件原位 |
| `MyData\sentinel.txt` | 手动覆盖 | P0.5 提示迁出，文件原位 |
| `MyData\sentinel.txt` | `/S` 更新 | 稳定非零退出，无弹窗，旧应用可运行 |
| `MyData\sentinel.txt` | `--updated` 更新 | 进度窗口可见；无流程中段 MessageBox；终态页显示准确双语原因，关闭后旧应用至多重启一次 |
| `MyData\sentinel.txt` | 普通卸载 | P0.5 中止，文件原位 |
| `resources\MyData\sentinel.txt` | 更新/卸载 | 递归 inventory 检出，mutation 前中止 |
| `resources\SKILLs\MySkill\SKILL.md` | P0.5 更新 | 先返回待保护；receipt 完整且复验未变后继续 |
| legacy receipt 缺路径/跨 rootId | P0.5 更新 | 不升级门禁，mutation 前中止 |
| legacy 文件同 size/mtime 但字节已变 | P0.5 更新 | 强摘要复验失败，mutation 前中止 |
| legacy Skill 外另有 `MyData` | P0.5 更新 | 普通 foreign 阻断，receipt 不能放行 |
| 两个 source 含同名 legacy Skill | P0.5 多根动作 | 按 rootId 分目录备份，不覆盖 |
| 修改 `replaceable-by-path` 的 app-owned 文件 | 更新 | 允许替换；明确不承诺保留原位修改 |
| 修改 `immutable-hash` 文件 | 更新 | `content-integrity-mismatch`，mutation 前中止 |
| generated executable 命中未知 digest | 更新 | 不获得 deletion/execution capability，mutation 前中止 |
| registry 伪造 `DisplayVersion`/`UninstallString` | 提权更新 | 不选择错误 inventory、不执行旧 EXE，mutation 前稳定中止 |
| all-users 正常 HKLM + 恶意 HKCU `UninstallString` | 提权更新 | HKCU 仅作 discovery，不执行 |
| 未覆盖 source version | 更新 | P0.5 阻断并给完整备份/人工补救指引，不做整树 rename |
| 未覆盖 source version | P1 opaque quarantine | 只有可信 bootstrap、有效 receipt 与 handle-bound identity 全部通过才移动整根；不加载或删除树内内容 |
| Scan 后、Stop 前新增文件 | 更新 | Stop 后 Rescan 检出，mutation 前中止 |
| Protect 后、Final Revalidate 前修改 legacy 文件 | 更新 | 最终强摘要复验失败，mutation 前中止 |
| 旧 source 安全、新 target 含 foreign | 换目录重装 | target 门禁中止，两个根均不 mutation |
| 旧 source 含 foreign、新 target 为空 | 换目录重装 | source 门禁中止，旧树和新 target 不 mutation |
| source/target 都含同名 `data\x` | P1 换目录保护 | 分属不同 rootId，两个副本均校验通过且不覆盖 |
| `MyData\sentinel.txt` | P1 保护后更新 | 安装成功，恢复区副本校验通过 |
| junction 指向安装树外 | 更新/卸载 | 不跟随，mutation 前中止 |
| install root 的用户可写 ancestor 未获权限 ADR 放行 | P0.5 stage | mutation 前中止，不以 post-rename 检查冒充预防 |
| ACL 拒绝读取 | 更新/卸载 | `scan-incomplete`，原目录不变 |
| 恢复区空间不足 | P1 保护 | 失败，原件和旧应用不变 |
| 空间预检通过后复制期间触发 ENOSPC/quota | P1 保护 | 写入失败，原件不变，不进入 mutation |
| 已完成 mutation，恢复区是唯一副本且超过年龄/容量阈值 | 自动清理 | 不删除，仍可恢复 |
| write-ahead 已提交、mutation 后掉电、最终 only-copy 状态未写 | 重启恢复 | pending 按唯一副本保留，先检查原件，不自动清理 |
| 用户确认已导出且另一副本 hash 通过 | 清理恢复区 | 可清理并记录确认 |
| foreign 含 ADS/EFS/hardlink/sparse/特殊 DACL | P1 保护 | 完整语义可验证才继续；否则 typed fail，原件不变 |
| post-rename identity 证据可得且不匹配 | P0.5 stage recovery | 不回移、不继续 mutation，进入 `recovery-required` 并保留所有路径 |
| P1 root 含 foreign，授权 exact app-owned delete set | 普通卸载 | 仅删除集合内文件，sentinel 原位保留 |
| 同一状态改用 whole-tree delete | 普通卸载 | mutation authorization 拒绝 |
| consent receipt 跨 root/snapshot 或 delete set 扩张 | P1 保护/卸载 | mutation 前中止，receipt 不消费或标记无效 |
| 同名大小写冲突 | P1 保护 | 拒绝自动迁移 |
| standalone 经非提权 bootstrap，UAC 使用另一管理员 | P1 手动覆盖 | original SID 仍正确绑定并使用最小 ACL |
| 直接启动提权 worker，无可信 handoff | P1 手动覆盖 | mutation 前稳定中止，不创建宽 ACL 恢复区 |

每个用例验证：

1. `sentinel.txt` 内容未变化；
2. mutation 是否符合预期；
3. 旧应用是否仍可启动或已正确更新；
4. attempt 日志和退出码；
5. 不存在安装树外误删。

## 8. 验收标准

`Must` 是对应阶段的发布阻断项；任何 Must 未通过都不得启用该阶段的
destructive mutation。`Should` 不阻断首个阶段性发布，但必须有 Owner、
跟踪项和目标版本，不能静默删除。

### 8.1 P0.5

当前已实现内容只是 partial implementation evidence，不单独完成下面任何
Must，也不得用于启用 destructive mutation。

- [ ] **Must / FR-FC-01** 已支持来源版本有经过真实产物和运行期生命周期
      核验的递归 historical inventory 与精确 required/optional rules。
- [ ] **Must / FR-FC-01** 写入 `process.resourcesPath`/`$INSTDIR` 的代码
      路径审计完成；marker、gateway launcher 和 tar 的合法形态有真实
      取证与测试。
- [ ] **Must / FR-FC-01** historical inventory 嵌入受信候选载体，不从
      旧安装树或任意路径加载；不存在宽泛 glob。
- [ ] **Must / FR-FC-01** `.env`、`accounts.json` 等用户状态使用
      `preserve-only`，`.venv` 在无证据时保持 unknown。
- [ ] **Must / FR-FC-01** bundled Skill 的安装、构建和运行期产物完成
      writer/性能取证；不存在用宽 `node_modules/**`、`dist/**` 或日志 glob
      规避误报。
- [ ] **Must / FR-FC-01** source version 与 inventory key 来自受信
      footprint/候选载体，注册表和 CLI 不能单独选择 inventory。
- [ ] **Must / FR-FC-02** 更新、覆盖安装和卸载都在 mutation 前执行内容
      门禁。
- [ ] **Must / FR-FC-02** foreign、app-generated-user-state、unknown、
      scan incomplete 均不进入递归清理。
- [ ] **Must / FR-FC-03** 流程固定为
      `Scan -> Stop -> Rescan/ProtectLegacySkillCandidates ->
      Final Revalidate -> Mutation`；Stop/Protect 后的快照变化会被检出。
      第 0.3 节的路径重新解析窗口仍是阶段风险，不能宣称已关闭。
- [ ] **Must / FR-FC-04** 只有精确 legacy Skill candidates 可通过有效
      receipt 升级为
      `foreign-content-protected`，其他 foreign 不能借用 receipt。
- [ ] **Must / FR-FC-04** legacy receipt 只基于 Stop 后重扫快照生成，逐
      文件强摘要并在 mutation 前复验；相同 size/mtime 的字节变化不会漏过。
- [ ] **Must / FR-FC-02** guard、receipt、backup、recovery 和日志使用
      同一 rootId，多根同名内容不会碰撞。
- [ ] **Must / FR-FC-02** 已知目录内部新增内容也会被检出。
- [ ] **Must / FR-FC-02** 每个将被 mutation 的 source/target 根分别
      扫描、复验和记录。
- [ ] **Must / FR-FC-02** 只有不存在/空且 write-only 的 target 使用
      `content-guard-empty-write-only-target`；非空“全新安装”目标不绕过。
- [ ] **Must / FR-FC-02** `MyData\sentinel.txt` 在所有 P0.5 故障路径
      保持原位且内容不变。
- [ ] **Must / FR-FC-02** P0.5 不执行旧树代码，旧 `UninstallString` 的
      copy-out/in-place 路径均不可达；普通卸载 guard 位于
      `customRemoveFiles` 删除前置点。
- [ ] **Must / FR-FC-02** `.old` 与 `.failed` 零自动 deferred cleanup。
- [ ] **Should / FR-FC-02** 增量加入 post-rename identity 证据检查；一旦
      mismatch 或证据不完整，不回移、不继续 mutation，进入
      `recovery-required`。该检查只 detect/contain，不关闭 pre-rename
      TOCTOU。
- [ ] **Must / FR-FC-02** 扫描 watchdog、文件数/耗时预算和 Defender
      开启状态下的性能门禁通过；部分扫描永不放行。
- [ ] **Must / FR-FC-05** `/S` 返回稳定错误且零 UI；`--updated` 保留
      progress UI、无流程中段门控弹窗，并显示 installer-native 终态页。
- [ ] **Must / FR-FC-05** 首跳不依赖旧应用读取新 schema；结果页关闭后
      旧应用至多重启一次，P1 handoff 下 launcher 是唯一 relaunch owner。
- [ ] **Must / FR-FC-05** 状态常量具有领域语义，不存在跨模块授权用的裸
      `not-applicable`。
- [ ] **Must / FR-FC-05** 文案明确“尚未修改原目录”和迁出建议。
- [ ] **Must / FR-FC-05** guard 文案、终态页、按钮和人工补救警告具有
      中英文 i18n，内部错误不直接充当主文案。
- [ ] **Must / FR-FC-05** report-only 灰度先于 enforcement，kill switch
      只能回退到安全阻断，不能绕过门禁继续 mutation。
- [ ] **Must / FR-FC-02** 可靠性 spec 不存在绕过内容门禁的兼容 fallback。

### 8.2 P1

- [ ] **Must / FR-FC-06** 构建期生成并验证含生命周期字段的 ownership
      manifest。
- [ ] **Must / FR-FC-06** build manifest 含 scope，并以 policy-specific
      union 表达 digest set/schema；每类 match/mismatch 语义有测试。
- [ ] **Must / FR-FC-09** 签名 helper 只能操作固定根和本次 attempt。
- [ ] **Must / FR-FC-06** foreign content 可事务保护到正确 scope 的
      恢复区。
- [ ] **Must / FR-FC-06** source/target 的恢复内容按 rootId 隔离，相同
      相对路径不会覆盖。
- [ ] **Must / FR-FC-09** standalone 安装经非提权 bootstrap 绑定
      original SID；提权 worker
      无可信 handoff 时 fail closed。
- [ ] **Must / FR-FC-06** 校验失败时原件不被删除。
- [ ] **Must / FR-FC-06** `onlyRecoveryCopy` 采用 write-ahead 状态机；
      mutation/终态之间掉电不会把唯一副本误判为可清理。
- [ ] **Must / FR-FC-06** ADS、EFS、hardlink、sparse、DACL/owner 和特殊
      reparse 语义无法完整保护时 typed fail，原件不变。
- [ ] **Must / FR-FC-08** mutation 前完成空间预检；实际 ENOSPC、quota
      或短写保留原件并阻断 mutation。
- [ ] **Must / FR-FC-08** 唯一恢复副本不会被年龄、容量配额或后台任务
      自动删除。
- [ ] **Must / FR-FC-07** 普通卸载只删除已验证的 app-owned 内容。
- [ ] **Must / FR-FC-07** 精确卸载只消费
      `delete-manifest-owned-set` authorization；状态变化、delete set
      扩张、跨 root/snapshot 或重复消费均拒绝。
- [ ] **Must / FR-FC-09** interactive consent 或 trusted managed policy
      receipt 与 original SID、exact snapshot/protected set/planned
      mutation 绑定并一次性消费。
- [ ] **Must / FR-FC-09** deletion ownership 与 execution trust 分离；
      registry/路径/任意有效签名不能授权提权执行旧 EXE。
- [ ] **Should / FR-FC-06** 应用可展示并打开恢复目录，明确是否为唯一
      恢复副本。
- [ ] **Must / FR-FC-09** guard/helper 不执行未知内容，也不主动把
      foreign 或恢复区新增为
      Defender exclusion；现有 exclusion 风险由独立安全 spec 验收。

### 8.3 需求追踪表

实现文件列是当前候选边界；新增 helper/inventory 工具的最终文件名可在
实现设计中调整，但 FR、测试和发布门禁 ID 不得丢失。

| FR | 需求 | 实现文件/边界 | 主要测试 | 发布门禁 |
|---|---|---|---|---|
| FR-FC-01 | lifecycle ownership、contentPolicy 与受信 inventory selector | `scripts/windows-install-inventory.cjs`（packaged-tree evidence only）；`scripts/nsis-installer.nsh`；仍需 lifecycle 生成器；`src/main/libs/installerResourceRecovery.ts`、`src/main/libs/openclawEngineManager.ts`、`src/main/skills/skillManager.ts` 作为 writer 审计输入 | `tests/windowsInstallInventory.test.ts`；7.1 lifecycle/policy 契约；7.2 合法安装树、用户状态与 registry 篡改；可信 selector/embedding pending | P0.5 Must |
| FR-FC-02 | 递归、多根、plannedMutation authorization、fail-closed 门禁和零自动清理 | `scripts/nsis-installer.nsh`；P1 signed helper | 7.2 nested foreign、source/target、ACL、reparse、identity mismatch | P0.5 Must |
| FR-FC-03 | Scan/Stop/Rescan/Protect/Final Revalidate 顺序 | `scripts/nsis-installer.nsh` 与可靠性状态机 | 7.1 顺序契约；7.2 Stop/Protect 竞态注入 | P0.5 Must |
| FR-FC-04 | legacy Skills 窄保护 receipt | `scripts/nsis-installer.nsh` 与可靠性 spec 定义的 inspector | 7.2 receipt 缺失、跨根、同元数据不同字节 | P0.5 Must |
| FR-FC-05 | 领域状态、`/S`/`--updated` UI、首跳结果和日志 | `scripts/nsis-installer.nsh`；installer-native 结果页；应用更新 status 消费方 | 7.1 状态常量/页面合同；7.2 `/S`、`--updated`、relaunch once | P0.5 Must |
| FR-FC-06 | policy-aware manifest、write-ahead 事务恢复与 Windows 完整副本语义 | P1 signed helper；恢复目录展示入口 | 7.2 保护成功/失败、掉电、ADS/EFS/DACL、同名多根、恢复入口 | P1 Must；展示为 Should |
| FR-FC-07 | capability-bound 精确卸载 | `scripts/nsis-installer.nsh`；P1 signed helper | 7.2 foreign 内容普通卸载、delete-set 扩张/重放 | P1 Must |
| FR-FC-08 | 空间、ENOSPC 与唯一副本保留 | P1 signed helper；恢复区清理入口 | 7.2 空间不足、复制期 ENOSPC、清理策略 | P1 Must |
| FR-FC-09 | bootstrap、SID、ACL、consent receipt 与 execution trust | 非提权 bootstrap；P1 signed helper | 7.2 UAC 换账号、恶意 HKCU、直启 worker、receipt 重放 | P1 Must |

## 9. 发布顺序

### 阶段 0：止损

1. 在支持文档中告知用户先把自建内容迁出安装目录。
2. 发布说明不得宣称当前版本会保留安装目录中的未知内容。
3. 保留 2026.7.17 和 2026.7.23 真实安装产物用于 historical inventory
   核验。

### 阶段 1：P0.5 保守门禁

1. 批准可靠性 spec 定义的 Windows 安装权限模型 ADR；ADR 通过前只进行
   writer 审计、inventory 取证和纯逻辑/测试准备。
2. 审计所有安装树 writer，并完成真实生命周期取证。
3. 产物核验、版本绑定 recursive inventory 和精确 optional rules；当前只
   完成 packaged-tree evidence 子集，lifecycle、可信 selector 与 embedding
   仍待完成。
4. report-only 灰度、扫描性能预算和误报矩阵。
5. 只读 Scan、Stop 后 Rescan/ProtectLegacySkillCandidates、最终复验与
   稳定错误。
6. 移除旧卸载器执行和 `.old/.failed` 自动递归清理。
7. 接入更新、覆盖安装、`customRemoveFiles` 卸载前置点和 `/S`；
   `--updated` 增加 installer-native 终态结果页。
8. Windows 真机故障注入、kill switch 和候选包发布门禁。

### 阶段 2：P1 精确保护

1. ownership manifest。
2. 签名 helper。
3. consent/managed-policy receipt 与 execution trust。
4. 带空间门禁、Windows 完整副本语义和 write-ahead 唯一副本保留策略的
   attempt-scoped 恢复区。
5. handle-bound opaque whole-root quarantine、精确卸载和恢复入口。

## 10. 外部参考

- Microsoft 建议应用把安装文件与用户数据分离，并把可变数据写入适当的
  应用数据位置：
  <https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices>
- MSIX 通过只读 package root 与可写数据位置隔离说明了现代 Windows
  应用的推荐边界：
  <https://learn.microsoft.com/en-us/windows/msix/msix-containerization-overview>
- Windows Installer 的 RemoveFiles 机制以安装器拥有的文件记录为删除
  依据，而不是默认清空任意目录：
  <https://learn.microsoft.com/en-us/windows/win32/msi/removefiles-action>
- NSIS `RMDir /r` 会递归删除目标树，必须在调用前证明目录可安全清理：
  <https://nsis.sourceforge.io/Reference/RMDir>
