# Windows 手动安装被 P0.5 守卫全量拦截修复设计文档

| 字段 | 值 |
|---|---|
| 状态 | 实现已在 `fix/windows-install-manual-overwrite-blocked` 分支落地（NSIS + 合同测试 + 两份冻结 spec 修订）；待 Windows Installer 安全评审、Windows 打包编译与 §6 真机矩阵 |
| Owner | Windows Installer DRI（待指定） |
| 事故基线 | 2026.7.24 安装包，2026-07-27 真机日志 attempt `{BA896558-3F6D-45EE-B7EC-57F08C8BBC70}` |
| 最后更新 | 2026-07-27 |
| 评审门禁 | 本文档修改了两份冻结 spec 的边界（见 1.4），实现前必须先完成对应 spec 修订与安全评审 |

## 1. 概述

### 1.1 问题

2026.7.24 Windows 安装包在以下两个最常见的人工安装路径上 100% 失败，
终态页显示「LobsterAI 更新已停止…当前安装目录无法被证明可安全替换」：

1. 旧版本在位时，手动双击安装包覆盖安装；
2. 卸载旧版后重新安装，且注册表或安装目录存在任何残留。

失败发生在任何 mutation 之前（`mutation_started=false`），原目录未被修
改，不涉及 PowerShell、Skills 备份、进程占用或资源解压——这些阶段在事
故日志中全部成功。

### 1.2 根因

2026-07-25 合入的 foreign content 止损切片（`f562be46`）移除了旧卸载器
执行路径后，`customUninstallOldVersion` 门禁只保留两条放行路径，而这两
条路径覆盖不了人工安装：

1. 场景分类器 `DetectFreshOrPossibleExisting`
   （`scripts/nsis-installer.nsh:429`）只有二元结果：HKCU/HKLM 的
   `InstallLocation`/`UninstallString` 四值全空且 `$INSTDIR` 枚举为空
   才是 `fresh-install`，其余（含枚举出错）一律 `possible-existing`。
2. 旧目录整树暂存（stage-rename）快速通道被
   `${IfNot} ${isUpdated}`（`scripts/nsis-installer.nsh:1069`）限定为
   应用内更新专用。手动安装不带 `--updated`，`rename_status` 恒为
   `not-applicable`。
3. 门禁（`scripts/nsis-installer.nsh:1333` 起）要求
   「`fresh-install` 且该注册表根无候选」或「`rename_status=success`
   且注册路径与 `$INSTDIR` 一致」，否则调用
   `lobsterAbortOldTreeExecution` 终止。

失败链路：

```text
手动运行安装包
  -> scenario=possible-existing
  -> updated_flag=absent
  -> 暂存快速通道跳过（reason=not-updated）
  -> 门禁拒绝（destructive-fallback-prohibited）
  -> failed-before-mutation
```

守卫的「可证明安全」证据机制（版本绑定 inventory + 目录扫描器）尚未实
现，因此对非 fresh、非暂存的一切场景，守卫永远给不出「安全」结论。这
是止损策略被当成长期行为暴露出的状态机死路，属于安装器回归。

辅助缺陷（同为本次修复范围）：

- preflight 日志只记录 `scenario=possible-existing` 结论，不记录是哪条
  证据触发，现场无法一次定位；
- 终态页文案「请先将个人文件移出安装目录」与实际放行条件不符：手动覆
  盖场景下移出个人文件不会改变结果；
- NSIS 日志按系统码页写入，非 ASCII 路径成乱码
  （实测 `current_directory=C:\Users\wangning\Documents\�ҵ�POPO`）。

### 1.3 决策原则

产品结论（已与事故评审共识对齐）：

> **自动处理的边界 = 归属证明的边界。能证明目录属于 LobsterAI 的场景
> 自动整树暂存后继续安装；证明不了的场景停止安装并给出具体、可执行的
> 提示。任何情况下不删除、不复制未知内容。**

- 「自动备份」专指同卷整树改名（`MoveFileW` rename）：零字节复制，
  ACL、EFS、ADS、硬链接原样保留，夹在安装树内的用户文件完整躺进
  `.old.*` 备份树。
- 逐文件 copy-quarantine（把 unknown 内容复制到恢复区）明确不做：复制
  凭据/ACL/EFS 本身是新的安全风险，且整树 rename 已零成本达成同等保护。
- 对无法证明归属的目录不做整树改名：rename 无法证明动的是旧安装还是用
  户的个人目录，该场景只能停止并把决定权交还用户。

### 1.4 关联 spec 与冻结条款修订

本文档是以下两份 spec 的 P0 落地切片，实现前需按其 §0 变更流程先行修订：

- [Windows 安装与更新可靠性修复设计](../windows-install-update-reliability/2026-07-24-windows-install-update-reliability-fix-design.md)：
  §3.2 动作映射（L482）从目标状态降为本切片的实现范围（六态中的五态，
  `relocate-reinstall` 除外）。
- [Windows 安装目录未归属内容保护设计](../windows-install-root-foreign-content-protection/2026-07-24-windows-install-root-foreign-content-protection-design.md)：
  - §0.1(4)：stage/rollback rename 的触发面从「`--updated` 应用内更新」
    扩展为「注册与足迹验证通过的任意安装调用」（`update-in-place`）及
    「无注册但足迹验证通过的孤儿树」（`repair-in-place`）；
  - §0.1(5) 保持不变：本切片不对 unknown 根做整树 quarantine，rename
    仅适用于足迹验证通过的根；
  - §3.1 行为矩阵新增手动覆盖/重装行；§3.2 阻断文案改为证据化文案；
  - §5.3 恢复区（copy-quarantine）降级为「不实施」，由整树 rename 保留
    替代，需在该 spec P1 章节记录降级决策。

不变量继承（不可弱化）：

1. 永不执行旧安装树中的卸载器或任何代码；
2. 永不对 unknown/foreign 内容做递归删除；
3. 扫描/枚举失败 fail closed，不得退化为「未发现问题」；
4. `/S` 零 UI + 稳定非零退出码；`--updated` 无流程中段门控弹窗；
5. 隔离树（`.old.*`、`.failed.*`）保留，P0 不做自动清理。

## 2. 用户场景

### 场景 1: 旧版在位手动覆盖安装（事故主场景）

**Given** 机器上已安装旧版 LobsterAI，注册表 `InstallLocation` 与
`$INSTDIR` 一致，目录内存在 `LobsterAI.exe`
**When** 用户双击 2026.7.24+ 安装包，选择默认目录完成向导
**Then** 旧目录被整树改名为 `LobsterAI.old.<pid>.<tick>` 暂存，新版本
安装成功，完成页提示备份位置；安装失败时旧树自动回滚复原

### 场景 2: 卸载后重装，目录残留可验证足迹

**Given** 用户已卸载旧版，注册表四值已清空，但安装目录残留包含
`LobsterAI.exe` 或 `Uninstall LobsterAI.exe` 的残树
**When** 用户运行安装包
**Then** 残树按 `repair-in-place` 整树改名暂存，安装继续并成功

### 场景 3: 卸载后重装，仅注册表残值

**Given** 某注册表根仍有 `InstallLocation`/`UninstallString` 残值，但
其指向的目录在磁盘上不存在，且 `$INSTDIR` 为空
**When** 用户运行安装包
**Then** 安装器仅删除该失效注册值（不触碰任何文件），按全新安装继续

### 场景 4: 目录内容无法证明归属

**Given** `$INSTDIR` 非空，无注册记录，目录内既无 `LobsterAI.exe` 也无
`Uninstall LobsterAI.exe`（例如用户个人文件夹，或仅剩锁死的
node_modules 残片）
**When** 用户运行安装包
**Then** 安装停止在 mutation 前，终态页列出阻断的具体顶层条目（最多
10 条 + 总数）、提供「打开该目录」入口，指引「清空该目录或更换安装位
置后重试」；不提供「忽略并继续」

### 场景 5: 应用内自动更新（回归保护）

**Given** 应用内更新下载完成后以 `--updated` 调起安装器
**When** 更新执行
**Then** 行为与 2026.7.24 现状完全一致：暂存、安装、失败回滚、终态页
与退出码均不变

### 场景 6: 静默安装

**Given** 企业分发以 `/S` 执行安装，命中场景 4
**When** 安装器退出
**Then** 全程零 UI，退出码为稳定的
`LOBSTER_INSTALL_EXIT_DESTRUCTIVE_FALLBACK_BLOCKED`(4)，证据完整写入
日志

## 3. 功能需求

### FR-1: 安装根动作规划器（五态）

`DetectFreshOrPossibleExisting` 升级为动作规划器，产出唯一
`installAction`，取值与判定顺序：

| 优先级 | 条件（全部满足） | action |
|---|---|---|
| 1 | 四注册值全空，`$INSTDIR` 不存在或枚举为空 | `fresh-install` |
| 2 | 存在注册且规范化后与 `$INSTDIR` 一致，目录含足迹文件 | `update-in-place` |
| 3 | 无有效注册，`$INSTDIR` 非空且含足迹文件 | `repair-in-place` |
| 4 | 某注册值指向的目标不存在 | stale reconciliation：证据收集阶段逐值内联清理（等价于至多一轮重规划），清理后按存活证据落入其余行 |
| 5 | 其余一切：无足迹的非空目录、双注册指向不同路径、枚举/访问错误、用户改装到已注册路径之外（relocate） | `blocked-conflict` |

- 足迹文件定义：`${APP_EXECUTABLE_FILENAME}`（LobsterAI.exe）或
  `${UNINSTALL_FILENAME}`（Uninstall LobsterAI.exe）存在于目录顶层。
  与现有 rename 资格检查（`nsis-installer.nsh:1094`）同源。
- `relocate-reinstall`（旧注册在别处、用户选了新空目录）本切片不放行，
  归入 `blocked-conflict` 并给出「先卸载旧版或安装回原目录」指引；完整
  支持留待后续（涉及 ARP 归属与双安装语义）。
- 注册表仅作候选发现，不单独授权任何文件操作（继承冻结条款）。

### FR-2: 暂存快速通道扩展到 update-in-place / repair-in-place

- 移除 `${IfNot} ${isUpdated}` 对 rename 的限定；改为
  `installAction ∈ {update-in-place, repair-in-place}` 时执行。
- 全部既有前置与后置保护原样保留：进程停止成功、Skills 备份成功、
  rename 后源消失/备份可见双重验证、验证失败回滚、回滚失败进入
  `recovery-required` 冻结。
- `repair-in-place` 与 `update-in-place` 走同一 rename/回滚代码路径；
  rename 日志行携带 `action=` 字段以便现场区分两种来源。
- 门禁 `customUninstallOldVersion` 的放行集合同步改为：
  `fresh-install 且该根无候选`、`rename_status=success`、
  `reconcile 后该根无候选`。旧卸载器执行路径保持不可达。

### FR-3: 失效注册 reconciliation

- `InstallLocation`：`GetFileAttributesW` 成功且目标不是目录，或失败码
  明确为 `ERROR_FILE_NOT_FOUND`/`ERROR_PATH_NOT_FOUND` 时，仅删除该
  注册值；Access Denied、共享冲突、杀软拦截及其他探测错误一律保留
  注册值并 fail closed。目录存在则一律不动（交给 FR-1 的 2/3/5 分支）。
- `UninstallString`：闭合引号包裹的卸载器路径可以证明精确二进制；
  二进制不存在时删除该根的整个 uninstall 注册键（没有可用卸载器的 ARP
  条目属于残留），存在时以其父目录作为候选目录参与 FR-1 判定。未加引号
  的值只有在整个值本身是已存在文件时才视为 live；带参数、引号损坏或
  其他无法确定 executable/arguments 边界的值，以及 Access Denied、共享
  冲突、杀软拦截、目标为目录等无法证明“二进制已消失”的结果，均记为
  `unknown`，保留注册键并 fail closed。
- 范围：HKCU 与 HKLM。HKLM 写操作依赖安装器既有
  `RequestExecutionLevel admin`。
- 每次删除写一条 `phase=stale-registration-reconciled` 证据日志，含
  根、值名、原值。任一删除失败即 fail closed：动作定为
  `blocked-conflict`（basis=`stale-registration-cleanup-failed`）。

### FR-4: 证据日志

- `install-evidence.log` 为 HKCU/HKLM 的 `InstallLocation`/
  `UninstallString` 分别记录 input 与 outcome：`absent`/`present`、
  `live`/`stale-cleaned`/`unknown`/`error`、规范化路径与 Win32 错误码。
  `install-preflight-complete` 记录 `$INSTDIR` 枚举结果
  （`empty`/`nonempty`/`error:<win32>`）、非空时的条目总数与前 10 个
  条目名、足迹命中、`registry_error`、最终 `installAction` 与判定依据。
- 阻断场景必须能从单条日志读出「哪条证据导致 blocked」。
- 日志须无损记录非 ASCII 路径。实现可选：证据行改用
  `FileWriteUTF16LE` 写入独立 `install-evidence.log`，或对非 ASCII 字段
  做转义编码；不得继续以系统码页写中文路径。

### FR-5: 终态页证据化文案

- `blocked-conflict` 终态页（中/英）：标题保持「LobsterAI 更新已停
  止」；正文改为「安装目录中存在无法确认归属的内容，本次未修改任何文
  件」+ 阻断条目列表（最多 10 条 + 「等 N 项」）+ 明确动作指引「清空该
  目录或更换安装位置后重试」；保留「打开该目录」链接。
- 删除现文案中「请先将个人文件移出安装目录」的误导表述（该动作在多数
  阻断场景下不改变结果）。
- `update-in-place`/`repair-in-place` 成功完成页追加一行备份位置提示：
  「旧版本已完整保留在 <backup path>」。
- 全部新增文案提供 zh/en 双语，沿用 nsh 内 `${U+XXXX}` 转义方案。

### FR-6: 备份树保留与提示

- `.old.<pid>.<tick>`、`.failed.*` 继续保留，不自动清理（继承 P0.5）。
- 成功路径在日志写 `phase=old-install-backup-retained path=... size_hint=...`。
- 用户文档新增说明：多次重装会累积备份树，可在确认新版本正常后手动删
  除；自动清理待 P1 对象身份校验能力。

### FR-7: 模式不变量回归

- `--updated`：行为与现状 bit-for-bit 等价（同一暂存路径、同一终态页策
  略、同一退出码）。
- `/S`：零 UI；`blocked-conflict` 退出码 4、`recovery-required` 退出码
  3、进程停止失败退出码 2，均不变。
- 卸载器行为本切片不改动（精确卸载见 1.4 关联 spec §4.4，另行排期）。

## 4. 实现方案

### 4.1 改动分层

| 层 | 内容 |
|---|---|
| `scripts/nsis-installer.nsh` | FR-1 规划器（改造 `DetectFreshOrPossibleExisting`，新增枚举取证与足迹检查宏）；FR-2 rename 触发条件与门禁放行集合；FR-3 reconcile 函数；FR-4 证据日志；FR-5 文案常量与终态页变量拼装 |
| `patches/app-builder-lib+24.13.3.patch` | 预期无需改动（`customUninstallOldVersion`/`customAfterUninstallOldVersions` 钩子已存在）；若终态页需新增 MUI 变量注入点则同步更新 patch 与合同测试 |
| `tests/windowsInstallerContract.test.ts` | 更新现有门禁断言；新增五态规划、reconcile、证据日志、文案断言（见 §6） |
| specs | 按 1.4 修订两份冻结 spec |
| 用户文档 | 备份树保留说明、blocked 场景自助指引 |

### 4.2 关键实现顺序

1. 先落 FR-4 证据日志与 FR-5 文案（纯可观测性，风险最低，可单独出包给
   现场用户换取更多真机证据）；
2. 再落 FR-1 规划器 + FR-2 触发扩展 + FR-3 reconcile（一个 PR，因为门
   禁放行集合必须与规划器原子切换）；
3. 合同测试与两份 spec 修订随第 2 步同 PR 合入。

### 4.3 明确不做（非目标）

- 不执行旧卸载器（永久不变量）；
- 不做逐文件 copy-quarantine 与恢复区；
- 不做 `relocate-reinstall` 放行与双安装语义；
- 不做卸载器 `customRemoveFiles` 门禁与 manifest 精确删除（独立切片）；
- 不做基于版本绑定 inventory 的内容级 safe-to-replace 判定（P1）；
- 不做 `.old.*` 自动清理。

## 5. 边界情况

| 场景 | 处理方式 |
|---|---|
| 注册路径与 `$INSTDIR` 一致但目录无足迹文件 | 注册表不授权文件操作，判 `blocked-conflict`，列出目录内容 |
| 双注册（HKCU/HKLM）指向同一路径 | 按 `update-in-place` 处理；两根门禁均以同一 rename 结果放行 |
| 双注册指向不同路径 | `blocked-conflict`，文案提示存在两处安装记录及各自路径 |
| `$INSTDIR` 枚举 Access Denied 或其他 Win32 错误 | `blocked-conflict`（fail closed），日志记录错误码，文案提示以管理员身份重试或检查杀软 |
| `.onInit` `SetOutPath` 产生的空 `$INSTDIR` | 继承现有 FindFirst 真实子项判定，仍为 fresh |
| rename 目标 `.old.<pid>.<tick>` 已存在 | pid+tick 组合本次进程内唯一；若仍冲突按现有 rename 失败重试（3 次）后走验证失败路径 |
| rename 后验证失败且回滚失败 | 继承现状：`recovery-required` 终态，退出码 3，双树保留 |
| Skills 备份失败 / 进程停止失败 | 继承现状：mutation 前中止，退出码 2 |
| reconcile 删值成功但重扫仍非 fresh | 只允许一轮 reconcile，第二轮结果直接定局，防循环 |
| `--updated` 但注册缺失（自动更新装在未注册目录） | 与现状一致走规划器：有足迹 → `repair-in-place` 继续；无足迹 → blocked（现状为必 blocked，此处为行为改善且仍安全） |
| 用户在向导中把安装目录改到已有个人内容的非空目录 | 无注册无足迹 → `blocked-conflict`，提示换目录；有足迹（此前装过）→ `repair-in-place` |
| 中文/非 ASCII 安装路径 | FR-4 编码要求覆盖；终态页展示用 NSIS 原生变量不受日志编码影响 |

## 6. 验收标准

真机验证矩阵（全部在开启 Defender 的 Windows 10/11 x64 执行；每项核对
UI 终态、退出码、日志证据链、文件系统终态四要素）：

1. 旧版 2026.7.23 在位，手动覆盖安装 → 成功；旧树完整位于
   `.old.*`；ARP 只剩新版一条。
2. 卸载旧版（正常卸载）→ 立即重装 → 成功（fresh 或 repair 均可，日志
   须与实际证据一致）。
3. 卸载后目录残留含 `LobsterAI.exe` 残树 → 重装成功走
   `repair-in-place`，残树进 `.old.*`。
4. 卸载后目录仅残留深层 `node_modules` 无足迹 → blocked，终态页列出条
   目、打开目录可用；清空目录后重试成功。
5. 仅 HKLM `UninstallString` 残值指向不存在目录，`$INSTDIR` 为空 →
   自动 reconcile，安装成功，日志含 `stale-registration-reconciled`。
6. `InstallLocation` 探测返回 `ERROR_ACCESS_DENIED` → blocked，原注册值
   不变，日志含 root/value/error code。
7. `UninstallString` 未加引号且带参数，或引号损坏 → `unknown` 并
   blocked，整个 uninstall 注册键保持不变。
8. `UninstallString` 精确路径探测返回 `ERROR_ACCESS_DENIED`，或目标是
   目录 → `unknown` 并 blocked，整个 uninstall 注册键保持不变。
9. HKCU 与 HKLM 指向不同路径的双注册 → blocked，文案含两路径。
10. `$INSTDIR` 内放入用户文件夹 `MyData\` + 无足迹 → blocked 且文案列出
   `MyData`；放入 `MyData\` 但同时有足迹 → 成功且 `MyData` 完整存在于
   `.old.*` 备份树内（逐字节抽查）。
11. 应用内 `--updated` 更新 → 与 2026.7.24 现状对比：暂存、成功、失败
   回滚三条路径行为一致。
12. 安装中途强制失败（断电模拟/杀进程）→ 回滚恢复旧树可启动；再次安装
   成功。
13. `/S` 命中场景 4/9 → 无任何窗口，退出码 4；`/S` 正常覆盖 → 退出码 0。
14. 中文用户名/中文安装路径全流程 → 日志证据可读无乱码。
15. 事故复现机（本次 wangning 真机）按场景 2-8 复测通过。

合同测试（`npm test -- windowsInstallerContract`）：

- 更新「classifies fresh installs…」为五态规划断言；
- 保留并继续断言「old-tree execution unreachable」「no recursive
  delete of unknown」「preserves staged old and failed trees」；
- 新增断言：rename 触发不再依赖 `isUpdated`；reconcile 仅在目标目录不
  存在/不是目录时删值；Access Denied 等不确定错误 fail closed；
  `UninstallString` 解析失败、访问失败或指向目录时不得删键；blocked 文案
  不含「移出个人文件」误导句；四注册值证据日志字段完整。

发布门禁：

- 两份冻结 spec 修订合入 + 安全评审通过后，方可合入实现 PR；
- 验收矩阵 1-13 全部通过并留存日志附件后，方可进入发布渠道。
