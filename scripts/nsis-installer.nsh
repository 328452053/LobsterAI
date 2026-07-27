!include "FileFunc.nsh"

!define LOBSTER_INSTALL_EXIT_DESTRUCTIVE_FALLBACK_BLOCKED 4
!define LOBSTER_INSTALL_UI_MODE_WIZARD "wizard"
!define LOBSTER_INSTALL_UI_MODE_PROGRESS_VISIBLE "progress-visible"
!define LOBSTER_INSTALL_UI_MODE_SILENT "silent"
!define LOBSTER_UNINSTALL_ENTRY_ABSENT "absent"
!define LOBSTER_UNINSTALL_ENTRY_LIVE "live"
!define LOBSTER_UNINSTALL_ENTRY_STALE "stale"
!define LOBSTER_UNINSTALL_ENTRY_UNKNOWN "unknown"
!define LOBSTER_WIN32_ERROR_FILE_NOT_FOUND 2
!define LOBSTER_WIN32_ERROR_PATH_NOT_FOUND 3
!define LOBSTER_INSTALL_BLOCKED_TITLE_EN "LobsterAI was not updated"
!define LOBSTER_INSTALL_BLOCKED_TITLE_ZH "LobsterAI ${U+66F4}${U+65B0}${U+5DF2}${U+505C}${U+6B62}"
!define LOBSTER_INSTALL_RECOVERY_TITLE_EN "Manual recovery is required"
!define LOBSTER_INSTALL_RECOVERY_TITLE_ZH "${U+9700}${U+8981}${U+624B}${U+52A8}${U+6062}${U+590D}"
!define LOBSTER_INSTALL_OPEN_PRESERVED_EN "Open the preserved installation folder"
!define LOBSTER_INSTALL_OPEN_PRESERVED_ZH "${U+6253}${U+5F00}${U+4FDD}${U+7559}${U+7684}${U+5B89}${U+88C5}${U+76EE}${U+5F55}"
!define LOBSTER_INSTALL_OLD_TREE_BLOCKED_EN "Setup stopped before modifying this folder because the previous installation could not be safely moved aside (it may be in use by another program). Nothing was changed and the previous version was preserved. Close any programs that may be using the folder, then retry. Details:"
!define LOBSTER_INSTALL_OLD_TREE_BLOCKED_ZH "${U+5B89}${U+88C5}${U+7A0B}${U+5E8F}${U+5728}${U+4FEE}${U+6539}${U+8BE5}${U+76EE}${U+5F55}${U+524D}${U+5DF2}${U+505C}${U+6B62}${U+FF1A}${U+65E7}${U+7248}${U+672C}${U+76EE}${U+5F55}${U+672A}${U+80FD}${U+88AB}${U+5B89}${U+5168}${U+79FB}${U+52A8}${U+FF08}${U+53EF}${U+80FD}${U+6B63}${U+88AB}${U+5176}${U+4ED6}${U+7A0B}${U+5E8F}${U+5360}${U+7528}${U+FF09}${U+3002}${U+672C}${U+6B21}${U+672A}${U+4FEE}${U+6539}${U+4EFB}${U+4F55}${U+6587}${U+4EF6}${U+FF0C}${U+65E7}${U+7248}${U+672C}${U+5DF2}${U+4FDD}${U+7559}${U+3002}${U+8BF7}${U+5173}${U+95ED}${U+53EF}${U+80FD}${U+5360}${U+7528}${U+8BE5}${U+76EE}${U+5F55}${U+7684}${U+7A0B}${U+5E8F}${U+540E}${U+91CD}${U+8BD5}${U+3002}${U+8BE6}${U+7EC6}${U+4FE1}${U+606F}${U+FF1A}"
!define LOBSTER_INSTALL_BLOCKED_UNPROVEN_EN "Setup stopped before making any change because this folder contains content that could not be confirmed as a LobsterAI installation. To avoid deleting your files, nothing was modified. Empty this folder or choose a different install location, then retry."
!define LOBSTER_INSTALL_BLOCKED_UNPROVEN_ZH "${U+5B89}${U+88C5}${U+76EE}${U+5F55}${U+4E2D}${U+5B58}${U+5728}${U+65E0}${U+6CD5}${U+786E}${U+8BA4}${U+5F52}${U+5C5E}${U+7684}${U+5185}${U+5BB9}${U+3002}${U+4E3A}${U+907F}${U+514D}${U+8BEF}${U+5220}${U+4F60}${U+7684}${U+6587}${U+4EF6}${U+FF0C}${U+672C}${U+6B21}${U+5B89}${U+88C5}${U+5728}${U+4FEE}${U+6539}${U+4EFB}${U+4F55}${U+6587}${U+4EF6}${U+524D}${U+5DF2}${U+505C}${U+6B62}${U+3002}${U+8BF7}${U+6E05}${U+7A7A}${U+8BE5}${U+76EE}${U+5F55}${U+FF0C}${U+6216}${U+5728}${U+5B89}${U+88C5}${U+65F6}${U+9009}${U+62E9}${U+5176}${U+4ED6}${U+4F4D}${U+7F6E}${U+FF0C}${U+7136}${U+540E}${U+91CD}${U+8BD5}${U+3002}"
!define LOBSTER_INSTALL_BLOCKED_DUAL_EN "Setup found two LobsterAI installation records pointing at different folders. To avoid modifying the wrong one, nothing was changed. Uninstall the version you no longer need, then retry."
!define LOBSTER_INSTALL_BLOCKED_DUAL_ZH "${U+68C0}${U+6D4B}${U+5230}${U+4E24}${U+6761}${U+6307}${U+5411}${U+4E0D}${U+540C}${U+76EE}${U+5F55}${U+7684} LobsterAI ${U+5B89}${U+88C5}${U+8BB0}${U+5F55}${U+3002}${U+4E3A}${U+907F}${U+514D}${U+8BEF}${U+6539}${U+9519}${U+8BEF}${U+7684}${U+5B89}${U+88C5}${U+FF0C}${U+672C}${U+6B21}${U+672A}${U+4FEE}${U+6539}${U+4EFB}${U+4F55}${U+6587}${U+4EF6}${U+3002}${U+8BF7}${U+5148}${U+5378}${U+8F7D}${U+4E0D}${U+518D}${U+9700}${U+8981}${U+7684}${U+7248}${U+672C}${U+FF0C}${U+7136}${U+540E}${U+91CD}${U+8BD5}${U+3002}"
!define LOBSTER_INSTALL_BLOCKED_RELOCATE_EN "An existing LobsterAI installation was found at a different location. Install to that location instead, or uninstall the existing version first, then retry. Nothing was changed."
!define LOBSTER_INSTALL_BLOCKED_RELOCATE_ZH "${U+68C0}${U+6D4B}${U+5230} LobsterAI ${U+5DF2}${U+5B89}${U+88C5}${U+5728}${U+5176}${U+4ED6}${U+76EE}${U+5F55}${U+3002}${U+8BF7}${U+5C06}${U+5B89}${U+88C5}${U+4F4D}${U+7F6E}${U+9009}${U+62E9}${U+4E3A}${U+539F}${U+76EE}${U+5F55}${U+FF0C}${U+6216}${U+5148}${U+5378}${U+8F7D}${U+5DF2}${U+5B89}${U+88C5}${U+7684}${U+7248}${U+672C}${U+540E}${U+91CD}${U+8BD5}${U+3002}${U+672C}${U+6B21}${U+672A}${U+4FEE}${U+6539}${U+4EFB}${U+4F55}${U+6587}${U+4EF6}${U+3002}"
!define LOBSTER_INSTALL_BLOCKED_SCAN_EN "Setup could not safely examine the existing installation folder, so nothing was changed. Retry as administrator, or check whether security software is blocking access."
!define LOBSTER_INSTALL_BLOCKED_SCAN_ZH "${U+5B89}${U+88C5}${U+7A0B}${U+5E8F}${U+65E0}${U+6CD5}${U+5B89}${U+5168}${U+5730}${U+68C0}${U+67E5}${U+73B0}${U+6709}${U+5B89}${U+88C5}${U+76EE}${U+5F55}${U+FF0C}${U+672C}${U+6B21}${U+672A}${U+4FEE}${U+6539}${U+4EFB}${U+4F55}${U+6587}${U+4EF6}${U+3002}${U+8BF7}${U+4EE5}${U+7BA1}${U+7406}${U+5458}${U+8EAB}${U+4EFD}${U+91CD}${U+8BD5}${U+FF0C}${U+6216}${U+68C0}${U+67E5}${U+5B89}${U+5168}${U+8F6F}${U+4EF6}${U+662F}${U+5426}${U+62E6}${U+622A}${U+4E86}${U+8BBF}${U+95EE}${U+3002}"
!define LOBSTER_INSTALL_BLOCKED_ITEMS_A_EN "Blocked items ("
!define LOBSTER_INSTALL_BLOCKED_ITEMS_B_EN " total):"
!define LOBSTER_INSTALL_BLOCKED_ITEMS_A_ZH "${U+963B}${U+65AD}${U+6761}${U+76EE}${U+FF08}${U+5171} "
!define LOBSTER_INSTALL_BLOCKED_ITEMS_B_ZH " ${U+9879}${U+FF09}${U+FF1A}"
!define LOBSTER_INSTALL_EXISTING_AT_EN "Existing installation: "
!define LOBSTER_INSTALL_EXISTING_AT_ZH "${U+5DF2}${U+5B89}${U+88C5}${U+4F4D}${U+7F6E}${U+FF1A}"
!define LOBSTER_INSTALL_OPEN_BACKUP_EN "Previous version preserved - open the backup folder"
!define LOBSTER_INSTALL_OPEN_BACKUP_ZH "${U+65E7}${U+7248}${U+672C}${U+5DF2}${U+5B8C}${U+6574}${U+4FDD}${U+7559}${U+FF0C}${U+70B9}${U+51FB}${U+6253}${U+5F00}${U+5907}${U+4EFD}${U+76EE}${U+5F55}"
!define LOBSTER_INSTALL_RECOVERY_REQUIRED_EN "The installation folder is in an uncertain recovery state. Setup did not delete any recovery copy and did not continue. Restart Windows before retrying, and preserve every folder listed in the log. Details:"
!define LOBSTER_INSTALL_RECOVERY_REQUIRED_ZH "${U+5B89}${U+88C5}${U+76EE}${U+5F55}${U+7684}${U+6062}${U+590D}${U+72B6}${U+6001}${U+4E0D}${U+660E}${U+786E}${U+3002}${U+5B89}${U+88C5}${U+7A0B}${U+5E8F}${U+6CA1}${U+6709}${U+5220}${U+9664}${U+4EFB}${U+4F55}${U+6062}${U+590D}${U+526F}${U+672C}${U+FF0C}${U+4E5F}${U+6CA1}${U+6709}${U+7EE7}${U+7EED}${U+5B89}${U+88C5}${U+3002}${U+8BF7}${U+91CD}${U+65B0}${U+542F}${U+52A8}${U+0020}${U+0057}${U+0069}${U+006E}${U+0064}${U+006F}${U+0077}${U+0073}${U+0020}${U+540E}${U+518D}${U+8BD5}${U+FF0C}${U+5E76}${U+4FDD}${U+7559}${U+65E5}${U+5FD7}${U+4E2D}${U+5217}${U+51FA}${U+7684}${U+6240}${U+6709}${U+76EE}${U+5F55}${U+3002}${U+8BE6}${U+7EC6}${U+4FE1}${U+606F}${U+FF1A}"

Var lobsterCurrentProcessPid
Var lobsterInstallerAttemptId
Var lobsterTargetProcessesStopStatus
Var lobsterResolveToolKind
Var lobsterResolvedToolPath
Var lobsterResolvedToolStatus
Var lobsterResolvedToolSource
Var lobsterTrustedPowerShellPath
Var lobsterTrustedPowerShellStatus
Var lobsterTrustedPowerShellSource

!ifndef BUILD_UNINSTALLER
  ; Cross-hook state used by the update fast path and the electron-builder
  ; template timing hooks. These are installer variables (not registers) so
  ; nested NSIS macros cannot accidentally overwrite an in-flight timer.
  Var lobsterInvocationSource
  Var lobsterUpdatedFlag
  Var lobsterUiMode
  Var lobsterLauncherFallback
  Var lobsterLegacySkillsStatus
  Var lobsterLegacySkillsRestoreStatus
  Var lobsterOldAppRelaunchStatus
  Var lobsterOldAppRelaunchError
  Var lobsterOldAppExecutionTrust
  Var lobsterOldAppExecutablePath
  Var lobsterOldUninstallerPath
  Var lobsterOldAppAsarPath
  Var lobsterTrustedTarPath
  Var lobsterTrustedTarStatus
  Var lobsterTrustedTarSource
  Var lobsterOldInstallOriginalPath
  Var lobsterOldInstallOriginalPathNormalized
  Var lobsterOldInstallRegisteredPath
  Var lobsterOldInstallRegisteredPathNormalized
  Var lobsterOldInstallBackupPath
  Var lobsterOldInstallFailedPath
  Var lobsterOldInstallRenameStatus
  Var lobsterOldInstallRenameReason
  Var lobsterOldInstallRenameError
  Var lobsterOldInstallRenameAttempts
  Var lobsterOldInstallRollbackReason
  Var lobsterOldInstallRollbackStatus
  Var lobsterOldInstallRollbackError
  Var lobsterOldInstallCurrentDirectory
  Var lobsterOldUninstallCandidatePath
  Var lobsterOldUninstallCandidatePathNormalized
  Var lobsterOldUninstallLaunchStatus
  Var lobsterOldUninstallBlockedRoot
  Var lobsterInstallerTerminalFailureKind
  Var lobsterInstallerTerminalOutcome
  Var lobsterInstallerTerminalExitCode
  Var lobsterInstallerTerminalPageState
  Var lobsterInstallerTerminalTitle
  Var lobsterInstallerTerminalText
  Var lobsterInstallerTerminalLinkText
  Var lobsterInstallerTerminalOpenPath
  Var lobsterNewInstallValidationStatus
  Var lobsterNewInstallValidationReason
  Var lobsterInstallAction
  Var lobsterInstallActionBasis
  Var lobsterPreflightCandidateDir
  Var lobsterPreflightConflictDir
  Var lobsterPreflightDirState
  Var lobsterPreflightEntryCount
  Var lobsterPreflightEntrySample
  Var lobsterPreflightFootprint
  Var lobsterPreflightStaleCleaned
  Var lobsterPreflightRegistryEvidence
  Var lobsterPreflightRegistryError
  Var lobsterUninstallEntryProbeError
  Var lobsterInstallerSuccessLinkText
  !ifndef APP_PACKAGE_URL
    Var lobsterPackageMaterializeStartTick
  !endif
  Var lobsterPackageExtractStartTick
  Var lobsterPackageCopyStartTick
  Var lobsterInstallerCacheCopyStartTick
  !ifndef ESTIMATED_SIZE
    Var lobsterEstimatedSizeScanStartTick
    Var lobsterEstimatedSizeValue
  !endif
!endif

; -- Design invariant --
; Nothing destructive may run before the user confirms the wizard (or the
; uninstall prompt). electron-builder inserts customInit in .onInit, which
; runs when the installer is merely opened -- cancelling at the welcome or
; directory page must leave the existing installation and running app
; untouched. All destructive work (stopping processes, backing up skills,
; renaming the old install dir) therefore lives in customCheckAppRunning,
; which electron-builder inserts inside the install section -- right after
; the user clicks Install and, critically, *before* uninstallOldVersion.

; Timestamp from NSIS built-ins (FileFunc ${GetTime}). The previous
; implementation spawned a PowerShell process per call just to format a
; timestamp -- with 20+ call sites that added tens of seconds per install on
; machines where security software inspects every process launch. Second
; precision is enough: phase durations are carried separately as elapsed_ms.
;
; Preserves every register (unlike the old version, which clobbered $0; the
; "copy exit codes to $R2 first" convention at call sites is kept anyway).
; OUTVAR must not be $0-$6.
!macro GetTimestamp OUTVAR
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  !ifdef BUILD_UNINSTALLER
    ${un.GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  !else
    ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  !endif
  ; $0=day $1=month $2=year $3=day-of-week name $4=hour $5=minute $6=second
  IntFmt $0 "%02d" $0
  IntFmt $1 "%02d" $1
  IntFmt $4 "%02d" $4
  IntFmt $5 "%02d" $5
  IntFmt $6 "%02d" $6
  StrCpy $0 "$2-$1-$0 $4:$5:$6"
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Exch $0
  Pop ${OUTVAR}
!macroend

; attemptId is a correlation identifier only. It is intentionally generated by
; Windows and is never used as a security nonce or authorization token.
!ifdef BUILD_UNINSTALLER
Function un.lobsterEnsureInstallerAttemptId
!else
Function lobsterEnsureInstallerAttemptId
!endif
  StrCmp $lobsterInstallerAttemptId "" 0 LobsterAttemptIdReady
  System::Call 'ole32::CoCreateGuid(g .s)'
  Pop $lobsterInstallerAttemptId
  LobsterAttemptIdReady:
FunctionEnd

!macro EnsureInstallerAttemptId
  !ifdef BUILD_UNINSTALLER
    Call un.lobsterEnsureInstallerAttemptId
  !else
    Call lobsterEnsureInstallerAttemptId
  !endif
!macroend

; Resolve only Windows-owned system tools, never PATH entries. Both
; PowerShell and tar use this single resolver entry so the existence check and
; the eventual execution refer to the exact same absolute path.
!ifdef BUILD_UNINSTALLER
Function un.lobsterResolveTrustedSystemTool
!else
Function lobsterResolveTrustedSystemTool
!endif
  Push $0
  Push $1

  StrCpy $lobsterResolvedToolPath ""
  StrCpy $lobsterResolvedToolStatus "helper-not-found"
  StrCpy $lobsterResolvedToolSource "none"

  StrCmp $lobsterResolveToolKind "powershell" LobsterResolvePowerShell
  StrCmp $lobsterResolveToolKind "tar" LobsterResolveTar
  StrCpy $lobsterResolvedToolStatus "unsupported-tool"
  Goto LobsterResolveToolDone

  LobsterResolvePowerShell:
    System::Call 'kernel32::GetFileAttributesW(w "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe") i .r0'
    IntCmp $0 -1 LobsterResolvePowerShellSystem32 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 LobsterResolvePowerShellSysnativeReady LobsterResolvePowerShellSystem32 LobsterResolvePowerShellSystem32
    LobsterResolvePowerShellSysnativeReady:
      StrCpy $lobsterResolvedToolPath "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
      StrCpy $lobsterResolvedToolStatus "resolved"
      StrCpy $lobsterResolvedToolSource "sysnative"
      Goto LobsterResolveToolDone

    LobsterResolvePowerShellSystem32:
    System::Call 'kernel32::GetFileAttributesW(w "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe") i .r0'
    IntCmp $0 -1 LobsterResolveToolDone 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 LobsterResolvePowerShellSystem32Ready LobsterResolveToolDone LobsterResolveToolDone
    LobsterResolvePowerShellSystem32Ready:
      StrCpy $lobsterResolvedToolPath "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
      StrCpy $lobsterResolvedToolStatus "resolved"
      StrCpy $lobsterResolvedToolSource "system32"
      Goto LobsterResolveToolDone

  LobsterResolveTar:
    System::Call 'kernel32::GetFileAttributesW(w "$WINDIR\Sysnative\tar.exe") i .r0'
    IntCmp $0 -1 LobsterResolveTarSystem32 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 LobsterResolveTarSysnativeReady LobsterResolveTarSystem32 LobsterResolveTarSystem32
    LobsterResolveTarSysnativeReady:
      StrCpy $lobsterResolvedToolPath "$WINDIR\Sysnative\tar.exe"
      StrCpy $lobsterResolvedToolStatus "resolved"
      StrCpy $lobsterResolvedToolSource "sysnative"
      Goto LobsterResolveToolDone

    LobsterResolveTarSystem32:
    System::Call 'kernel32::GetFileAttributesW(w "$WINDIR\System32\tar.exe") i .r0'
    IntCmp $0 -1 LobsterResolveToolDone 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 LobsterResolveTarSystem32Ready LobsterResolveToolDone LobsterResolveToolDone
    LobsterResolveTarSystem32Ready:
      StrCpy $lobsterResolvedToolPath "$WINDIR\System32\tar.exe"
      StrCpy $lobsterResolvedToolStatus "resolved"
      StrCpy $lobsterResolvedToolSource "system32"

  LobsterResolveToolDone:
  Pop $1
  Pop $0
FunctionEnd

!macro ResolveTrustedPowerShell
  StrCpy $lobsterResolveToolKind "powershell"
  !ifdef BUILD_UNINSTALLER
    Call un.lobsterResolveTrustedSystemTool
  !else
    Call lobsterResolveTrustedSystemTool
  !endif
  StrCpy $lobsterTrustedPowerShellPath $lobsterResolvedToolPath
  StrCpy $lobsterTrustedPowerShellStatus $lobsterResolvedToolStatus
  StrCpy $lobsterTrustedPowerShellSource $lobsterResolvedToolSource
!macroend

!macro ResolveTrustedTar
  StrCpy $lobsterResolveToolKind "tar"
  !ifdef BUILD_UNINSTALLER
    Call un.lobsterResolveTrustedSystemTool
  !else
    Call lobsterResolveTrustedSystemTool
  !endif
  StrCpy $lobsterTrustedTarPath $lobsterResolvedToolPath
  StrCpy $lobsterTrustedTarStatus $lobsterResolvedToolStatus
  StrCpy $lobsterTrustedTarSource $lobsterResolvedToolSource
!macroend

!macro customHeader
  !ifndef BUILD_UNINSTALLER
    ; The custom include can be parsed before electron-builder's asynchronous
    ; !addplugindir output. Define the relaunch function here, after the
    ; generated shared header has registered StdUtils.
    !insertmacro DefineLobsterOldAppRelaunchFunction
  !endif

  ; Request admin privileges for script execution (tar extract, etc.)
  ; This does NOT change the default install path -- just ensures UAC elevation.
  RequestExecutionLevel admin

  ; Keep only the progress bar visible. The details box stays hidden and
  ; NSIS/electron-builder retains the default status text behavior.
  ShowInstDetails nevershow
!macroend

; -- Stop every process that might hold file handles in the install dir --
;
; 1. LobsterAI.exe -- the main app AND the OpenClaw gateway (ELECTRON_RUN_AS_NODE)
; 2. node.exe whose binary lives inside the LobsterAI install tree
;    (Web Search bridge server, MCP servers spawned with detached:true)
;
; Stop-Process -Force is equivalent to taskkill /F -- the processes have no
; chance to run before-quit cleanup, so file handles may linger briefly as
; "ghost handles" in the Windows kernel. We poll until no matching process
; remains before proceeding.
;
; Shared between the installer and the uninstaller via customCheckAppRunning.
!macro stopLobsterAIProcesses
  DetailPrint "[Installer] Stopping running LobsterAI processes"
  StrCpy $lobsterTargetProcessesStopStatus "helper-not-found"
  System::Call 'kernel32::GetCurrentProcessId()i .r4'
  StrCpy $lobsterCurrentProcessPid $4
  System::Call 'kernel32::GetTickCount()i .r7'
  StrCmp $lobsterTrustedPowerShellPath "" StopLobsterAIProcessesDone
  nsExec::ExecToLog '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "\
    Stop-Process -Name LobsterAI -Force -ErrorAction SilentlyContinue;\
    Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"*LobsterAI*\" } | Stop-Process -Force -ErrorAction SilentlyContinue;\
    for ($$i = 0; $$i -lt 15; $$i++) {\
      $$procs = @();\
      $$procs += Get-Process -Name LobsterAI -ErrorAction SilentlyContinue;\
      $$procs += Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like \"*LobsterAI*\" };\
      if ($$procs.Count -eq 0) { break };\
      Start-Sleep -Milliseconds 500;\
    };\
    if ($$procs.Count -ne 0) { exit 3 };\
    exit 0"'
  Pop $0
  StrCpy $R2 $0
  StrCpy $lobsterTargetProcessesStopStatus "numeric-exit-code"
  StrCmp $R2 "error" 0 +2
    StrCpy $lobsterTargetProcessesStopStatus "process-start-blocked"
  StrCmp $R2 "0" 0 +2
    StrCpy $lobsterTargetProcessesStopStatus "success"
  Goto StopLobsterAIProcessesLog

  StopLobsterAIProcessesDone:
  StrCpy $R2 "helper-not-found"

  StopLobsterAIProcessesLog:
  System::Call 'kernel32::GetTickCount()i .r6'
  IntOp $5 $6 - $7
  CreateDirectory "$APPDATA\LobsterAI"
  FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $9 0 END
  !insertmacro GetTimestamp $8
  !ifdef BUILD_UNINSTALLER
    FileWrite $9 "$8 phase=process-stop-complete attempt_id=$lobsterInstallerAttemptId role=uninstaller pid=$lobsterCurrentProcessPid status=$lobsterTargetProcessesStopStatus exit=$R2 elapsed_ms=$5$\r$\n"
  !else
    FileWrite $9 "$8 phase=process-stop-complete attempt_id=$lobsterInstallerAttemptId role=installer pid=$lobsterCurrentProcessPid status=$lobsterTargetProcessesStopStatus exit=$R2 elapsed_ms=$5$\r$\n"
  !endif
  FileClose $9
!macroend

!macro customInit
  ; Diagnostics only -- .onInit runs before the user has confirmed anything,
  ; so this macro must stay non-destructive.
  !insertmacro EnsureInstallerAttemptId
  StrCpy $lobsterInvocationSource "unknown"
  StrCpy $lobsterUpdatedFlag "absent"
  StrCpy $lobsterUiMode "${LOBSTER_INSTALL_UI_MODE_WIZARD}"
  StrCpy $lobsterLauncherFallback "unknown"
  StrCpy $lobsterInstallerTerminalFailureKind ""
  StrCpy $lobsterInstallerTerminalOutcome ""
  StrCpy $lobsterInstallerTerminalExitCode "0"
  StrCpy $lobsterInstallerTerminalPageState "not-required"
  StrCpy $lobsterInstallerTerminalTitle ""
  StrCpy $lobsterInstallerTerminalText ""
  StrCpy $lobsterInstallerTerminalLinkText ""
  StrCpy $lobsterInstallerTerminalOpenPath ""
  StrCpy $lobsterOldAppExecutionTrust "not-evaluated-p0.5"
  StrCpy $lobsterInstallAction ""
  StrCpy $lobsterInstallActionBasis ""
  StrCpy $lobsterPreflightCandidateDir ""
  StrCpy $lobsterPreflightConflictDir ""
  StrCpy $lobsterPreflightDirState "not-scanned"
  StrCpy $lobsterPreflightEntryCount "0"
  StrCpy $lobsterPreflightEntrySample ""
  StrCpy $lobsterPreflightFootprint "none"
  StrCpy $lobsterPreflightStaleCleaned "none"
  StrCpy $lobsterPreflightRegistryEvidence ""
  StrCpy $lobsterPreflightRegistryError "none"
  StrCpy $lobsterUninstallEntryProbeError "none"
  StrCpy $lobsterInstallerSuccessLinkText ""
  ${If} ${isUpdated}
    StrCpy $lobsterUpdatedFlag "present"
  ${EndIf}
  ${If} ${isUpdated}
  ${AndIf} ${isForceRun}
    StrCpy $lobsterInvocationSource "app-update"
    StrCpy $lobsterLauncherFallback "none"
  ${EndIf}
  ${If} ${Silent}
    StrCpy $lobsterUiMode "${LOBSTER_INSTALL_UI_MODE_SILENT}"
  ${ElseIf} ${isUpdated}
    StrCpy $lobsterUiMode "${LOBSTER_INSTALL_UI_MODE_PROGRESS_VISIBLE}"
  ${EndIf}
  CreateDirectory "$APPDATA\LobsterAI"
  FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $9 0 END
  !insertmacro GetTimestamp $8
  FileWrite $9 "$8 phase=custom-init-start attempt_id=$lobsterInstallerAttemptId installer_version=${VERSION} invocation_source=$lobsterInvocationSource updated_flag=$lobsterUpdatedFlag ui_mode=$lobsterUiMode launcher_fallback=$lobsterLauncherFallback instdir=$INSTDIR appdata=$APPDATA$\r$\n"
  FileClose $9
!macroend

!ifndef BUILD_UNINSTALLER
  ; electron-builder's assisted installer expands customFinishPage after the
  ; install-files page. The first MUI finish page is a terminal guard result
  ; and skips itself for success or /S. The second preserves the stock success
  ; finish page for ordinary interactive installs and skips itself for
  ; --updated or any terminal failure.
  !macro customFinishPage
    Function lobsterTerminalFinishPre
      IfSilent LobsterTerminalFinishSkip 0
      StrCmp $lobsterInstallerTerminalFailureKind "" LobsterTerminalFinishSkip
        StrCpy $lobsterInstallerTerminalPageState "visible"
        Return
      LobsterTerminalFinishSkip:
        Abort
    FunctionEnd

    Function lobsterTerminalFinishLeave
      Call lobsterCompleteTerminalResult
    FunctionEnd

    !define MUI_PAGE_CUSTOMFUNCTION_PRE lobsterTerminalFinishPre
    !define MUI_PAGE_CUSTOMFUNCTION_LEAVE lobsterTerminalFinishLeave
    !define MUI_FINISHPAGE_TITLE "$lobsterInstallerTerminalTitle"
    !define MUI_FINISHPAGE_TITLE_3LINES
    !define MUI_FINISHPAGE_TEXT "$lobsterInstallerTerminalText"
    !define MUI_FINISHPAGE_TEXT_LARGE
    !define MUI_FINISHPAGE_LINK "$lobsterInstallerTerminalLinkText"
    !define MUI_FINISHPAGE_LINK_LOCATION "$lobsterInstallerTerminalOpenPath"
    !define MUI_FINISHPAGE_NOREBOOTSUPPORT
    !insertmacro MUI_PAGE_FINISH

    Function lobsterSuccessFinishPre
      StrCmp $lobsterInstallerTerminalFailureKind "" 0 LobsterSuccessFinishSkip
      ${If} ${isUpdated}
        Goto LobsterSuccessFinishSkip
      ${EndIf}
      ; After a staged replacement the whole previous tree is preserved next
      ; to the install dir; surface that location on the success page.
      StrCpy $lobsterInstallerSuccessLinkText ""
      StrCmp $lobsterOldInstallRenameStatus "committed" 0 LobsterSuccessFinishLinkReady
      StrCmp $lobsterOldInstallBackupPath "" LobsterSuccessFinishLinkReady
        StrCmp $LANGUAGE 2052 0 +3
          StrCpy $lobsterInstallerSuccessLinkText "${LOBSTER_INSTALL_OPEN_BACKUP_ZH}"
          Goto LobsterSuccessFinishLinkReady
        StrCpy $lobsterInstallerSuccessLinkText "${LOBSTER_INSTALL_OPEN_BACKUP_EN}"
      LobsterSuccessFinishLinkReady:
      Return
      LobsterSuccessFinishSkip:
        Abort
    FunctionEnd

    Function lobsterSuccessFinishShow
      StrCmp $lobsterInstallerSuccessLinkText "" 0 LobsterSuccessFinishShowDone
      ShowWindow $mui.FinishPage.Link 0
      LobsterSuccessFinishShowDone:
    FunctionEnd

    Function lobsterFinishStartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    !define MUI_PAGE_CUSTOMFUNCTION_PRE lobsterSuccessFinishPre
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW lobsterSuccessFinishShow
    !define MUI_FINISHPAGE_LINK "$lobsterInstallerSuccessLinkText"
    !define MUI_FINISHPAGE_LINK_LOCATION "$lobsterOldInstallBackupPath"
    !ifndef HIDE_RUN_AFTER_FINISH
      !define MUI_FINISHPAGE_RUN
      !define MUI_FINISHPAGE_RUN_FUNCTION "lobsterFinishStartApp"
    !endif
    !insertmacro MUI_PAGE_FINISH
  !macroend
!endif

!ifndef BUILD_UNINSTALLER
  ; Resolve one UninstallString registry value to the directory containing a
  ; still-existing uninstaller binary. Input: $R8 = raw registry value.
  ; Output: $R7 = absent | live | stale | unknown; $R9 = containing directory
  ; when live, otherwise ""; $lobsterUninstallEntryProbeError = classification
  ; detail. Only a closed quoted path plus ERROR_FILE_NOT_FOUND or
  ; ERROR_PATH_NOT_FOUND can prove a missing binary stale. Other probe errors,
  ; directories, and ambiguous executable/argument boundaries fail closed as
  ; unknown. Parsed before LogicLib is included: StrCmp/Goto only.
  Function lobsterResolveUninstallEntry
    Push $0
    Push $1
    Push $2
    Push $3

    StrCpy $R9 ""
    StrCpy $R7 "${LOBSTER_UNINSTALL_ENTRY_ABSENT}"
    StrCpy $lobsterUninstallEntryProbeError "none"
    StrCmp $R8 "" LobsterResolveUninstallEntryDone

    StrCpy $R7 "${LOBSTER_UNINSTALL_ENTRY_UNKNOWN}"
    StrCpy $lobsterUninstallEntryProbeError "unparseable"
    StrCpy $0 $R8
    StrCpy $1 $0 1
    StrCmp $1 '"' 0 LobsterResolveUninstallEntryUnquoted
      StrCpy $1 1
      LobsterResolveUninstallEntryQuoteLoop:
        StrCpy $2 $0 1 $1
        StrCmp $2 "" LobsterResolveUninstallEntryDone
        StrCmp $2 '"' LobsterResolveUninstallEntryQuoteEnd
        IntOp $1 $1 + 1
        Goto LobsterResolveUninstallEntryQuoteLoop
      LobsterResolveUninstallEntryQuoteEnd:
        IntOp $2 $1 - 1
        StrCpy $0 $0 $2 1
        StrCmp $0 "" LobsterResolveUninstallEntryDone
        StrCpy $3 "quoted"
        Goto LobsterResolveUninstallEntryProbe

    LobsterResolveUninstallEntryUnquoted:
    StrCmp $0 "" LobsterResolveUninstallEntryDone
    StrCpy $3 "unquoted"

    LobsterResolveUninstallEntryProbe:
      System::Call 'kernel32::GetFileAttributesW(w "$0") i .r1 ?e'
      Pop $2
      IntCmp $1 -1 LobsterResolveUninstallEntryProbeFailed
      IntOp $1 $1 & 0x10
      IntCmp $1 0 LobsterResolveUninstallEntryLive
        StrCpy $lobsterUninstallEntryProbeError "target-is-directory"
        Goto LobsterResolveUninstallEntryDone

    LobsterResolveUninstallEntryProbeFailed:
      StrCpy $lobsterUninstallEntryProbeError "win32:$2"
      StrCmp $3 "quoted" 0 LobsterResolveUninstallEntryDone
      IntCmp $2 ${LOBSTER_WIN32_ERROR_FILE_NOT_FOUND} LobsterResolveUninstallEntryStale
      IntCmp $2 ${LOBSTER_WIN32_ERROR_PATH_NOT_FOUND} LobsterResolveUninstallEntryStale
      Goto LobsterResolveUninstallEntryDone

    LobsterResolveUninstallEntryStale:
      StrCpy $R7 "${LOBSTER_UNINSTALL_ENTRY_STALE}"
      Goto LobsterResolveUninstallEntryDone

    LobsterResolveUninstallEntryLive:
      StrCpy $R7 "${LOBSTER_UNINSTALL_ENTRY_LIVE}"
      StrCpy $lobsterUninstallEntryProbeError "none"
      ${GetParent} $0 $R9

    LobsterResolveUninstallEntryDone:
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd

  ; Compose the evidence-bearing terminal page for a preflight
  ; blocked-conflict decision. Selected by basis + $LANGUAGE.
  ; lobsterAbortOldTreeExecution keeps pre-composed text untouched unless the
  ; outcome escalates to recovery-required.
  Function lobsterPrepareBlockedTerminalText
    Push $0
    Push $1

    StrCpy $0 ""
    StrCpy $1 ""
    StrCmp $LANGUAGE 2052 LobsterBlockedTextChinese

    StrCmp $lobsterInstallActionBasis "dual-registration-paths" LobsterBlockedTextDualEn
    StrCmp $lobsterInstallActionBasis "relocate-existing-install" LobsterBlockedTextRelocateEn
    StrCmp $lobsterInstallActionBasis "target-scan-error" LobsterBlockedTextScanEn
    StrCmp $lobsterInstallActionBasis "stale-registration-cleanup-failed" LobsterBlockedTextScanEn
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_UNPROVEN_EN}"
      StrCmp $lobsterPreflightEntrySample "" LobsterBlockedTextComposeEn
      StrCpy $1 "$\r$\n$\r$\n${LOBSTER_INSTALL_BLOCKED_ITEMS_A_EN}$lobsterPreflightEntryCount${LOBSTER_INSTALL_BLOCKED_ITEMS_B_EN}$lobsterPreflightEntrySample"
      Goto LobsterBlockedTextComposeEn
    LobsterBlockedTextDualEn:
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_DUAL_EN}"
      StrCpy $1 "$\r$\n$\r$\n${LOBSTER_INSTALL_EXISTING_AT_EN}$lobsterPreflightCandidateDir$\r$\n${LOBSTER_INSTALL_EXISTING_AT_EN}$lobsterPreflightConflictDir"
      Goto LobsterBlockedTextComposeEn
    LobsterBlockedTextRelocateEn:
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_RELOCATE_EN}"
      StrCpy $1 "$\r$\n$\r$\n${LOBSTER_INSTALL_EXISTING_AT_EN}$lobsterPreflightCandidateDir"
      Goto LobsterBlockedTextComposeEn
    LobsterBlockedTextScanEn:
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_SCAN_EN}"
      StrCpy $1 "$\r$\n$\r$\nstate=$lobsterPreflightDirState basis=$lobsterInstallActionBasis registry_error=$lobsterPreflightRegistryError"
    LobsterBlockedTextComposeEn:
      StrCpy $lobsterInstallerTerminalTitle "${LOBSTER_INSTALL_BLOCKED_TITLE_EN}"
      StrCpy $lobsterInstallerTerminalLinkText "${LOBSTER_INSTALL_OPEN_PRESERVED_EN}"
      Goto LobsterBlockedTextFinish

    LobsterBlockedTextChinese:
    StrCmp $lobsterInstallActionBasis "dual-registration-paths" LobsterBlockedTextDualZh
    StrCmp $lobsterInstallActionBasis "relocate-existing-install" LobsterBlockedTextRelocateZh
    StrCmp $lobsterInstallActionBasis "target-scan-error" LobsterBlockedTextScanZh
    StrCmp $lobsterInstallActionBasis "stale-registration-cleanup-failed" LobsterBlockedTextScanZh
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_UNPROVEN_ZH}"
      StrCmp $lobsterPreflightEntrySample "" LobsterBlockedTextComposeZh
      StrCpy $1 "$\r$\n$\r$\n${LOBSTER_INSTALL_BLOCKED_ITEMS_A_ZH}$lobsterPreflightEntryCount${LOBSTER_INSTALL_BLOCKED_ITEMS_B_ZH}$lobsterPreflightEntrySample"
      Goto LobsterBlockedTextComposeZh
    LobsterBlockedTextDualZh:
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_DUAL_ZH}"
      StrCpy $1 "$\r$\n$\r$\n${LOBSTER_INSTALL_EXISTING_AT_ZH}$lobsterPreflightCandidateDir$\r$\n${LOBSTER_INSTALL_EXISTING_AT_ZH}$lobsterPreflightConflictDir"
      Goto LobsterBlockedTextComposeZh
    LobsterBlockedTextRelocateZh:
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_RELOCATE_ZH}"
      StrCpy $1 "$\r$\n$\r$\n${LOBSTER_INSTALL_EXISTING_AT_ZH}$lobsterPreflightCandidateDir"
      Goto LobsterBlockedTextComposeZh
    LobsterBlockedTextScanZh:
      StrCpy $0 "${LOBSTER_INSTALL_BLOCKED_SCAN_ZH}"
      StrCpy $1 "$\r$\n$\r$\nstate=$lobsterPreflightDirState basis=$lobsterInstallActionBasis registry_error=$lobsterPreflightRegistryError"
    LobsterBlockedTextComposeZh:
      StrCpy $lobsterInstallerTerminalTitle "${LOBSTER_INSTALL_BLOCKED_TITLE_ZH}"
      StrCpy $lobsterInstallerTerminalLinkText "${LOBSTER_INSTALL_OPEN_PRESERVED_ZH}"

    LobsterBlockedTextFinish:
    StrCpy $lobsterInstallerTerminalText "$0$1$\r$\n$\r$\n$INSTDIR"
    Pop $1
    Pop $0
  FunctionEnd

  ; Append one UTF-16LE line to the evidence log so non-ASCII paths and entry
  ; names survive; install-timing.log stays ASCII-safe enums. Clobbers $7-$9.
  !macro LobsterWriteEvidenceLine LINE
    FileOpen $9 "$APPDATA\LobsterAI\install-evidence.log" a
    FileSeek $9 0 END $7
    IntCmp $7 0 +1 +1 +2
    FileWriteUTF16LE /BOM $9 ""
    !insertmacro GetTimestamp $8
    FileWriteUTF16LE $9 "$8 ${LINE}$\r$\n"
    FileClose $9
  !macroend

  ; Record all four registry inputs before evaluating any of them. This keeps
  ; per-root/per-value evidence available even when the first unsafe probe
  ; immediately selects the fail-closed planner exit.
  !macro LobsterRecordRegistryInput ROOT VALUE_NAME VALUEVAR TAG
    StrCmp ${VALUEVAR} "" LobsterRegistryInput${TAG}Absent
      StrCpy $lobsterPreflightRegistryEvidence "$lobsterPreflightRegistryEvidence ${ROOT}-${VALUE_NAME}=present"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${ROOT} value=${VALUE_NAME} state=present raw_path=[${VALUEVAR}]"
      Goto LobsterRegistryInput${TAG}Done
    LobsterRegistryInput${TAG}Absent:
      StrCpy $lobsterPreflightRegistryEvidence "$lobsterPreflightRegistryEvidence ${ROOT}-${VALUE_NAME}=absent"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${ROOT} value=${VALUE_NAME} state=absent"
    LobsterRegistryInput${TAG}Done:
  !macroend

  ; Merge one live candidate directory into the planner state. The first
  ; distinct path becomes the candidate; a second distinct path is recorded as
  ; the conflict evidence for dual-registration blocking.
  !macro LobsterPlanMergeCandidate PATH TAG
    StrCmp $lobsterPreflightCandidateDir "" 0 LobsterPlanMerge${TAG}Compare
      StrCpy $lobsterPreflightCandidateDir "${PATH}"
      Goto LobsterPlanMerge${TAG}Done
    LobsterPlanMerge${TAG}Compare:
      StrCmp $lobsterPreflightCandidateDir "${PATH}" LobsterPlanMerge${TAG}Done
      StrCmp $lobsterPreflightConflictDir "" 0 LobsterPlanMerge${TAG}Done
        StrCpy $lobsterPreflightConflictDir "${PATH}"
    LobsterPlanMerge${TAG}Done:
  !macroend

  ; Evaluate one InstallLocation value: a live directory becomes a candidate;
  ; a value whose target no longer exists is stale and is reconciled by
  ; deleting only that registry value. Registry values never authorize file
  ; mutation on their own.
  !macro LobsterPlanInstallLocationValue HIVE TAG VALUEVAR
    StrCmp ${VALUEVAR} "" LobsterPlanLoc${TAG}Done
    System::Call 'kernel32::GetFileAttributesW(w "${VALUEVAR}") i .r4 ?e'
    Pop $6
    IntCmp $4 -1 LobsterPlanLoc${TAG}AttributeError
    IntOp $5 $4 & 0x10
    IntCmp $5 0 LobsterPlanLoc${TAG}NotDirectory
      GetFullPathName $4 "${VALUEVAR}"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${TAG} value=InstallLocation state=live normalized_path=[$4] raw_path=[${VALUEVAR}] win32_error=0"
      !insertmacro LobsterPlanMergeCandidate "$4" ${TAG}loc
      Goto LobsterPlanLoc${TAG}Done
    LobsterPlanLoc${TAG}AttributeError:
      IntCmp $6 ${LOBSTER_WIN32_ERROR_FILE_NOT_FOUND} LobsterPlanLoc${TAG}Stale
      IntCmp $6 ${LOBSTER_WIN32_ERROR_PATH_NOT_FOUND} LobsterPlanLoc${TAG}Stale
      StrCpy $lobsterPreflightRegistryError "${TAG}-install-location:$6"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${TAG} value=InstallLocation state=error raw_path=[${VALUEVAR}] win32_error=$6"
      Goto LobsterPlanRegistryProbeFailed
    LobsterPlanLoc${TAG}NotDirectory:
      StrCpy $6 "not-directory"
    LobsterPlanLoc${TAG}Stale:
      ClearErrors
      DeleteRegValue ${HIVE} "${INSTALL_REGISTRY_KEY}" InstallLocation
      IfErrors LobsterPlanLoc${TAG}CleanupFailed
      StrCpy $lobsterPreflightStaleCleaned "$lobsterPreflightStaleCleaned+${TAG}-install-location"
      !insertmacro LobsterWriteEvidenceLine "phase=stale-registration-reconciled attempt_id=$lobsterInstallerAttemptId root=${TAG} value=InstallLocation state=stale-cleaned raw_path=[${VALUEVAR}] reason=$6"
      Goto LobsterPlanLoc${TAG}Done
    LobsterPlanLoc${TAG}CleanupFailed:
      StrCpy $lobsterPreflightRegistryError "${TAG}-install-location-cleanup-failed"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${TAG} value=InstallLocation state=stale-cleanup-failed raw_path=[${VALUEVAR}] reason=$6"
      Goto LobsterPlanReconcileFailed
    LobsterPlanLoc${TAG}Done:
  !macroend

  ; Evaluate one UninstallString value: a live uninstaller nominates its
  ; directory as a candidate; a dead one is stale and its uninstall entry key
  ; is removed (an Add/Remove entry without a working uninstaller is residue).
  !macro LobsterPlanUninstallValue HIVE TAG VALUEVAR
    StrCmp ${VALUEVAR} "" LobsterPlanUn${TAG}Done
    StrCpy $R8 ${VALUEVAR}
    Call lobsterResolveUninstallEntry
    StrCmp $R7 "${LOBSTER_UNINSTALL_ENTRY_LIVE}" LobsterPlanUn${TAG}Live
    StrCmp $R7 "${LOBSTER_UNINSTALL_ENTRY_STALE}" LobsterPlanUn${TAG}Stale
      StrCpy $lobsterPreflightRegistryError "${TAG}-uninstall-string:$lobsterUninstallEntryProbeError"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${TAG} value=UninstallString state=unknown raw_path=[${VALUEVAR}] reason=$lobsterUninstallEntryProbeError"
      Goto LobsterPlanRegistryProbeFailed
    LobsterPlanUn${TAG}Live:
      GetFullPathName $4 "$R9"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${TAG} value=UninstallString state=live normalized_path=[$4] raw_path=[${VALUEVAR}]"
      !insertmacro LobsterPlanMergeCandidate "$4" ${TAG}un
      Goto LobsterPlanUn${TAG}Done
    LobsterPlanUn${TAG}Stale:
      ClearErrors
      DeleteRegKey ${HIVE} "${UNINSTALL_REGISTRY_KEY}"
      IfErrors LobsterPlanUn${TAG}CleanupFailed
      StrCpy $lobsterPreflightStaleCleaned "$lobsterPreflightStaleCleaned+${TAG}-uninstall-key"
      !insertmacro LobsterWriteEvidenceLine "phase=stale-registration-reconciled attempt_id=$lobsterInstallerAttemptId root=${TAG} value=UninstallString state=stale-cleaned raw_path=[${VALUEVAR}] reason=$lobsterUninstallEntryProbeError"
      Goto LobsterPlanUn${TAG}Done
    LobsterPlanUn${TAG}CleanupFailed:
      StrCpy $lobsterPreflightRegistryError "${TAG}-uninstall-key-cleanup-failed"
      !insertmacro LobsterWriteEvidenceLine "phase=install-root-registry-evidence attempt_id=$lobsterInstallerAttemptId root=${TAG} value=UninstallString state=stale-cleanup-failed raw_path=[${VALUEVAR}]"
      Goto LobsterPlanReconcileFailed
    LobsterPlanUn${TAG}Done:
  !macroend

  ; P0 install-root action planner. Replaces the former binary
  ; fresh/possible-existing classifier: registry evidence in both hives is
  ; collected with per-value stale reconciliation, the target directory is
  ; enumerated exactly once, footprint files are probed, and exactly one
  ; action is selected:
  ;   fresh-install      no live evidence and an absent/empty target
  ;   update-in-place    live registration matching $INSTDIR + footprint
  ;   repair-in-place    no live registration, target carries our footprint
  ;   blocked-conflict   everything else fails closed before any mutation
  ; Stale-value reconciliation is the only mutation performed here and it is
  ; registry-only; enumeration or cleanup errors fail closed.
  !macro PlanInstallRootAction
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $7
    Push $8
    Push $9
    Push $R7
    Push $R8
    Push $R9

    StrCpy $lobsterInstallAction ""
    StrCpy $lobsterInstallActionBasis ""
    StrCpy $lobsterPreflightCandidateDir ""
    StrCpy $lobsterPreflightConflictDir ""
    StrCpy $lobsterPreflightDirState "empty"
    StrCpy $lobsterPreflightEntryCount 0
    StrCpy $lobsterPreflightEntrySample ""
    StrCpy $lobsterPreflightFootprint "none"
    StrCpy $lobsterPreflightStaleCleaned "none"
    StrCpy $lobsterPreflightRegistryEvidence ""
    StrCpy $lobsterPreflightRegistryError "none"

    ReadRegStr $0 HKEY_CURRENT_USER "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $1 HKEY_LOCAL_MACHINE "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $2 HKEY_CURRENT_USER "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ReadRegStr $3 HKEY_LOCAL_MACHINE "${UNINSTALL_REGISTRY_KEY}" UninstallString
    !insertmacro LobsterRecordRegistryInput hkcu InstallLocation $0 hkcuLoc
    !insertmacro LobsterRecordRegistryInput hklm InstallLocation $1 hklmLoc
    !insertmacro LobsterRecordRegistryInput hkcu UninstallString $2 hkcuUn
    !insertmacro LobsterRecordRegistryInput hklm UninstallString $3 hklmUn
    !insertmacro LobsterPlanInstallLocationValue HKEY_CURRENT_USER hkcu $0
    !insertmacro LobsterPlanInstallLocationValue HKEY_LOCAL_MACHINE hklm $1
    !insertmacro LobsterPlanUninstallValue HKEY_CURRENT_USER hkcu $2
    !insertmacro LobsterPlanUninstallValue HKEY_LOCAL_MACHINE hklm $3

    ; .onInit already called SetOutPath, which creates an empty $INSTDIR.
    ; Enumerate real child entries instead of using IfFileExists with a
    ; wildcard: wildcard directory-existence checks misclassify that empty
    ; directory as an old install. Only a real child entry is evidence.
    ClearErrors
    FindFirst $4 $5 "$INSTDIR\*"
    IfErrors LobsterPlanEnumFirstFailed
    LobsterPlanEnumLoop:
      StrCmp $5 "." LobsterPlanEnumNext
      StrCmp $5 ".." LobsterPlanEnumNext
      StrCpy $lobsterPreflightDirState "nonempty"
      IntOp $lobsterPreflightEntryCount $lobsterPreflightEntryCount + 1
      IntCmp $lobsterPreflightEntryCount 10 LobsterPlanEnumSample LobsterPlanEnumSample LobsterPlanEnumNext
      LobsterPlanEnumSample:
        StrCpy $6 $5 60
        StrCpy $lobsterPreflightEntrySample "$lobsterPreflightEntrySample$\r$\n- $6"
    LobsterPlanEnumNext:
      ClearErrors
      FindNext $4 $5
      IfErrors LobsterPlanEnumNextFailed
      Goto LobsterPlanEnumLoop
    LobsterPlanEnumNextFailed:
      System::Call 'kernel32::GetLastError()i .r6'
      FindClose $4
      IntCmp $6 18 LobsterPlanEnumDone
      StrCpy $lobsterPreflightDirState "error:$6"
      Goto LobsterPlanEnumDone
    LobsterPlanEnumFirstFailed:
      System::Call 'kernel32::GetLastError()i .r6'
      IntCmp $6 2 LobsterPlanEnumMissing
      IntCmp $6 18 LobsterPlanEnumDone
      StrCpy $lobsterPreflightDirState "error:$6"
      Goto LobsterPlanEnumDone
    LobsterPlanEnumMissing:
      StrCpy $lobsterPreflightDirState "missing"
    LobsterPlanEnumDone:

    StrCmp $lobsterPreflightDirState "nonempty" 0 LobsterPlanFootprintDone
    IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 +2
      StrCpy $lobsterPreflightFootprint "app-executable"
    IfFileExists "$INSTDIR\${UNINSTALL_FILENAME}" 0 LobsterPlanFootprintDone
      StrCmp $lobsterPreflightFootprint "app-executable" LobsterPlanFootprintBoth
        StrCpy $lobsterPreflightFootprint "uninstaller"
        Goto LobsterPlanFootprintDone
      LobsterPlanFootprintBoth:
        StrCpy $lobsterPreflightFootprint "app-executable+uninstaller"
    LobsterPlanFootprintDone:

    StrCpy $4 $lobsterPreflightDirState 6
    StrCmp $4 "error:" LobsterPlanDecideScanError
    StrCmp $lobsterPreflightConflictDir "" 0 LobsterPlanDecideDual
    StrCmp $lobsterPreflightCandidateDir "" LobsterPlanDecideUnregistered

    StrCmp $lobsterPreflightCandidateDir $lobsterOldInstallOriginalPathNormalized 0 LobsterPlanDecideRelocate
      StrCmp $lobsterPreflightDirState "nonempty" 0 LobsterPlanDecideRegisteredEmpty
      StrCmp $lobsterPreflightFootprint "none" LobsterPlanDecideUnproven
        StrCpy $lobsterInstallAction "update-in-place"
        StrCpy $lobsterInstallActionBasis "registered-footprint-match"
        Goto LobsterPlanDecided

    LobsterPlanDecideRegisteredEmpty:
      ; Registration points at the enumerably empty target: the previous
      ; install is gone and this attempt re-registers the same path anyway.
      StrCpy $lobsterInstallAction "fresh-install"
      StrCpy $lobsterInstallActionBasis "registered-target-empty"
      Goto LobsterPlanDecided

    LobsterPlanDecideRelocate:
      StrCpy $lobsterInstallAction "blocked-conflict"
      StrCpy $lobsterInstallActionBasis "relocate-existing-install"
      Goto LobsterPlanDecided

    LobsterPlanDecideUnregistered:
      StrCmp $lobsterPreflightDirState "nonempty" 0 LobsterPlanDecideFresh
      StrCmp $lobsterPreflightFootprint "none" LobsterPlanDecideUnproven
        StrCpy $lobsterInstallAction "repair-in-place"
        StrCpy $lobsterInstallActionBasis "orphan-footprint"
        Goto LobsterPlanDecided

    LobsterPlanDecideFresh:
      StrCpy $lobsterInstallAction "fresh-install"
      StrCpy $lobsterInstallActionBasis "no-evidence"
      Goto LobsterPlanDecided

    LobsterPlanDecideUnproven:
      StrCpy $lobsterInstallAction "blocked-conflict"
      StrCpy $lobsterInstallActionBasis "unproven-content"
      Goto LobsterPlanDecided

    LobsterPlanDecideDual:
      StrCpy $lobsterInstallAction "blocked-conflict"
      StrCpy $lobsterInstallActionBasis "dual-registration-paths"
      Goto LobsterPlanDecided

    LobsterPlanDecideScanError:
      StrCpy $lobsterInstallAction "blocked-conflict"
      StrCpy $lobsterInstallActionBasis "target-scan-error"
      Goto LobsterPlanDecided

    LobsterPlanRegistryProbeFailed:
      ; An existing registry target could not be safely classified, or an
      ; UninstallString could not be parsed into a provable executable path.
      ; Preserve the registration and fail closed before filesystem mutation.
      StrCpy $lobsterInstallAction "blocked-conflict"
      StrCpy $lobsterInstallActionBasis "target-scan-error"
      Goto LobsterPlanDecided

    LobsterPlanReconcileFailed:
      ; A stale value survived its own deletion: the registry is in a state
      ; this attempt cannot reason about. Fail closed before any mutation.
      StrCpy $lobsterInstallAction "blocked-conflict"
      StrCpy $lobsterInstallActionBasis "stale-registration-cleanup-failed"

    LobsterPlanDecided:
    !insertmacro LobsterWriteEvidenceLine "phase=install-root-planned attempt_id=$lobsterInstallerAttemptId action=$lobsterInstallAction basis=$lobsterInstallActionBasis dir_state=$lobsterPreflightDirState entry_count=$lobsterPreflightEntryCount footprint=$lobsterPreflightFootprint candidate=[$lobsterPreflightCandidateDir] conflict=[$lobsterPreflightConflictDir] stale_cleaned=$lobsterPreflightStaleCleaned registry_error=$lobsterPreflightRegistryError registry=$lobsterPreflightRegistryEvidence instdir=[$INSTDIR]"
    StrCmp $lobsterPreflightEntrySample "" LobsterPlanEvidenceDone
    !insertmacro LobsterWriteEvidenceLine "phase=install-root-entries attempt_id=$lobsterInstallerAttemptId first_entries:$lobsterPreflightEntrySample"
    LobsterPlanEvidenceDone:

    Pop $R9
    Pop $R8
    Pop $R7
    Pop $9
    Pop $8
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  !macroend

  ; Relaunch is deliberately conservative. P0.5 may only execute a restored
  ; old application after the content guard has independently established an
  ; exact inventory-hash execution trust result. Registry paths, CLI flags and
  ; file existence are discovery/intent signals only. The restored app is
  ; launched with no --updated argument.
  !macro DefineLobsterOldAppRelaunchFunction
  Function lobsterTryRelaunchOldApp
    Push $0
    Push $1
    Push $8
    Push $9

    StrCmp $lobsterOldAppRelaunchStatus "not-attempted" 0 LobsterOldAppRelaunchDone
    StrCpy $lobsterOldAppRelaunchStatus "blocked"
    StrCpy $lobsterOldAppRelaunchError "execution-trust-not-established"
    StrCmp $lobsterOldAppExecutionTrust "trusted-inventory-hash" 0 LobsterOldAppRelaunchLog
    StrCpy $lobsterOldAppRelaunchError "intent-not-trusted"

    ; Read the generated command-line flags at relaunch time. This function is
    ; emitted by customHeader only after StdUtils has been registered.
    ${StdUtils.TestParameter} $0 "updated"
    StrCmp $0 "true" 0 LobsterOldAppRelaunchLog
    ${StdUtils.TestParameter} $0 "force-run"
    StrCmp $0 "true" 0 LobsterOldAppRelaunchLog
    IfSilent 0 LobsterOldAppRelaunchInteractive
      StrCpy $lobsterOldAppRelaunchError "silent-invocation"
      Goto LobsterOldAppRelaunchLog
    LobsterOldAppRelaunchInteractive:
    StrCmp $lobsterTargetProcessesStopStatus "success" 0 LobsterOldAppRelaunchProcessStateBlocked
    StrCmp $lobsterOldAppExecutablePath "" 0 +3
      StrCpy $lobsterOldAppRelaunchError "old-source-missing"
      Goto LobsterOldAppRelaunchLog

    System::Call 'kernel32::GetFileAttributesW(w "$lobsterOldAppExecutablePath") i .r0'
    IntCmp $0 -1 LobsterOldAppRelaunchFootprintBlocked 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 0 LobsterOldAppRelaunchFootprintBlocked LobsterOldAppRelaunchFootprintBlocked
    System::Call 'kernel32::GetFileAttributesW(w "$lobsterOldUninstallerPath") i .r0'
    IntCmp $0 -1 LobsterOldAppRelaunchFootprintBlocked 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 0 LobsterOldAppRelaunchFootprintBlocked LobsterOldAppRelaunchFootprintBlocked
    System::Call 'kernel32::GetFileAttributesW(w "$lobsterOldAppAsarPath") i .r0'
    IntCmp $0 -1 LobsterOldAppRelaunchFootprintBlocked 0 0
    IntOp $1 $0 & 0x410
    IntCmp $1 0 0 LobsterOldAppRelaunchFootprintBlocked LobsterOldAppRelaunchFootprintBlocked

    StrCpy $lobsterOldAppRelaunchStatus "attempted"
    StrCpy $lobsterOldAppRelaunchError "none"
    ${StdUtils.ExecShellAsUser} $0 "$lobsterOldAppExecutablePath" "open" ""
    StrCpy $lobsterOldAppRelaunchError $0
    StrCmp $0 "0" LobsterOldAppRelaunchSucceeded
      StrCpy $lobsterOldAppRelaunchStatus "old-app-relaunch-failed"
      Goto LobsterOldAppRelaunchLog
    LobsterOldAppRelaunchSucceeded:
      StrCpy $lobsterOldAppRelaunchStatus "dispatched"
    Goto LobsterOldAppRelaunchLog

    LobsterOldAppRelaunchProcessStateBlocked:
      StrCpy $lobsterOldAppRelaunchError "process-state-not-confirmed-stopped"
      Goto LobsterOldAppRelaunchLog

    LobsterOldAppRelaunchFootprintBlocked:
      StrCpy $lobsterOldAppRelaunchError "old-footprint-not-verified"

    LobsterOldAppRelaunchLog:
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=old-app-relaunch attempt_id=$lobsterInstallerAttemptId status=$lobsterOldAppRelaunchStatus result=$lobsterOldAppRelaunchError source=$lobsterOldInstallOriginalPath args=none$\r$\n"
    FileClose $9

    LobsterOldAppRelaunchDone:
    Pop $9
    Pop $8
    Pop $1
    Pop $0
  FunctionEnd
  !macroend

  ; Restore the complete previous tree whenever a controlled installer failure
  ; occurs after the fast-path rename but before the new install is committed.
  ; Direct NSIS Quit calls bypass callbacks, so patched template exit sites call
  ; customBeforeInstallerQuit explicitly; interactive failure/cancel callbacks
  ; use the same function as a second line of defence.
  Function lobsterRollbackOldInstall
    Push $0
    Push $1
    Push $2
    Push $3
    Push $4
    Push $5
    Push $6
    Push $7
    Push $8
    Push $9

    StrCmp $lobsterOldInstallRenameStatus "success" LobsterRollbackEligible
    StrCmp $lobsterOldInstallRenameStatus "prevalidated" 0 LobsterRollbackDone
    LobsterRollbackEligible:
    StrCpy $lobsterOldInstallRollbackStatus "started"
    StrCpy $lobsterOldInstallRollbackError "0"
    StrCpy $lobsterOldInstallRenameStatus "rollback-in-progress"
    System::Call 'kernel32::GetTickCount()i .r7'
    System::Call 'kernel32::GetCurrentProcessId()i .r4'
    StrCpy $lobsterOldInstallFailedPath "$lobsterOldInstallOriginalPath.failed.$4.$7"

    InitPluginsDir
    SetOutPath "$PLUGINSDIR"

    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=old-install-rollback-start attempt_id=$lobsterInstallerAttemptId reason=$lobsterOldInstallRollbackReason source=$lobsterOldInstallOriginalPath backup=$lobsterOldInstallBackupPath displaced=$lobsterOldInstallFailedPath$\r$\n"
    FileClose $9

    ; Remove an empty target directory first. If the new payload already wrote
    ; files, move the partial tree aside so the complete backup can return to
    ; the exact registered path without destructive deletion.
    RMDir "$lobsterOldInstallOriginalPath"
    StrCpy $2 "false"
    System::Call 'kernel32::MoveFileW(w "$lobsterOldInstallOriginalPath", w "$lobsterOldInstallFailedPath") i .r0 ?e'
    Pop $1
    IntCmp $0 0 LobsterRollbackTargetMoveFailed LobsterRollbackTargetMoved LobsterRollbackTargetMoved

    LobsterRollbackTargetMoved:
      StrCpy $2 "true"
      Goto LobsterRollbackRestoreBackup

    LobsterRollbackTargetMoveFailed:
      ; ERROR_FILE_NOT_FOUND / ERROR_PATH_NOT_FOUND is expected when payload
      ; extraction had not created the target yet. The restore attempt below
      ; is the authority on whether rollback can complete.
      StrCpy $lobsterOldInstallRollbackError "target-move:$1"

    LobsterRollbackRestoreBackup:
    System::Call 'kernel32::MoveFileW(w "$lobsterOldInstallBackupPath", w "$lobsterOldInstallOriginalPath") i .r0 ?e'
    Pop $1
    IntCmp $0 0 LobsterRollbackRestoreFailed LobsterRollbackRestoreSucceeded LobsterRollbackRestoreSucceeded

    LobsterRollbackRestoreSucceeded:
      StrCpy $lobsterOldInstallRollbackStatus "success"
      StrCpy $lobsterOldInstallRollbackError "0"
      StrCpy $lobsterOldInstallRenameStatus "rolled-back"

      ; A failed update must not leave its broad, install-scope Defender
      ; exclusion protecting the restored application indefinitely.
      StrCmp $lobsterTrustedPowerShellPath "" LobsterRollbackDefenderCleanupDone
      System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_DEFENDER_TARGET", t "$lobsterOldInstallOriginalPath")i'
      nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "try { Remove-MpPreference -ExclusionPath $$env:LOBSTERAI_DEFENDER_TARGET -ErrorAction SilentlyContinue } catch {}"'
      Pop $0
      Pop $1
      System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_DEFENDER_TARGET", t "")i'
      LobsterRollbackDefenderCleanupDone:

      ; P0.5 intentionally preserves the displaced partial tree after a
      ; verified restore. Path-only asynchronous cleanup cannot prove that the
      ; object still has the identity observed by this attempt.
      StrCmp $2 "true" 0 LobsterRollbackLog
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=rollback-failed-tree-preserved attempt_id=$lobsterInstallerAttemptId path=$lobsterOldInstallFailedPath cleanup_mode=disabled-p0.5$\r$\n"
      FileClose $9
      Goto LobsterRollbackLog

    LobsterRollbackRestoreFailed:
      StrCpy $lobsterOldInstallRollbackStatus "failed"
      StrCpy $lobsterOldInstallRollbackError "backup-restore:$1"
      StrCpy $lobsterOldInstallRenameStatus "rollback-failed"

      ; If the partial tree was displaced but the complete backup could not be
      ; restored, put the partial tree back. Never delete either tree when the
      ; recovery state is ambiguous.
      StrCmp $2 "true" 0 LobsterRollbackLog
      System::Call 'kernel32::MoveFileW(w "$lobsterOldInstallFailedPath", w "$lobsterOldInstallOriginalPath") i .r0 ?e'
      Pop $3
      IntCmp $0 0 0 LobsterRollbackLog LobsterRollbackLog
      StrCpy $lobsterOldInstallRollbackError "$lobsterOldInstallRollbackError;partial-restore:$3"

    LobsterRollbackLog:
    System::Call 'kernel32::GetTickCount()i .r6'
    IntOp $5 $6 - $7
    StrCpy $2 "false"
    StrCpy $3 "false"
    IfFileExists "$lobsterOldInstallOriginalPath\*.*" 0 LobsterRollbackSourceChecked
      StrCpy $2 "true"
    LobsterRollbackSourceChecked:
    IfFileExists "$lobsterOldInstallBackupPath\*.*" 0 LobsterRollbackBackupChecked
      StrCpy $3 "true"
    LobsterRollbackBackupChecked:
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=old-install-rollback-complete attempt_id=$lobsterInstallerAttemptId status=$lobsterOldInstallRollbackStatus reason=$lobsterOldInstallRollbackReason error=$lobsterOldInstallRollbackError elapsed_ms=$5 source_exists=$2 backup_exists=$3 displaced=$lobsterOldInstallFailedPath$\r$\n"
    FileClose $9
    ; Relaunch, when independently trusted, belongs to the terminal UI owner.
    ; Rollback must finish and the result must be visible before any old-tree
    ; executable can be dispatched.

    LobsterRollbackDone:
    Pop $9
    Pop $8
    Pop $7
    Pop $6
    Pop $5
    Pop $4
    Pop $3
    Pop $2
    Pop $1
    Pop $0
  FunctionEnd

  !macro customRollbackOldInstall REASON
    StrCpy $lobsterOldInstallRollbackReason "${REASON}"
    Call lobsterRollbackOldInstall
  !macroend

  !macro customBeforeInstallerQuit REASON
    ${If} $lobsterInstallerTerminalFailureKind == ""
      !insertmacro customRollbackOldInstall "${REASON}"
    ${Else}
      ; A prepared terminal result already owns rollback/recovery. Template
      ; Quit sites may only preserve its stable typed exit code.
      Call lobsterApplyTerminalExitCode
    ${EndIf}
  !macroend

  !macro customInstallerFailed
    ${If} $lobsterInstallerTerminalFailureKind == ""
      !insertmacro customRollbackOldInstall "installer-failed"
    ${Else}
      Call lobsterApplyTerminalExitCode
    ${EndIf}
  !macroend

  !macro customInstallerUserAbort
    StrCmp $lobsterInstallerTerminalFailureKind "" LobsterInstallerUserAbortRollback
      Call lobsterCompleteTerminalResult
      Call lobsterApplyTerminalExitCode
      Goto LobsterInstallerUserAbortDone
    LobsterInstallerUserAbortRollback:
    !insertmacro customRollbackOldInstall "user-abort"
    LobsterInstallerUserAbortDone:
  !macroend
!endif

; Replaces electron-builder's built-in CHECK_APP_RUNNING. Inserted:
;  - installer: inside the install section, right after the user confirms,
;    before uninstallOldVersion and file extraction
;  - uninstaller: un.install section (assisted) or un.onInit (silent /S)
!macro customCheckAppRunning
  !ifndef BUILD_UNINSTALLER
    !insertmacro EnsureInstallerAttemptId
    StrCpy $lobsterOldInstallOriginalPath "$INSTDIR"
    GetFullPathName $lobsterOldInstallOriginalPathNormalized "$INSTDIR"
    StrCpy $lobsterOldAppExecutablePath "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    StrCpy $lobsterOldUninstallerPath "$INSTDIR\${UNINSTALL_FILENAME}"
    StrCpy $lobsterOldAppAsarPath "$INSTDIR\resources\app.asar"
    StrCpy $lobsterOldInstallRegisteredPath ""
    StrCpy $lobsterOldInstallRegisteredPathNormalized ""
    StrCpy $lobsterOldInstallBackupPath ""
    StrCpy $lobsterOldInstallFailedPath ""
    StrCpy $lobsterOldInstallRenameStatus "preflight"
    StrCpy $lobsterOldInstallRenameReason "not-evaluated"
    StrCpy $lobsterOldInstallRenameError "0"
    StrCpy $lobsterOldInstallRenameAttempts "0"
    StrCpy $lobsterOldInstallRollbackReason ""
    StrCpy $lobsterOldInstallRollbackStatus "not-needed"
    StrCpy $lobsterOldInstallRollbackError "0"
    StrCpy $lobsterNewInstallValidationStatus "not-started"
    StrCpy $lobsterNewInstallValidationReason "not-evaluated"
    StrCpy $lobsterTargetProcessesStopStatus "not-started"
    StrCpy $lobsterLegacySkillsStatus "not-inspected"
    StrCpy $lobsterLegacySkillsRestoreStatus "not-required"
    StrCpy $lobsterOldAppRelaunchStatus "not-attempted"
    StrCpy $lobsterOldAppRelaunchError "none"

    ; The planner precedes every external helper, process stop, legacy Skills
    ; action and directory rename. Its only mutation is registry-value stale
    ; reconciliation; file mutation authority never comes from it directly.
    !insertmacro PlanInstallRootAction
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=install-preflight-complete attempt_id=$lobsterInstallerAttemptId installer_version=${VERSION} invocation_source=$lobsterInvocationSource updated_flag=$lobsterUpdatedFlag ui_mode=$lobsterUiMode launcher_fallback=$lobsterLauncherFallback action=$lobsterInstallAction basis=$lobsterInstallActionBasis dir_state=$lobsterPreflightDirState entry_count=$lobsterPreflightEntryCount footprint=$lobsterPreflightFootprint stale_cleaned=$lobsterPreflightStaleCleaned registry_error=$lobsterPreflightRegistryError instdir=$INSTDIR$\r$\n"
    FileClose $9

    StrCmp $lobsterInstallAction "fresh-install" CustomCheckFreshInstall
    StrCmp $lobsterInstallAction "blocked-conflict" 0 CustomCheckExistingProceed
      ; Fail closed before any process stop, Skills backup or rename: the
      ; running application stays untouched and the terminal page carries the
      ; exact evidence that blocked this attempt.
      Call lobsterPrepareBlockedTerminalText
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=install-blocked-preflight attempt_id=$lobsterInstallerAttemptId action=$lobsterInstallAction basis=$lobsterInstallActionBasis dir_state=$lobsterPreflightDirState entry_count=$lobsterPreflightEntryCount footprint=$lobsterPreflightFootprint registry_error=$lobsterPreflightRegistryError action_taken=none$\r$\n"
      FileClose $9
      Call lobsterAbortOldTreeExecution
      ; Return ends the install Section before any destructive step. The
      ; assisted wizard advances to the terminal result page; /S exits with
      ; the stable non-zero code prepared above.
      Return
    CustomCheckExistingProceed:

    ; Record the legacy source with a native, non-following attribute check
    ; before any external helper or process stop. This is advisory only: an
    ; existing installation still has to stop its processes even when the
    ; legacy source is absent, and the source is checked again after the stop
    ; before any backup is authorized.
    StrCpy $lobsterLegacySkillsStatus "legacy-source-present"
    System::Call 'kernel32::GetFileAttributesW(w "$INSTDIR\resources\SKILLs") i .r0'
    IntCmp $0 -1 LegacySkillsSourcePreflightAbsent 0 0
    IntOp $1 $0 & 0x10
    IntCmp $1 0 LegacySkillsSourcePreflightInvalid LegacySkillsSourcePreflightDirectory LegacySkillsSourcePreflightDirectory
    LegacySkillsSourcePreflightDirectory:
    IntOp $1 $0 & 0x400
    IntCmp $1 0 LegacySkillsSourcePreflightLogged LegacySkillsSourcePreflightInvalid LegacySkillsSourcePreflightInvalid
    LegacySkillsSourcePreflightAbsent:
      StrCpy $lobsterLegacySkillsStatus "legacy-source-not-present"
      Goto LegacySkillsSourcePreflightLogged
    LegacySkillsSourcePreflightInvalid:
      StrCpy $lobsterLegacySkillsStatus "legacy-source-invalid"
    LegacySkillsSourcePreflightLogged:
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=legacy-skills-source-preflight attempt_id=$lobsterInstallerAttemptId status=$lobsterLegacySkillsStatus source=$INSTDIR\resources\SKILLs$\r$\n"
    FileClose $9

    !insertmacro ResolveTrustedPowerShell
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=system-tool-resolved attempt_id=$lobsterInstallerAttemptId tool=powershell status=$lobsterTrustedPowerShellStatus source=$lobsterTrustedPowerShellSource path=$lobsterTrustedPowerShellPath$\r$\n"
    FileClose $9

    !insertmacro stopLobsterAIProcesses
    StrCmp $lobsterTargetProcessesStopStatus "success" TargetProcessesStopped
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=install-failed-before-mutation attempt_id=$lobsterInstallerAttemptId failure_kind=process-stop-failed raw_status=$lobsterTargetProcessesStopStatus exit=$R2 action=old-install-untouched$\r$\n"
      FileClose $9
      ${If} ${Silent}
        Banner::destroy
      ${EndIf}
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update stopped before replacing the previous version because the old application processes could not be confirmed stopped. Please close LobsterAI and retry. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      SetErrorLevel 2
      Quit
    TargetProcessesStopped:

    ; -- Backup user-created skills to AppData before extraction overwrites them --
    ; Copy non-bundled skills to %APPDATA%\LobsterAI\skills-backup\ so they are
    ; preserved when NSIS extracts the new version over the existing install.
    ; The backup is restored in customInstall after extraction completes.
    ; Must run before the $INSTDIR rename below -- it reads from $INSTDIR.
    ;
    ; Quoting note: paths use \"..\" (backslash-escaped quote) -- NOT $\"..$\" --
    ; because $\"..$\" produces raw quotes that Windows CRT argv parsing consumes,
    ; leaving the path unquoted and causing PowerShell method calls to fail.
    ; A missing legacy source is an allowed result and never launches
    ; PowerShell. Empty-but-present directories still go through inspection.
    System::Call 'kernel32::GetTickCount()i .r7'
    System::Call 'kernel32::GetFileAttributesW(w "$INSTDIR\resources\SKILLs") i .r0'
    IntCmp $0 -1 SkillBackupSourceAbsent 0 0
    IntOp $1 $0 & 0x10
    IntCmp $1 0 SkillBackupInspectFailed SkillBackupSourceTypeReady SkillBackupSourceTypeReady
    SkillBackupSourceTypeReady:
    IntOp $1 $0 & 0x400
    IntCmp $1 0 SkillBackupSourceReady SkillBackupInspectFailed SkillBackupInspectFailed

    SkillBackupSourceAbsent:
      StrCpy $lobsterLegacySkillsStatus "legacy-source-not-present"
      StrCpy $R2 "0"
      Goto SkillBackupResultLog

    SkillBackupInspectFailed:
      StrCpy $lobsterLegacySkillsStatus "legacy-inspect-failed"
      StrCpy $R2 "invalid-source-attributes"
      Goto SkillBackupResultLog

    SkillBackupSourceReady:
    DetailPrint "[Installer] Backing up user-created skills"
    ClearErrors
    FileOpen $R0 "$APPDATA\LobsterAI\skill-migrate.log" w
    IfErrors BackupLogOpenFailed
      !insertmacro GetTimestamp $8
      FileWrite $R0 "$8 phase=backup-start attempt_id=$lobsterInstallerAttemptId instdir=$INSTDIR appdata=$APPDATA$\r$\n"
      Goto BackupDoExec
    BackupLogOpenFailed:
      StrCpy $R0 ""
    BackupDoExec:

    ReadRegStr $4 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_SOURCE", t "$INSTDIR\resources\SKILLs")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_BACKUP_ROOT", t "$APPDATA\LobsterAI\skills-backup")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ATTEMPT_ID", t "$lobsterInstallerAttemptId")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_OLD_VERSION", t "$4")i'
    nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "\
      $$ErrorActionPreference = \"Stop\";\
      $$src       = $$env:LOBSTERAI_SKILL_SOURCE;\
      $$root      = $$env:LOBSTERAI_SKILL_BACKUP_ROOT;\
      $$attempt   = $$env:LOBSTERAI_INSTALL_ATTEMPT_ID;\
      $$oldVer    = $$env:LOBSTERAI_OLD_VERSION;\
      $$backup    = Join-Path $$root $$attempt;\
      $$staging   = $$backup + \".new\";\
      $$manifest  = Join-Path $$staging \"backup-manifest.json\";\
      $$config    = Join-Path $$src \"skills.config.json\";\
      $$phase   = \"inspect\";\
      try {\
        if ([string]::IsNullOrWhiteSpace($$attempt)) { throw \"attempt id missing\" };\
        if (-not (Test-Path -LiteralPath $$src -PathType Container)) { throw \"legacy source disappeared\" };\
        $$bundled = @(try {\
          if (Test-Path -LiteralPath $$config -PathType Leaf) {\
            (Get-Content -LiteralPath $$config -Raw | ConvertFrom-Json).defaults.PSObject.Properties.Name\
          }\
        } catch { });\
        $$userSkills = @(Get-ChildItem -LiteralPath $$src -Directory -ErrorAction Stop | Where-Object { $$bundled -notcontains $$_.Name });\
        if ($$userSkills.Count -eq 0) { Write-Output \"legacy-no-user-skills\"; exit 0 };\
        $$phase = \"backup-copy\";\
        if (Test-Path -LiteralPath $$staging) { Remove-Item -LiteralPath $$staging -Recurse -Force -ErrorAction Stop };\
        if (Test-Path -LiteralPath $$backup) { throw \"attempt backup already exists\" };\
        New-Item -ItemType Directory -Path $$staging -Force -ErrorAction Stop | Out-Null;\
        $$userSkills | ForEach-Object {\
          Copy-Item -LiteralPath $$_.FullName -Destination (Join-Path $$staging $$_.Name) -Recurse -Force -ErrorAction Stop\
        };\
        Set-Content -LiteralPath (Join-Path $$staging \".attempt-id\") -Value $$attempt -NoNewline -ErrorAction Stop;\
        $$directories = @(Get-ChildItem -LiteralPath $$staging -Directory -Recurse -Force -ErrorAction Stop | Sort-Object FullName | ForEach-Object {\
          $$_.FullName.Substring($$staging.Length).TrimStart([IO.Path]::DirectorySeparatorChar).Replace([IO.Path]::DirectorySeparatorChar, [char]47)\
        });\
        $$files = @(Get-ChildItem -LiteralPath $$staging -File -Recurse -Force -ErrorAction Stop | Where-Object { $$_.Name -ne \"backup-manifest.json\" } | Sort-Object FullName | ForEach-Object {\
          [ordered]@{\
            path = $$_.FullName.Substring($$staging.Length).TrimStart([IO.Path]::DirectorySeparatorChar).Replace([IO.Path]::DirectorySeparatorChar, [char]47);\
            length = $$_.Length;\
            sha256 = (Get-FileHash -LiteralPath $$_.FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant()\
          }\
        });\
        $$payload = [ordered]@{\
          schemaVersion = 1;\
          attemptId = $$attempt;\
          source = $$src;\
          oldVersion = $$oldVer;\
          createdAt = (Get-Date).ToUniversalTime().ToString(\"o\");\
          skills = @($$userSkills.Name | Sort-Object);\
          directories = $$directories;\
          files = $$files;\
          statistics = [ordered]@{\
            skillCount = $$userSkills.Count;\
            directoryCount = $$directories.Count;\
            fileCount = $$files.Count;\
            totalBytes = [long](($$files | Measure-Object -Property length -Sum).Sum)\
          };\
          validation = [ordered]@{ status = \"created\"; algorithm = \"SHA256\" }\
        };\
        $$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $$manifest -Encoding UTF8 -ErrorAction Stop;\
        Move-Item -LiteralPath $$staging -Destination $$backup -ErrorAction Stop;\
        $$phase = \"backup-verify\";\
        $$manifest = Join-Path $$backup \"backup-manifest.json\";\
        $$verified = Get-Content -LiteralPath $$manifest -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop;\
        if ($$verified.schemaVersion -ne 1) { throw \"manifest schema mismatch\" };\
        if ($$verified.attemptId -ne $$attempt) { throw \"manifest attempt mismatch\" };\
        if ($$verified.source -ne $$src) { throw \"manifest source mismatch\" };\
        if (@($$verified.skills).Count -ne $$userSkills.Count) { throw \"manifest skill count mismatch\" };\
        foreach ($$skill in @($$verified.skills)) {\
          if (-not (Test-Path -LiteralPath (Join-Path $$backup $$skill) -PathType Container)) { throw \"manifest skill missing\" }\
        };\
        foreach ($$file in @($$verified.files)) {\
          $$candidate = Join-Path $$backup ($$file.path.Replace([char]47, [IO.Path]::DirectorySeparatorChar));\
          if (-not (Test-Path -LiteralPath $$candidate -PathType Leaf)) { throw \"manifest file missing\" };\
          if ((Get-FileHash -LiteralPath $$candidate -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -ne $$file.sha256) { throw \"manifest hash mismatch\" }\
        };\
        $$verified.validation.status = \"verified\";\
        $$verified.validation | Add-Member -NotePropertyName verifiedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString(\"o\")) -Force;\
        $$verified | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $$manifest -Encoding UTF8 -ErrorAction Stop;\
        $$finalManifest = Get-Content -LiteralPath $$manifest -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop;\
        if (($$finalManifest.attemptId -ne $$attempt) -or ($$finalManifest.validation.status -ne \"verified\")) { throw \"manifest final validation mismatch\" };\
        Write-Output (\"legacy-backup-succeeded skills=\" + $$finalManifest.statistics.skillCount + \" files=\" + $$finalManifest.statistics.fileCount + \" directories=\" + $$finalManifest.statistics.directoryCount + \" bytes=\" + $$finalManifest.statistics.totalBytes);\
        exit 0\
      } catch {\
        if (Test-Path -LiteralPath $$staging) { Remove-Item -LiteralPath $$staging -Recurse -Force -ErrorAction SilentlyContinue };\
        if ($$phase -eq \"inspect\") { Write-Output \"legacy-inspect-failed\"; exit 10 };\
        if ($$phase -eq \"backup-verify\") { Write-Output \"legacy-backup-verify-failed\"; exit 12 };\
        Write-Output \"legacy-backup-copy-failed\";\
        exit 11\
      }"'
    Pop $0
    Pop $1
    StrCpy $R2 $0
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_SOURCE", t "")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_BACKUP_ROOT", t "")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ATTEMPT_ID", t "")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_OLD_VERSION", t "")i'
    System::Call 'kernel32::GetTickCount()i .r6'
    IntOp $5 $6 - $7

    StrCmp $R0 "" BackupSkipCloseLog
      !insertmacro GetTimestamp $8
      FileWrite $R0 "$8 phase=backup-end attempt_id=$lobsterInstallerAttemptId exit=$R2 elapsed_ms=$5$\r$\n"
      FileWrite $R0 "$8 phase=backup-output attempt_id=$lobsterInstallerAttemptId text=$1$\r$\n"
      FileClose $R0
    BackupSkipCloseLog:
    StrCpy $lobsterLegacySkillsStatus "legacy-backup-copy-failed"
    StrCmp $R2 "error" 0 +3
      StrCpy $lobsterLegacySkillsStatus "legacy-helper-launch-failed"
      Goto SkillBackupResultLog
    StrCmp $R2 "0" 0 +4
      StrCpy $lobsterLegacySkillsStatus "legacy-backup-succeeded"
      StrCmp $1 "legacy-no-user-skills" 0 SkillBackupResultLog
      StrCpy $lobsterLegacySkillsStatus "legacy-no-user-skills"
    StrCmp $R2 "10" 0 +2
      StrCpy $lobsterLegacySkillsStatus "legacy-inspect-failed"
    StrCmp $R2 "11" 0 +2
      StrCpy $lobsterLegacySkillsStatus "legacy-backup-copy-failed"
    StrCmp $R2 "12" 0 +2
      StrCpy $lobsterLegacySkillsStatus "legacy-backup-verify-failed"

    SkillBackupResultLog:
    System::Call 'kernel32::GetTickCount()i .r6'
    IntOp $5 $6 - $7
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=skill-backup-complete attempt_id=$lobsterInstallerAttemptId status=$lobsterLegacySkillsStatus exit=$R2 elapsed_ms=$5 backup=$APPDATA\LobsterAI\skills-backup\$lobsterInstallerAttemptId$\r$\n"
    FileClose $9

    ; User-created skills live inside the installation tree. If their backup
    ; did not complete, stop before the directory swap so the only authoritative
    ; copy remains untouched. An update that fails closed is recoverable; a
    ; fast update that silently drops user data is not.
    StrCmp $lobsterLegacySkillsStatus "legacy-source-not-present" SkillBackupValidated
    StrCmp $lobsterLegacySkillsStatus "legacy-no-user-skills" SkillBackupValidated
    StrCmp $lobsterLegacySkillsStatus "legacy-backup-succeeded" SkillBackupValidated
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=skill-backup-failed-abort attempt_id=$lobsterInstallerAttemptId status=$lobsterLegacySkillsStatus exit=$R2 action=old-install-preserved$\r$\n"
      FileClose $9
      ${If} ${Silent}
        Banner::destroy
      ${EndIf}
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update stopped because legacy user skills could not be safely inspected or backed up (status=$lobsterLegacySkillsStatus). The previous installation was not replaced. Please retry the update. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      SetErrorLevel 2
      Quit
    SkillBackupValidated:

    ; -- Move the previous installation out of the target path --
    ;
    ; electron-builder's .onInit calls SetOutPath $INSTDIR. On Windows that
    ; makes $INSTDIR the installer's current directory, which prevents the
    ; directory itself from being renamed. Move the current directory to the
    ; plugin temp directory before attempting the update fast path.
    ;
    ; The fast path is deliberately limited to an in-app update whose selected
    ; registry root owns this exact install directory. Manual reinstalls and
    ; ambiguous/mismatched installs retain electron-builder's old-uninstaller
    ; fallback. A successful backup is not deleted until customInstall runs,
    ; so extraction does not compete with a recursive old-tree deletion.
    DetailPrint "[Installer] Preparing previous installation for replacement"
    System::Call 'kernel32::GetTickCount()i .r7'
    StrCpy $lobsterOldInstallOriginalPath "$INSTDIR"
    GetFullPathName $lobsterOldInstallOriginalPathNormalized "$INSTDIR"
    StrCpy $lobsterOldInstallRegisteredPath ""
    StrCpy $lobsterOldInstallRegisteredPathNormalized ""
    StrCpy $lobsterOldInstallBackupPath ""
    StrCpy $lobsterOldInstallFailedPath ""
    StrCpy $lobsterOldInstallRenameStatus "not-applicable"
    StrCpy $lobsterOldInstallRenameReason "not-updated"
    StrCpy $lobsterOldInstallRenameError "0"
    StrCpy $lobsterOldInstallRenameAttempts "0"
    StrCpy $lobsterOldInstallRollbackReason ""
    StrCpy $lobsterOldInstallRollbackStatus "not-needed"
    StrCpy $lobsterOldInstallRollbackError "0"

    ClearErrors
    ReadRegStr $lobsterOldInstallRegisteredPath SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" InstallLocation
    StrCmp $lobsterOldInstallRegisteredPath "" OldInstallRegisteredPathReady
      GetFullPathName $lobsterOldInstallRegisteredPathNormalized "$lobsterOldInstallRegisteredPath"
    OldInstallRegisteredPathReady:

    GetFullPathName $lobsterOldInstallCurrentDirectory "."
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"

    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=old-install-rename-start attempt_id=$lobsterInstallerAttemptId instdir=$lobsterOldInstallOriginalPath registered_instdir=$lobsterOldInstallRegisteredPath current_directory=$lobsterOldInstallCurrentDirectory install_mode=$installMode$\r$\n"
    FileClose $9

    ; Staging is driven by the planner: only footprint-verified trees mapped
    ; to update-in-place or repair-in-place may be moved aside. Same-path dual
    ; registration is staged once and re-registered by this install; distinct
    ; dual paths and relocations were already blocked before this point. The
    ; footprint is re-checked here because processes were stopped between
    ; planning and this mutation.
    StrCpy $lobsterOldInstallRenameReason "action-not-staging"
    StrCmp $lobsterInstallAction "update-in-place" OldInstallRenameActionEligible
    StrCmp $lobsterInstallAction "repair-in-place" OldInstallRenameActionEligible
    Goto OldInstallRenameComplete
    OldInstallRenameActionEligible:

    StrCpy $lobsterOldInstallRenameReason "install-files-missing"
    IfFileExists "$lobsterOldInstallOriginalPath\${APP_EXECUTABLE_FILENAME}" OldInstallRenameEligible
    IfFileExists "$lobsterOldInstallOriginalPath\${UNINSTALL_FILENAME}" OldInstallRenameEligible
    Goto OldInstallRenameComplete

    OldInstallRenameEligible:
      StrCpy $lobsterOldInstallRenameStatus "failed"
      StrCpy $lobsterOldInstallRenameReason "rename-failed"
      System::Call 'kernel32::GetCurrentProcessId()i .r4'
      StrCpy $lobsterCurrentProcessPid $4
      System::Call 'kernel32::GetTickCount()i .r4'
      StrCpy $lobsterOldInstallBackupPath "$lobsterOldInstallOriginalPath.old.$lobsterCurrentProcessPid.$4"

    OldInstallRenameAttempt:
      IntOp $lobsterOldInstallRenameAttempts $lobsterOldInstallRenameAttempts + 1
      ; Capture the Win32 error in the same System plug-in invocation as the
      ; move. GetLastError after an NSIS Rename/logging call can be stale.
      System::Call 'kernel32::MoveFileW(w "$lobsterOldInstallOriginalPath", w "$lobsterOldInstallBackupPath") i .r4 ?e'
      Pop $lobsterOldInstallRenameError
      IntCmp $4 0 OldInstallRenameAttemptFailed OldInstallRenameAttemptSucceeded OldInstallRenameAttemptSucceeded

    OldInstallRenameAttemptSucceeded:
      StrCpy $lobsterOldInstallRenameStatus "success"

      ; Rename success is only accepted when the source tree is gone and the
      ; complete backup tree is visible at the unique destination.
      IfFileExists "$lobsterOldInstallOriginalPath\*.*" OldInstallRenameVerificationFailed
      IfFileExists "$lobsterOldInstallBackupPath\*.*" 0 OldInstallRenameVerificationFailed
      StrCpy $lobsterOldInstallRenameStatus "success"
      StrCpy $lobsterOldInstallRenameReason "renamed"
      StrCpy $lobsterOldInstallRenameError "0"
      Goto OldInstallRenameComplete

    OldInstallRenameAttemptFailed:
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=old-install-rename-attempt attempt_id=$lobsterInstallerAttemptId attempt=$lobsterOldInstallRenameAttempts result=failed win32_error=$lobsterOldInstallRenameError$\r$\n"
      FileClose $9
      IntCmp $lobsterOldInstallRenameAttempts 3 OldInstallRenameComplete OldInstallRenameRetry OldInstallRenameComplete

    OldInstallRenameRetry:
      Sleep 250
      Goto OldInstallRenameAttempt

    OldInstallRenameVerificationFailed:
      StrCpy $lobsterOldInstallRenameReason "verification-failed"
      StrCpy $lobsterOldInstallRenameError "verification-failed"
      !insertmacro customRollbackOldInstall "rename-verification-failed"
      StrCmp $lobsterOldInstallRollbackStatus "success" OldInstallRenameVerificationRestored

      ; The move succeeded but its postcondition could not be verified, and
      ; rollback could not restore a single authoritative old tree. Freeze the
      ; attempt with every recovery source preserved; never fall through into
      ; stock uninstall/install while filesystem ownership is ambiguous.
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=old-install-rename-verification-abort attempt_id=$lobsterInstallerAttemptId outcome=recovery-required rollback_status=$lobsterOldInstallRollbackStatus rollback_error=$lobsterOldInstallRollbackError source=$lobsterOldInstallOriginalPath backup=$lobsterOldInstallBackupPath$\r$\n"
      FileClose $9
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update stopped because the previous installation move could not be verified and automatic recovery did not complete. No recovery copy was deleted. Restart Windows before retrying. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      ${If} ${Silent}
        Banner::destroy
      ${EndIf}
      SetErrorLevel 3
      Quit

    OldInstallRenameVerificationRestored:
      ; lobsterRollbackOldInstall has restored the previous tree, but P0.5
      ; deliberately does not execute it. This attempt must end here instead of
      ; invoking the stock uninstaller against that restored tree.
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=old-install-rename-verification-abort attempt_id=$lobsterInstallerAttemptId outcome=restored rollback_status=$lobsterOldInstallRollbackStatus relaunch_status=$lobsterOldAppRelaunchStatus source=$lobsterOldInstallOriginalPath$\r$\n"
      FileClose $9
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update stopped because the previous installation move could not be verified. The previous version was restored. Please retry the update. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      ${If} ${Silent}
        Banner::destroy
      ${EndIf}
      SetErrorLevel 2
      Quit

    OldInstallRenameComplete:
    System::Call 'kernel32::GetTickCount()i .r6'
    IntOp $5 $6 - $7
    StrCpy $2 "false"
    StrCpy $3 "false"
    IfFileExists "$lobsterOldInstallOriginalPath\*.*" 0 OldInstallRenameSourceChecked
      StrCpy $2 "true"
    OldInstallRenameSourceChecked:
    StrCmp $lobsterOldInstallBackupPath "" OldInstallRenameBackupChecked
    IfFileExists "$lobsterOldInstallBackupPath\*.*" 0 OldInstallRenameBackupChecked
      StrCpy $3 "true"
    OldInstallRenameBackupChecked:
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=old-install-rename-complete attempt_id=$lobsterInstallerAttemptId action=$lobsterInstallAction status=$lobsterOldInstallRenameStatus reason=$lobsterOldInstallRenameReason attempts=$lobsterOldInstallRenameAttempts win32_error=$lobsterOldInstallRenameError elapsed_ms=$5 source_exists=$2 backup_exists=$3 backup_path=$lobsterOldInstallBackupPath cleanup_mode=preserve-only-p0.5$\r$\n"
    FileClose $9

    ; The install-scope Defender exclusion is added by
    ; customAfterUninstallOldVersions only after every registry-root candidate
    ; has passed the P0.5 no-execution gate.
    Goto CustomCheckInstallerDone

    CustomCheckFreshInstall:
      StrCpy $lobsterTargetProcessesStopStatus "not-required-fresh-install"
      StrCpy $lobsterLegacySkillsStatus "legacy-not-applicable-fresh-install"
      StrCpy $lobsterOldInstallRenameStatus "not-required"
      StrCpy $lobsterOldInstallRenameReason "fresh-install"
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=fresh-install-old-flow-skipped attempt_id=$lobsterInstallerAttemptId process_stop=skipped legacy_skills=skipped old_staging=skipped$\r$\n"
      FileClose $9

    CustomCheckInstallerDone:
  !else
    ; Uninstall remains best-effort when PowerShell is unavailable. It uses the
    ; same absolute resolver but does not turn an optional process stop into an
    ; uninstall blocker.
    !insertmacro EnsureInstallerAttemptId
    !insertmacro ResolveTrustedPowerShell
    !insertmacro stopLobsterAIProcesses
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
  Function lobsterAbortOldTreeExecution
    ; Prepare a terminal result without using MessageBox, Abort or Quit. The
    ; install Section returns immediately after this function, which skips all
    ; payload/registry mutation and lets the assisted wizard advance to its
    ; installer-native result page. Silent mode skips that page and preserves
    ; the stable non-zero exit code.
    Push $0
    Push $1
    Push $8
    Push $9

    StrCpy $lobsterInstallerTerminalFailureKind "install-root-destructive-fallback-blocked"
    StrCpy $lobsterInstallerTerminalOutcome "failed-before-mutation"
    StrCpy $lobsterInstallerTerminalExitCode "${LOBSTER_INSTALL_EXIT_DESTRUCTIVE_FALLBACK_BLOCKED}"
    StrCpy $lobsterInstallerTerminalPageState "ready"
    StrCpy $lobsterInstallerTerminalOpenPath "$lobsterOldInstallOriginalPath"
    StrCpy $1 "false"
    StrCmp $lobsterOldInstallRenameStatus "success" 0 LobsterOldTreeExecutionNoRollback
      StrCpy $1 "true"
      StrCpy $lobsterOldInstallRollbackReason "old-tree-execution-prohibited"
      Call lobsterRollbackOldInstall
      StrCmp $lobsterOldInstallRollbackStatus "failed" LobsterOldTreeExecutionRecoveryRequired
      StrCpy $lobsterInstallerTerminalOutcome "rollback-succeeded"

    LobsterOldTreeExecutionNoRollback:
      Goto LobsterOldTreeExecutionChooseLanguage

    LobsterOldTreeExecutionRecoveryRequired:
      StrCpy $lobsterInstallerTerminalOutcome "recovery-required"
      StrCpy $lobsterInstallerTerminalExitCode "3"
      StrCmp $lobsterOldInstallBackupPath "" LobsterOldTreeExecutionChooseLanguage
        StrCpy $lobsterInstallerTerminalOpenPath "$lobsterOldInstallBackupPath"

    LobsterOldTreeExecutionChooseLanguage:
    ; A preflight blocked-conflict has already composed evidence-bearing text
    ; via lobsterPrepareBlockedTerminalText; keep it unless the outcome
    ; escalated to recovery-required, which must own the page.
    StrCmp $lobsterInstallerTerminalOutcome "recovery-required" LobsterOldTreeExecutionChooseLanguageDefault
    StrCmp $lobsterInstallerTerminalText "" LobsterOldTreeExecutionChooseLanguageDefault LobsterOldTreeExecutionLog
    LobsterOldTreeExecutionChooseLanguageDefault:
    ; 2052 is the Windows LCID for Simplified Chinese. This function is parsed
    ; before electron-builder includes LogicLib and its language constants.
    StrCmp $LANGUAGE 2052 LobsterOldTreeExecutionChinese
      StrCmp $lobsterInstallerTerminalOutcome "recovery-required" LobsterOldTreeExecutionRecoveryEnglish
        StrCpy $lobsterInstallerTerminalTitle "${LOBSTER_INSTALL_BLOCKED_TITLE_EN}"
        StrCpy $lobsterInstallerTerminalText "${LOBSTER_INSTALL_OLD_TREE_BLOCKED_EN}$\r$\n$lobsterInstallerTerminalOpenPath"
        StrCpy $lobsterInstallerTerminalLinkText "${LOBSTER_INSTALL_OPEN_PRESERVED_EN}"
        Goto LobsterOldTreeExecutionLog
      LobsterOldTreeExecutionRecoveryEnglish:
        StrCpy $lobsterInstallerTerminalTitle "${LOBSTER_INSTALL_RECOVERY_TITLE_EN}"
        StrCpy $lobsterInstallerTerminalText "${LOBSTER_INSTALL_RECOVERY_REQUIRED_EN}$\r$\n$lobsterInstallerTerminalOpenPath"
        StrCpy $lobsterInstallerTerminalLinkText "${LOBSTER_INSTALL_OPEN_PRESERVED_EN}"
        Goto LobsterOldTreeExecutionLog

    LobsterOldTreeExecutionChinese:
      StrCmp $lobsterInstallerTerminalOutcome "recovery-required" LobsterOldTreeExecutionRecoveryChinese
        StrCpy $lobsterInstallerTerminalTitle "${LOBSTER_INSTALL_BLOCKED_TITLE_ZH}"
        StrCpy $lobsterInstallerTerminalText "${LOBSTER_INSTALL_OLD_TREE_BLOCKED_ZH}$\r$\n$lobsterInstallerTerminalOpenPath"
        StrCpy $lobsterInstallerTerminalLinkText "${LOBSTER_INSTALL_OPEN_PRESERVED_ZH}"
        Goto LobsterOldTreeExecutionLog
      LobsterOldTreeExecutionRecoveryChinese:
        StrCpy $lobsterInstallerTerminalTitle "${LOBSTER_INSTALL_RECOVERY_TITLE_ZH}"
        StrCpy $lobsterInstallerTerminalText "${LOBSTER_INSTALL_RECOVERY_REQUIRED_ZH}$\r$\n$lobsterInstallerTerminalOpenPath"
        StrCpy $lobsterInstallerTerminalLinkText "${LOBSTER_INSTALL_OPEN_PRESERVED_ZH}"

    LobsterOldTreeExecutionLog:
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=install-terminal-result-prepared attempt_id=$lobsterInstallerAttemptId outcome=$lobsterInstallerTerminalOutcome failure_kind=$lobsterInstallerTerminalFailureKind ui_mode=$lobsterUiMode mutation_started=$1 old_tree_execution=disabled-p0.5 rollback_status=$lobsterOldInstallRollbackStatus relaunch_status=$lobsterOldAppRelaunchStatus root=$lobsterOldUninstallBlockedRoot candidate=$lobsterOldUninstallCandidatePath open_path=$lobsterInstallerTerminalOpenPath$\r$\n"
    FileClose $9
    Call lobsterApplyTerminalExitCode

    Pop $9
    Pop $8
    Pop $1
    Pop $0
  FunctionEnd

  Function lobsterApplyTerminalExitCode
    StrCmp $lobsterInstallerTerminalExitCode "3" LobsterTerminalExitRecovery
    StrCmp $lobsterInstallerTerminalExitCode "${LOBSTER_INSTALL_EXIT_DESTRUCTIVE_FALLBACK_BLOCKED}" LobsterTerminalExitBlocked
      SetErrorLevel 1
      Return
    LobsterTerminalExitRecovery:
      SetErrorLevel 3
      Return
    LobsterTerminalExitBlocked:
      SetErrorLevel ${LOBSTER_INSTALL_EXIT_DESTRUCTIVE_FALLBACK_BLOCKED}
  FunctionEnd

  Function lobsterCompleteTerminalResult
    StrCmp $lobsterInstallerTerminalPageState "visible" LobsterTerminalCompleteStart
      Goto LobsterTerminalCompleteDone

    LobsterTerminalCompleteStart:
      StrCpy $lobsterInstallerTerminalPageState "closing"
      ; recovery-required never executes either the restored or staged tree.
      StrCmp $lobsterInstallerTerminalOutcome "recovery-required" LobsterTerminalCompleteNoRelaunch
        Call lobsterTryRelaunchOldApp
      LobsterTerminalCompleteNoRelaunch:
      StrCpy $lobsterInstallerTerminalPageState "closed"
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=install-terminal-result-complete attempt_id=$lobsterInstallerAttemptId outcome=$lobsterInstallerTerminalOutcome failure_kind=$lobsterInstallerTerminalFailureKind page_state=$lobsterInstallerTerminalPageState execution_trust=$lobsterOldAppExecutionTrust relaunch_status=$lobsterOldAppRelaunchStatus$\r$\n"
      FileClose $9
      Call lobsterApplyTerminalExitCode

    LobsterTerminalCompleteDone:
  FunctionEnd

  ; electron-builder delegates each registry root to this wrapper. P0.5 only
  ; continues when the root has no candidate in a genuinely fresh install, or
  ; when the selected old root was already staged by the verified fast path.
  ; Every other possible-existing case fails closed; stock uninstallOldVersion
  ; and its copy-out/in-place execution paths remain unreachable.
  !macro customUninstallOldVersion ROOT_KEY
    StrCpy $lobsterOldUninstallBlockedRoot "${ROOT_KEY}"
    StrCpy $lobsterOldUninstallCandidatePath ""
    StrCpy $lobsterOldUninstallCandidatePathNormalized ""
    ClearErrors
    !insertmacro readReg $lobsterOldUninstallCandidatePath ${ROOT_KEY} "${INSTALL_REGISTRY_KEY}" InstallLocation
    StrCmp $lobsterOldUninstallCandidatePath "" CustomOldUninstallCandidateReady_${ROOT_KEY}
      GetFullPathName $lobsterOldUninstallCandidatePathNormalized "$lobsterOldUninstallCandidatePath"
    CustomOldUninstallCandidateReady_${ROOT_KEY}:

    StrCmp $lobsterInstallAction "fresh-install" CustomOldUninstallerFresh_${ROOT_KEY}
    StrCmp $lobsterOldInstallRenameStatus "success" 0 CustomOldUninstallerBlocked_${ROOT_KEY}
    StrCmp $lobsterOldUninstallCandidatePathNormalized "" CustomOldUninstallerNoCandidateAfterStage_${ROOT_KEY}
    StrCmp $lobsterOldUninstallCandidatePathNormalized $lobsterOldInstallOriginalPathNormalized CustomOldUninstallerMatchedStage_${ROOT_KEY}
    Goto CustomOldUninstallerBlocked_${ROOT_KEY}

    CustomOldUninstallerFresh_${ROOT_KEY}:
      StrCmp $lobsterOldUninstallCandidatePath "" 0 CustomOldUninstallerFreshResidue_${ROOT_KEY}
      StrCpy $lobsterOldUninstallLaunchStatus "fresh-no-candidate"
      Goto CustomOldUninstallerSkipped_${ROOT_KEY}

    CustomOldUninstallerFreshResidue_${ROOT_KEY}:
      ; The planner only selects fresh-install when every registry candidate
      ; is dead: either a stale value whose cleanup failed, or a registration
      ; pointing at the enumerably empty target itself. A live candidate at a
      ; different path must still fail closed.
      StrCmp $lobsterOldUninstallCandidatePathNormalized $lobsterOldInstallOriginalPathNormalized CustomOldUninstallerFreshResidueOk_${ROOT_KEY}
      System::Call 'kernel32::GetFileAttributesW(w "$lobsterOldUninstallCandidatePath") i .R0'
      IntCmp $R0 -1 CustomOldUninstallerFreshResidueOk_${ROOT_KEY}
      Goto CustomOldUninstallerBlocked_${ROOT_KEY}
    CustomOldUninstallerFreshResidueOk_${ROOT_KEY}:
      StrCpy $lobsterOldUninstallLaunchStatus "fresh-stale-candidate-ignored"
      Goto CustomOldUninstallerSkipped_${ROOT_KEY}

    CustomOldUninstallerNoCandidateAfterStage_${ROOT_KEY}:
      StrCpy $lobsterOldUninstallLaunchStatus "no-candidate-after-existing-stage"
      Goto CustomOldUninstallerSkipped_${ROOT_KEY}

    CustomOldUninstallerMatchedStage_${ROOT_KEY}:
      StrCpy $lobsterOldUninstallLaunchStatus "matched-existing-stage"
      Goto CustomOldUninstallerSkipped_${ROOT_KEY}

    CustomOldUninstallerBlocked_${ROOT_KEY}:
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=old-tree-execution-blocked attempt_id=$lobsterInstallerAttemptId root=${ROOT_KEY} reason=destructive-fallback-prohibited action=$lobsterInstallAction basis=$lobsterInstallActionBasis registered_instdir=$lobsterOldUninstallCandidatePath rename_status=$lobsterOldInstallRenameStatus old_tree_execution=disabled-p0.5$\r$\n"
      FileClose $9
      Call lobsterAbortOldTreeExecution
      ; Return ends the install Section. Do not use Abort/.onInstFailed or Quit:
      ; the assisted wizard must advance to the terminal result page, while /S
      ; exits with the stable code prepared above and never creates a window.
      Return

    CustomOldUninstallerSkipped_${ROOT_KEY}:
      ClearErrors
      StrCpy $R0 0
      FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $9 0 END
      !insertmacro GetTimestamp $8
      FileWrite $9 "$8 phase=old-uninstaller-skipped attempt_id=$lobsterInstallerAttemptId root=${ROOT_KEY} reason=$lobsterOldUninstallLaunchStatus registered_instdir=$lobsterOldUninstallCandidatePath backup_path=$lobsterOldInstallBackupPath old_tree_execution=disabled-p0.5$\r$\n"
      FileClose $9
  !macroend

  ; Runs after every old-install root passed the no-execution gate, immediately
  ; before installApplicationFiles.
  !macro customAfterUninstallOldVersions
    DetailPrint "[Installer] Applying Windows Defender install-scope exclusion"
    !insertmacro ResolveTrustedPowerShell
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=defender-exclusion-start attempt_id=$lobsterInstallerAttemptId point=post-old-tree-execution-gate rename_status=$lobsterOldInstallRenameStatus helper_status=$lobsterTrustedPowerShellStatus$\r$\n"
    FileClose $9
    System::Call 'kernel32::GetTickCount()i .r7'
    StrCmp $lobsterTrustedPowerShellPath "" DefenderPostUninstallHelperMissing

    ${GetParameters} $R9
    ClearErrors
    ${GetOptions} $R9 "/NoDefenderExclusion" $R8
    IfErrors 0 DefenderPostUninstallQueryOnly

    CreateDirectory "$INSTDIR"
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "$INSTDIR")i'
    nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "\
      $$target = $$env:LOBSTERAI_INSTALL_ROOT;\
      try { $$beforePaths = @((Get-MpPreference -ErrorAction Stop).ExclusionPath); $$before = if ($$beforePaths -contains $$target) { \"present\" } else { \"absent\" } } catch { $$before = \"query-failed\" };\
      try { Add-MpPreference -ExclusionPath $$target -ErrorAction Stop; $$add = \"added\" } catch { $$add = \"skipped:\" + $$_.Exception.Message.Trim() };\
      try { $$afterPaths = @((Get-MpPreference -ErrorAction Stop).ExclusionPath); $$after = if ($$afterPaths -contains $$target) { \"present\" } else { \"absent\" } } catch { $$after = \"query-failed\" };\
      Write-Output (\"before=\" + $$before + \" add=\" + $$add + \" after=\" + $$after)"'
    Goto DefenderPostUninstallCommandDone

    DefenderPostUninstallQueryOnly:
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "$INSTDIR")i'
    nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "\
      $$root = $$env:LOBSTERAI_INSTALL_ROOT;\
      $$targets = @($$root, (Join-Path $$root \"resources\cfmind\"), (Join-Path $$root \"resources\python-win\"), (Join-Path $$root \"resources\SKILLs\"), (Join-Path $$root \"resources\app.asar.unpacked\"), (Join-Path $$root \"resources\app.asar\"), (Join-Path $$root \"resources\win-resources.tar\"));\
      try { $$beforePaths = @((Get-MpPreference -ErrorAction Stop).ExclusionPath); $$before = @($$targets | Where-Object { $$beforePaths -contains $$_ }).Count } catch { $$before = \"query-failed\" };\
      try { Remove-MpPreference -ExclusionPath $$targets -ErrorAction Stop; $$remove = \"requested\" } catch { $$remove = \"failed:\" + $$_.Exception.Message.Trim() };\
      try { $$afterPaths = @((Get-MpPreference -ErrorAction Stop).ExclusionPath); $$after = @($$targets | Where-Object { $$afterPaths -contains $$_ }).Count } catch { $$after = \"query-failed\" };\
      Write-Output (\"before_count=\" + $$before + \" add=disabled remove=\" + $$remove + \" after_count=\" + $$after)"'

    DefenderPostUninstallCommandDone:
    Pop $0
    Pop $1
    StrCpy $R2 $0
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "")i'
    Goto DefenderPostUninstallLog

    DefenderPostUninstallHelperMissing:
    StrCpy $R2 "helper-not-found"
    StrCpy $1 "skipped:trusted-powershell-unavailable"

    DefenderPostUninstallLog:
    System::Call 'kernel32::GetTickCount()i .r6'
    IntOp $5 $6 - $7
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=defender-exclusion-complete attempt_id=$lobsterInstallerAttemptId point=post-old-tree-execution-gate exit=$R2 elapsed_ms=$5 output=$1$\r$\n"
    FileClose $9
  !macroend

  ; The remaining hooks are invoked from the version-pinned app-builder-lib
  ; template patch. They use only built-in timing/file operations so the
  ; diagnostics do not add more security-scanned child processes.
  !macro customAppPackageMaterializeStart
    Push $0
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    StrCpy $lobsterPackageMaterializeStartTick $0
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=payload-materialize-start attempt_id=$lobsterInstallerAttemptId arch=$packageArch dest=$PLUGINSDIR\app-$packageArch.${COMPRESSION_METHOD}$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $0
  !macroend

  !macro customAppPackageMaterializeEnd
    Push $0
    Push $1
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    IntOp $1 $0 - $lobsterPackageMaterializeStartTick
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=payload-materialize-complete attempt_id=$lobsterInstallerAttemptId arch=$packageArch elapsed_ms=$1$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $1
    Pop $0
  !macroend

  !macro customAppPackageExtractStart MODE SOURCE
    Push $0
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    StrCpy $lobsterPackageExtractStartTick $0
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=payload-7z-extract-start attempt_id=$lobsterInstallerAttemptId mode=${MODE} arch=$packageArch source=${SOURCE} dest=$OUTDIR$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $0
  !macroend

  !macro customAppPackageExtractEnd MODE RESULT
    Push $0
    Push $1
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    IntOp $1 $0 - $lobsterPackageExtractStartTick
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=payload-7z-extract-complete attempt_id=$lobsterInstallerAttemptId mode=${MODE} arch=$packageArch result=${RESULT} elapsed_ms=$1$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $1
    Pop $0
  !macroend

  !macro customAppPackageCopyStart
    Push $0
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    StrCpy $lobsterPackageCopyStartTick $0
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=payload-copy-start attempt_id=$lobsterInstallerAttemptId attempt=$R1 source=$PLUGINSDIR\7z-out dest=$OUTDIR$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $0
  !macroend

  !macro customAppPackageCopyEnd RESULT
    Push $0
    Push $1
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    IntOp $1 $0 - $lobsterPackageCopyStartTick
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=payload-copy-complete attempt_id=$lobsterInstallerAttemptId attempt=$R1 result=${RESULT} elapsed_ms=$1$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $1
    Pop $0
  !macroend

  !macro customInstallerCacheCopyStart KIND
    Push $0
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    StrCpy $lobsterInstallerCacheCopyStartTick $0
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=installer-cache-copy-start attempt_id=$lobsterInstallerAttemptId kind=${KIND}$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $0
  !macroend

  !macro customInstallerCacheCopyEnd KIND RESULT
    Push $0
    Push $1
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    IntOp $1 $0 - $lobsterInstallerCacheCopyStartTick
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=installer-cache-copy-complete attempt_id=$lobsterInstallerAttemptId kind=${KIND} result=${RESULT} elapsed_ms=$1$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $1
    Pop $0
  !macroend

  !macro customEstimatedSizeKnown VALUE
    Push $8
    Push $9
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=estimated-size-scan-skipped attempt_id=$lobsterInstallerAttemptId source=build-estimate value_kb=${VALUE}$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
  !macroend

  !macro customEstimatedSizeScanStart
    Push $0
    System::Call 'kernel32::GetTickCount()i .r0'
    StrCpy $lobsterEstimatedSizeScanStartTick $0
    Pop $0
  !macroend

  !macro customEstimatedSizeScanEnd VALUE
    StrCpy $lobsterEstimatedSizeValue ${VALUE}
    Push $0
    Push $1
    Push $8
    Push $9
    System::Call 'kernel32::GetTickCount()i .r0'
    IntOp $1 $0 - $lobsterEstimatedSizeScanStartTick
    FileOpen $9 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $9 0 END
    !insertmacro GetTimestamp $8
    FileWrite $9 "$8 phase=estimated-size-scan-complete attempt_id=$lobsterInstallerAttemptId value_kb=$lobsterEstimatedSizeValue elapsed_ms=$1$\r$\n"
    FileClose $9
    Pop $9
    Pop $8
    Pop $1
    Pop $0
  !macroend
!endif

!macro customBeforeRegistryAddInstallInfo
  ; -- Install Timing Log --
  ; Write timestamps to help diagnose slow installation phases.
  ; Log file: %APPDATA%\LobsterAI\install-timing.log

  CreateDirectory "$APPDATA\LobsterAI"
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=app-files-install-complete attempt_id=$lobsterInstallerAttemptId$\r$\n"
  FileWrite $2 "$8 phase=nsis-extract-complete attempt_id=$lobsterInstallerAttemptId$\r$\n"
  FileClose $2
  DetailPrint "[Installer] Preparing installation steps"

  ; -- Extract combined resource archive (win-resources.tar) --
  ; All large resource directories (cfmind/, SKILLs/, python-win/) are packed
  ; into a single tar file. NSIS 7z extracts one large file almost instantly;
  ; we then unpack the tar here using Electron's Node runtime.
  ;
  ; The install-scope Defender exclusion was added after the no-execution gate
  ; and immediately before the NSIS payload extraction; temporary/legacy
  ; entries are trimmed at the end of this macro.

  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")i'

  DetailPrint "[Installer] Extracting bundled resources"
  ; $R2 = current extractor exit code, $R3 = extractor id for logs.
  ; ($R2 survives GetTimestamp, which clobbers $0 -- see the macro note.)
  StrCpy $R2 ""
  StrCpy $R3 "none"
  StrCpy $R4 "none"
  !insertmacro ResolveTrustedTar
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=system-tool-resolved attempt_id=$lobsterInstallerAttemptId tool=tar status=$lobsterTrustedTarStatus source=$lobsterTrustedTarSource path=$lobsterTrustedTarPath$\r$\n"
  FileClose $2

  ; -- Attempt 1: Windows built-in bsdtar (Win10 1803+) --
  ; Runs a trusted system binary instead of the freshly written app exe,
  ; which security software tends to freeze for cloud analysis on its first
  ; execution (the root cause of installers hanging at this phase).
  StrCmp $lobsterTrustedTarPath "" TarExtractElectron
  StrCpy $R3 "system-tar"
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-start attempt_id=$lobsterInstallerAttemptId extractor=system-tar helper=$lobsterTrustedTarPath tar=$INSTDIR\resources\win-resources.tar dest=$INSTDIR\resources$\r$\n"
  FileClose $2
  System::Call 'kernel32::GetTickCount()i .r7'
  nsExec::ExecToLog '"$lobsterTrustedTarPath" -xf "$INSTDIR\resources\win-resources.tar" -C "$INSTDIR\resources"'
  Pop $0
  StrCpy $R2 $0
  System::Call 'kernel32::GetTickCount()i .r6'
  IntOp $5 $6 - $7
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-exit attempt_id=$lobsterInstallerAttemptId extractor=system-tar raw_kind=numeric-or-adapter-exit exit=$R2 elapsed_ms=$5$\r$\n"
  FileClose $2
  StrCmp $R2 "error" TarExtractElectron
  IntCmp $R2 0 TarExtractVerify TarExtractElectron TarExtractElectron

  TarExtractElectron:
  ; -- Attempt 2: bundled Electron Node runtime --
  ; Wrapped in a 10-minute watchdog: if security software freezes the child
  ; before it can run, the installer must fail visibly instead of hanging
  ; forever (a killed installer leaves a half-installed app behind).
  StrCpy $R3 "electron"
  DetailPrint "[Installer] Launching bundled extractor"
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-start attempt_id=$lobsterInstallerAttemptId extractor=electron tar=$INSTDIR\resources\win-resources.tar dest=$INSTDIR\resources$\r$\n"
  FileClose $2
  System::Call 'kernel32::GetTickCount()i .r7'

  !insertmacro ResolveTrustedPowerShell
  StrCmp $lobsterTrustedPowerShellPath "" TarExtractHelperNotFound
  Delete "$PLUGINSDIR\lobster-watchdog-$lobsterInstallerAttemptId.marker"
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_WATCHDOG_MARKER_PATH", t "$PLUGINSDIR\lobster-watchdog-$lobsterInstallerAttemptId.marker")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_EXE", t "$INSTDIR\${APP_EXECUTABLE_FILENAME}")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_SCRIPT", t "$INSTDIR\resources\unpack-cfmind.cjs")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_ARCHIVE", t "$INSTDIR\resources\win-resources.tar")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_DESTINATION", t "$INSTDIR\resources")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_LOG", t "$APPDATA\LobsterAI\install-timing.log")i'
  nsExec::ExecToLog '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "\
    $$ErrorActionPreference = \"Stop\";\
    $$marker = $$env:LOBSTERAI_WATCHDOG_MARKER_PATH;\
    function Write-LobsterWatchdogMarker {\
      param([string] $$value);\
      try {\
        Set-Content -LiteralPath $$marker -Value $$value -NoNewline -ErrorAction Stop\
      } catch {\
        Write-Output (\"LOBSTERAI_WATCHDOG_MARKER_WRITE_FAILED:\" + $$value)\
      }\
    };\
    try {\
      $$extractorArgs = \"`\"\" + $$env:LOBSTERAI_EXTRACTOR_SCRIPT + \"`\" `\"\" + $$env:LOBSTERAI_EXTRACTOR_ARCHIVE + \"`\" `\"\" + $$env:LOBSTERAI_EXTRACTOR_DESTINATION + \"`\" `\"\" + $$env:LOBSTERAI_EXTRACTOR_LOG + \"`\"\";\
      $$p = Start-Process -FilePath $$env:LOBSTERAI_EXTRACTOR_EXE -ArgumentList $$extractorArgs -NoNewWindow -PassThru\
    } catch {\
      Write-LobsterWatchdogMarker \"process-start-blocked\";\
      Write-Output \"LOBSTERAI_WATCHDOG_START_BLOCKED\";\
      exit 125\
    };\
    if ($$p.WaitForExit(600000)) {\
      $$p.WaitForExit();\
      if ($$p.ExitCode -eq $$null) {\
        Write-LobsterWatchdogMarker \"output-validation-failed\";\
        exit 127\
      };\
      exit $$p.ExitCode\
    };\
    try {\
      Stop-Process -Id $$p.Id -Force -ErrorAction Stop;\
      if (-not $$p.WaitForExit(30000)) {\
        Write-LobsterWatchdogMarker \"process-termination-failed\";\
        Write-Output \"LOBSTERAI_WATCHDOG_TERMINATION_FAILED\";\
        exit 126\
      }\
    } catch {\
      Write-LobsterWatchdogMarker \"process-termination-failed\";\
      Write-Output \"LOBSTERAI_WATCHDOG_TERMINATION_FAILED\";\
      exit 126\
    };\
    Write-LobsterWatchdogMarker \"process-timeout\";\
    Write-Output \"LOBSTERAI_WATCHDOG_TIMEOUT\";\
    exit 124"'
  Pop $0
  StrCpy $R2 $0
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_WATCHDOG_MARKER_PATH", t "")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_EXE", t "")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_SCRIPT", t "")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_ARCHIVE", t "")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_DESTINATION", t "")i'
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_EXTRACTOR_LOG", t "")i'
  StrCpy $R4 "none"
  ClearErrors
  FileOpen $3 "$PLUGINSDIR\lobster-watchdog-$lobsterInstallerAttemptId.marker" r
  IfErrors TarExtractMarkerReadDone
    FileRead $3 $R4
    FileClose $3
  TarExtractMarkerReadDone:
  Delete "$PLUGINSDIR\lobster-watchdog-$lobsterInstallerAttemptId.marker"
  Goto TarExtractWatchdogReturned

  TarExtractHelperNotFound:
  StrCpy $R2 "helper-not-found"
  StrCpy $R4 "helper-not-found"

  TarExtractWatchdogReturned:
  System::Call 'kernel32::GetTickCount()i .r6'
  IntOp $5 $6 - $7
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-exit attempt_id=$lobsterInstallerAttemptId extractor=electron raw_marker=$R4 exit=$R2 elapsed_ms=$5$\r$\n"
  FileClose $2

  ; "error" = nsExec couldn't start PowerShell (check before IntCmp, which
  ; converts non-numeric strings to 0 and would misidentify "error" as success)
  StrCmp $R2 "error" TarExtractProcessFailed
  StrCmp $R2 "helper-not-found" TarExtractProcessFailed
  ; Marker persistence is diagnostic only. A frozen child can also block or
  ; deny writes to $PLUGINSDIR, so the dedicated wrapper exit must independently
  ; select the no-concurrent-rollback path.
  StrCmp $R2 "126" TarExtractTerminationFailed
  StrCmp $R4 "process-start-blocked" TarExtractProcessFailed
  StrCmp $R4 "process-termination-failed" TarExtractTerminationFailed
  StrCmp $R4 "output-validation-failed" TarExtractOutputValidationFailed
  StrCmp $R4 "process-timeout" 0 TarExtractNumericResult
  StrCmp $R2 "124" TarExtractTimeout TarExtractOutputValidationFailed
  TarExtractNumericResult:
  ; IntCmp tolerates trailing whitespace/CR that StrCmp would reject
  IntCmp $R2 0 TarExtractVerify TarExtractNonZero TarExtractNonZero

  TarExtractVerify:
  ; Success requires the OpenClaw runtime entry to actually exist -- an exit
  ; code alone must never trigger deletion of the only recovery source.
  IfFileExists "$INSTDIR\resources\cfmind\gateway-bundle.mjs" TarExtractSucceeded
  IfFileExists "$INSTDIR\resources\cfmind\openclaw.mjs" TarExtractSucceeded
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-error attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 reason=entry-missing-after-extract$\r$\n"
  FileClose $2
  ; A bogus system-tar success still gets a shot at the bundled extractor.
  ;
  ; /SD IDOK on this and the failure boxes below: NSIS shows MessageBox even
  ; in /S installs unless a silent default is declared, and the in-app update
  ; must never block on an orphan dialog.
  StrCmp $R3 "system-tar" TarExtractElectron
  MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because resource extraction completed without the required AI runtime entry. The installer will not commit a partial application. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
  Goto TarExtractFailed

  TarExtractProcessFailed:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=tar-extract-error attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 raw_marker=$R4 elapsed_ms=$5 reason=process-start-failed$\r$\n"
    FileClose $2
    MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because the resource extractor could not be started (exit=$R2). The installer will not commit a partial application. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
    Goto TarExtractFailed

  TarExtractTimeout:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=tar-extract-error attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 raw_marker=$R4 elapsed_ms=$5 reason=timeout$\r$\n"
    FileClose $2
    MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because resource extraction timed out after 10 minutes. The blocked extractor was terminated and the installer will not commit a partial application. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
    Goto TarExtractFailed

  TarExtractTerminationFailed:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=tar-extract-error attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 raw_marker=$R4 elapsed_ms=$5 reason=process-termination-failed action=preserve-all-no-concurrent-rollback$\r$\n"
    FileClose $2
    System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "")i'
    ${If} ${Silent}
      Banner::destroy
    ${EndIf}
    MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because the extractor process could not be confirmed terminated. No automatic rollback or cleanup was attempted while that process may still be writing files. Restart Windows before retrying. Recovery files (if any): $lobsterOldInstallBackupPath. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
    SetErrorLevel 3
    Quit

  TarExtractOutputValidationFailed:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=tar-extract-error attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 raw_marker=$R4 elapsed_ms=$5 reason=watchdog-output-validation-failed$\r$\n"
    FileClose $2
    MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because the resource extractor watchdog returned an invalid result. The installer will not commit a partial application. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
    Goto TarExtractFailed

  TarExtractNonZero:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=tar-extract-error attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 raw_marker=$R4 elapsed_ms=$5 reason=numeric-child-exit$\r$\n"
    FileClose $2
    MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because resource extraction failed (child exit code $R2). The installer will not commit a partial application. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
    Goto TarExtractFailed

  TarExtractSucceeded:
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-complete attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2$\r$\n"
  FileClose $2
  ; Completion marker, read by the app for install-integrity diagnostics.
  FileOpen $2 "$INSTDIR\resources\.win-resources-extracted" w
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 source=installer extractor=$R3$\r$\n"
  FileClose $2
  DetailPrint "[Installer] Bundled resources extraction complete"
  ; Only a verified success may delete these: the preserved archive is what
  ; lets the app finish an interrupted extraction at first launch.
  Delete "$INSTDIR\resources\win-resources.tar"
  Delete "$INSTDIR\resources\unpack-cfmind.cjs"
  Goto TarExtractDone

  TarExtractFailed:
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=tar-extract-failed-archive-preserved attempt_id=$lobsterInstallerAttemptId extractor=$R3 exit=$R2 raw_marker=$R4 action=abort-install$\r$\n"
  FileClose $2
  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "")i'
  !insertmacro customRollbackOldInstall "resource-extraction-failed"
  StrCmp $lobsterOldInstallRollbackStatus "failed" 0 TarExtractAbort
    MessageBox MB_OK|MB_ICONEXCLAMATION "The installation failed and automatic rollback did not complete. No recovery copy was deleted. Previous files: $lobsterOldInstallBackupPath. Partial update: $lobsterOldInstallFailedPath. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
  TarExtractAbort:
  ${If} ${Silent}
    Banner::destroy
  ${EndIf}
  SetErrorLevel 3
  Quit
  TarExtractDone:

  ; -- Restore user-created skills from AppData backup --
  ; The backup was created in customCheckAppRunning before extraction began.
  ; Restore any skills not already present in the new install, then clean up
  ; only this attempt's backup. A later attempt never consumes a historical
  ; fixed skills-backup directory.
  StrCmp $lobsterLegacySkillsStatus "legacy-backup-succeeded" 0 SkipSkillRestore
  System::Call 'kernel32::GetTickCount()i .r7'
  IfFileExists "$APPDATA\LobsterAI\skills-backup\$lobsterInstallerAttemptId\backup-manifest.json" SkillRestoreAttemptBackupReady
    StrCpy $R2 "backup-missing"
    StrCpy $1 "current-attempt-backup-manifest-missing"
    StrCpy $lobsterLegacySkillsRestoreStatus "legacy-restore-backup-missing"
    Goto SkillRestoreCommandDone

  SkillRestoreAttemptBackupReady:
    DetailPrint "[Installer] Restoring user-created skills"
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=skill-restore-start attempt_id=$lobsterInstallerAttemptId backup=$APPDATA\LobsterAI\skills-backup\$lobsterInstallerAttemptId$\r$\n"
    FileClose $2

    StrCmp $lobsterTrustedPowerShellPath "" SkillRestoreHelperMissing
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_SOURCE", t "$lobsterOldInstallOriginalPath\resources\SKILLs")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_BACKUP_ROOT", t "$APPDATA\LobsterAI\skills-backup")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_DESTINATION", t "$INSTDIR\resources\SKILLs")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ATTEMPT_ID", t "$lobsterInstallerAttemptId")i'
    nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "\
      $$ErrorActionPreference = \"Stop\";\
      $$attempt   = $$env:LOBSTERAI_INSTALL_ATTEMPT_ID;\
      $$root      = $$env:LOBSTERAI_SKILL_BACKUP_ROOT;\
      $$source    = $$env:LOBSTERAI_SKILL_SOURCE;\
      $$backup    = Join-Path $$root $$attempt;\
      $$newSkills = $$env:LOBSTERAI_SKILL_DESTINATION;\
      try {\
        if ([string]::IsNullOrWhiteSpace($$attempt)) { throw \"attempt id missing\" };\
        $$manifestPath = Join-Path $$backup \"backup-manifest.json\";\
        $$manifest = Get-Content -LiteralPath $$manifestPath -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop;\
        if ($$manifest.schemaVersion -ne 1) { throw \"manifest schema mismatch\" };\
        if ($$manifest.attemptId -ne $$attempt) { throw \"manifest attempt mismatch\" };\
        if ($$manifest.source -ne $$source) { throw \"manifest source mismatch\" };\
        if ($$manifest.validation.status -ne \"verified\") { throw \"manifest not verified\" };\
        if ((Get-Content -LiteralPath (Join-Path $$backup \".attempt-id\") -Raw -ErrorAction Stop) -ne $$attempt) { throw \"attempt marker mismatch\" };\
        $$skills = @($$manifest.skills);\
        if ($$skills.Count -ne [int]$$manifest.statistics.skillCount) { throw \"manifest skill count mismatch\" };\
        if (@($$manifest.files).Count -ne [int]$$manifest.statistics.fileCount) { throw \"manifest file count mismatch\" };\
        if (@($$manifest.directories).Count -ne [int]$$manifest.statistics.directoryCount) { throw \"manifest directory count mismatch\" };\
        $$backupPrefix = [IO.Path]::GetFullPath($$backup).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar;\
        foreach ($$skill in $$skills) {\
          if ([string]::IsNullOrWhiteSpace($$skill) -or ([IO.Path]::GetFileName($$skill) -ne $$skill) -or ($$skill -eq \".\") -or ($$skill -eq \"..\")) { throw \"unsafe manifest skill name\" };\
          if (-not (Test-Path -LiteralPath (Join-Path $$backup $$skill) -PathType Container)) { throw \"manifest skill missing\" }\
        };\
        foreach ($$file in @($$manifest.files)) {\
          if ([IO.Path]::IsPathRooted($$file.path)) { throw \"rooted manifest path\" };\
          $$relative = $$file.path.Replace([char]47, [IO.Path]::DirectorySeparatorChar);\
          $$candidate = [IO.Path]::GetFullPath((Join-Path $$backup $$relative));\
          if (-not $$candidate.StartsWith($$backupPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw \"manifest path escaped backup\" };\
          $$top = @($$file.path.Split([char]47))[0];\
          if (($$file.path -ne \".attempt-id\") -and ($$skills -notcontains $$top)) { throw \"manifest file outside skill\" };\
          if (-not (Test-Path -LiteralPath $$candidate -PathType Leaf)) { throw \"manifest file missing\" };\
          if ((Get-FileHash -LiteralPath $$candidate -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -ne $$file.sha256) { throw \"manifest hash mismatch\" }\
        };\
        New-Item -ItemType Directory -Path $$newSkills -Force -ErrorAction Stop | Out-Null;\
        $$conflicts = @($$skills | Where-Object { Test-Path -LiteralPath (Join-Path $$newSkills $$_) });\
        if ($$conflicts.Count -gt 0) {\
          Write-Output (\"name-conflict:\" + (($$conflicts | Sort-Object) -join \",\"));\
          exit 20\
        };\
        $$restored = 0;\
        $$restoredNames = @();\
        foreach ($$skill in $$skills) {\
          $$target = Join-Path $$newSkills $$skill;\
          if (-not (Test-Path -LiteralPath $$target)) {\
            Copy-Item -LiteralPath (Join-Path $$backup $$skill) -Destination $$target -Recurse -Force -ErrorAction Stop;\
            $$restoredNames += $$skill;\
            $$restored++\
          }\
        };\
        foreach ($$file in @($$manifest.files)) {\
          $$top = @($$file.path.Split([char]47))[0];\
          if ($$restoredNames -contains $$top) {\
            $$destinationFile = Join-Path $$newSkills ($$file.path.Replace([char]47, [IO.Path]::DirectorySeparatorChar));\
            if ((Get-FileHash -LiteralPath $$destinationFile -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -ne $$file.sha256) { throw \"restored hash mismatch\" }\
          }\
        };\
        Remove-Item -LiteralPath $$backup -Recurse -Force -ErrorAction Stop;\
        Write-Output (\"restored:\" + $$restored + \" manifest-files:\" + $$manifest.statistics.fileCount);\
        exit 0\
      } catch {\
        exit 1\
      }"'
    Pop $0
    Pop $1
    StrCpy $R2 $0
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_SOURCE", t "")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_BACKUP_ROOT", t "")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_SKILL_DESTINATION", t "")i'
    System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ATTEMPT_ID", t "")i'
    Goto SkillRestoreCommandDone

    SkillRestoreHelperMissing:
    StrCpy $R2 "helper-not-found"
    StrCpy $1 "trusted-powershell-unavailable"
    StrCpy $lobsterLegacySkillsRestoreStatus "legacy-restore-helper-launch-failed"

    SkillRestoreCommandDone:
    StrCmp $R2 "0" 0 +2
      StrCpy $lobsterLegacySkillsRestoreStatus "legacy-restore-succeeded"
    StrCmp $R2 "20" 0 +2
      StrCpy $lobsterLegacySkillsRestoreStatus "legacy-restore-name-conflict"
    StrCmp $lobsterLegacySkillsRestoreStatus "not-required" 0 +2
      StrCpy $lobsterLegacySkillsRestoreStatus "legacy-restore-failed"
    System::Call 'kernel32::GetTickCount()i .r6'
    IntOp $5 $6 - $7
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=skill-restore-complete attempt_id=$lobsterInstallerAttemptId status=$lobsterLegacySkillsRestoreStatus exit=$R2 elapsed_ms=$5 backup=$APPDATA\LobsterAI\skills-backup\$lobsterInstallerAttemptId$\r$\n"
    FileWrite $2 "$8 phase=skill-restore-output attempt_id=$lobsterInstallerAttemptId status=$lobsterLegacySkillsRestoreStatus text=$1$\r$\n"
    FileClose $2

    StrCmp $R2 "0" SkillRestoreValidated
    StrCmp $R2 "20" SkillRestoreConflictPreserved
      FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $2 0 END
      !insertmacro GetTimestamp $8
      FileWrite $2 "$8 phase=skill-restore-failed attempt_id=$lobsterInstallerAttemptId status=legacy-restore-failed action=attempt-backup-preserved rename_status=$lobsterOldInstallRenameStatus$\r$\n"
      FileClose $2

      ; On the directory-swap path, restoring the previous application also
      ; restores its original in-place skills. The AppData copy remains as an
      ; additional recovery source because the PowerShell transaction deletes
      ; it only after every skill copy succeeds.
      StrCmp $lobsterOldInstallRenameStatus "success" 0 SkillRestoreFailurePreserved
      System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "")i'
      !insertmacro customRollbackOldInstall "skill-restore-failed"
      StrCmp $lobsterOldInstallRollbackStatus "success" SkillRestoreRollbackSucceeded
        MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update could not restore user skills, and automatic rollback did not complete. No recovery copy was deleted. Previous files: $lobsterOldInstallBackupPath. Partial update: $lobsterOldInstallFailedPath. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
        Goto SkillRestoreAbort
      SkillRestoreRollbackSucceeded:
        MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update could not restore user skills, so the previous version was restored. Please retry the update. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      SkillRestoreAbort:
      ${If} ${Silent}
        Banner::destroy
      ${EndIf}
      SetErrorLevel 2
      Quit

    SkillRestoreFailurePreserved:
      ; The stock-uninstaller fallback has no intact directory to roll back.
      ; Preserve P0 compatibility: keep the usable new payload and continue to
      ; registration, but retain the exact attempt backup and record an
      ; explicit degraded state for retry/manual recovery.
      FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $2 0 END
      !insertmacro GetTimestamp $8
      FileWrite $2 "$8 phase=skill-restore-degraded attempt_id=$lobsterInstallerAttemptId status=$lobsterLegacySkillsRestoreStatus action=continue-with-attempt-backup-preserved backup=$APPDATA\LobsterAI\skills-backup\$lobsterInstallerAttemptId$\r$\n"
      FileClose $2
      MessageBox MB_OK|MB_ICONEXCLAMATION "LobsterAI will finish installing, but legacy user skills could not be restored automatically ($lobsterLegacySkillsRestoreStatus). The current-attempt recovery backup was not deleted. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK

    SkillRestoreConflictPreserved:
      ; A same-name entry in the new tree must never cause the user's only
      ; copy to be overwritten or deleted. Finish installing the verified new
      ; app, retain the entire attempt backup, and expose a typed state for
      ; user-context import/manual recovery.
      FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
      FileSeek $2 0 END
      !insertmacro GetTimestamp $8
      FileWrite $2 "$8 phase=skill-restore-conflict-preserved attempt_id=$lobsterInstallerAttemptId status=name-conflict action=attempt-backup-preserved backup=$APPDATA\LobsterAI\skills-backup\$lobsterInstallerAttemptId$\r$\n"
      FileClose $2
    SkillRestoreValidated:
  SkipSkillRestore:

  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "")i'

  ; The unpack script is deleted in TarExtractSucceeded above; after a failed
  ; extraction it is intentionally kept alongside win-resources.tar.

  ; -- Rebalance Defender exclusions now that extraction is done --
  ; Unconditionally remove the install-scope whole-directory entry (also the
  ; leftover of an interrupted install -- the entry path is always $INSTDIR,
  ; so this step self-heals it) and the SKILLs entry older installers added.
  !insertmacro ResolveTrustedPowerShell
  StrCmp $lobsterTrustedPowerShellPath "" DefenderTrimHelperMissing
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "$INSTDIR")i'
  nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "try { $$root = $$env:LOBSTERAI_INSTALL_ROOT; $$targets = @($$root, (Join-Path $$root \"resources\SKILLs\")); Remove-MpPreference -ExclusionPath $$targets -ErrorAction SilentlyContinue; Write-Output \"removed\" } catch { Write-Output (\"failed: \" + $$_.Exception.Message) }"'
  Pop $0
  Pop $1
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "")i'
  Goto DefenderTrimLog
  DefenderTrimHelperMissing:
  StrCpy $0 "helper-not-found"
  StrCpy $1 "skipped:trusted-powershell-unavailable"
  DefenderTrimLog:
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=defender-exclusion-trim-complete attempt_id=$lobsterInstallerAttemptId exit=$0 output=$1$\r$\n"
  FileClose $2

  ; Re-add the permanent entries; skipped entirely when the
  ; /NoDefenderExclusion opt-out is present -- the removals above are not.
  ;
  ; Besides the three runtime trees, this PRE-PROVISIONS the two biggest
  ; single files of the NEXT upgrade: win-resources.tar and app.asar. Field
  ; finding (EICAR-verified on a machine where install-time exclusions never
  ; worked): Defender applies newly added exclusions asynchronously, minutes
  ; later -- entries added mid-install protect nothing, while entries that
  ; have been sitting since the previous install are fully honored. Risk:
  ; the tar path points at a file that only exists during an install, and
  ; app.asar is the same trust class as the already-excluded
  ; app.asar.unpacked. SKILLs stays scannable (user-writable,
  ; agent-executed).
  ${GetParameters} $R9
  ClearErrors
  ${GetOptions} $R9 "/NoDefenderExclusion" $R8
  IfErrors 0 DefenderPermanentAddSkipped
  StrCmp $lobsterTrustedPowerShellPath "" DefenderPermanentAddHelperMissing
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "$INSTDIR")i'
  nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "try { $$root = $$env:LOBSTERAI_INSTALL_ROOT; $$targets = @((Join-Path $$root \"resources\cfmind\"), (Join-Path $$root \"resources\python-win\"), (Join-Path $$root \"resources\app.asar.unpacked\"), (Join-Path $$root \"resources\app.asar\"), (Join-Path $$root \"resources\win-resources.tar\")); Add-MpPreference -ExclusionPath $$targets -ErrorAction Stop; Write-Output \"added\" } catch { Write-Output (\"skipped: \" + $$_.Exception.Message) }"'
  Pop $0
  Pop $1
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "")i'
  Goto DefenderPermanentAddLog
  DefenderPermanentAddHelperMissing:
  StrCpy $0 "helper-not-found"
  StrCpy $1 "skipped:trusted-powershell-unavailable"
  DefenderPermanentAddLog:
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=defender-exclusion-permanent-complete attempt_id=$lobsterInstallerAttemptId exit=$0 output=$1$\r$\n"
  FileClose $2
  DefenderPermanentAddSkipped:

  ; Validate every scenario before electron-builder writes new registration
  ; or shortcuts. The archive and unpack script are diagnostic recovery
  ; material, never a successful validation condition.
  StrCpy $lobsterNewInstallValidationStatus "failed"
  StrCpy $lobsterNewInstallValidationReason "app-executable-missing"
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 NewInstallPrevalidateFailed
  StrCpy $lobsterNewInstallValidationReason "uninstaller-missing"
  IfFileExists "$INSTDIR\${UNINSTALL_FILENAME}" 0 NewInstallPrevalidateFailed
  StrCpy $lobsterNewInstallValidationReason "app-asar-missing"
  IfFileExists "$INSTDIR\resources\app.asar" 0 NewInstallPrevalidateFailed

  IfFileExists "$INSTDIR\resources\cfmind\gateway-bundle.mjs" NewInstallPrevalidateSucceeded
  IfFileExists "$INSTDIR\resources\cfmind\openclaw.mjs" NewInstallPrevalidateSucceeded
  StrCpy $lobsterNewInstallValidationReason "runtime-entry-missing"
  Goto NewInstallPrevalidateFailed

  NewInstallPrevalidateSucceeded:
    StrCpy $lobsterNewInstallValidationStatus "success"
    StrCpy $lobsterNewInstallValidationReason "new-install-runtime-ready"
    StrCmp $lobsterOldInstallRenameStatus "success" 0 NewInstallPrevalidateLog
      StrCpy $lobsterOldInstallRenameStatus "prevalidated"
    NewInstallPrevalidateLog:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=new-install-prevalidated attempt_id=$lobsterInstallerAttemptId status=$lobsterNewInstallValidationStatus reason=$lobsterNewInstallValidationReason rename_status=$lobsterOldInstallRenameStatus registration=pending backup_path=$lobsterOldInstallBackupPath$\r$\n"
    FileClose $2
    Goto NewInstallPrevalidateDone

  NewInstallPrevalidateFailed:
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=new-install-prevalidation-failed attempt_id=$lobsterInstallerAttemptId status=$lobsterNewInstallValidationStatus reason=$lobsterNewInstallValidationReason rename_status=$lobsterOldInstallRenameStatus registration=not-written backup_path=$lobsterOldInstallBackupPath$\r$\n"
    FileClose $2
    StrCmp $lobsterOldInstallRenameStatus "success" 0 NewInstallPrevalidateAbort
    !insertmacro customRollbackOldInstall "new-install-validation-failed"
    StrCmp $lobsterOldInstallRollbackStatus "success" NewInstallPrevalidateRollbackSucceeded
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update could not be validated, and automatic rollback did not complete. No recovery copy was deleted. Previous files: $lobsterOldInstallBackupPath. Partial update: $lobsterOldInstallFailedPath. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      Goto NewInstallPrevalidateAbortAfterMessage
    NewInstallPrevalidateRollbackSucceeded:
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI update could not be validated, so the previous version was restored. Please retry the update. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
      Goto NewInstallPrevalidateAbortAfterMessage
    NewInstallPrevalidateAbort:
      MessageBox MB_OK|MB_ICONEXCLAMATION "The LobsterAI installation stopped because the new application could not be validated ($lobsterNewInstallValidationReason). New registration and shortcuts were not written. Details: $APPDATA\LobsterAI\install-timing.log" /SD IDOK
    NewInstallPrevalidateAbortAfterMessage:
    ${If} ${Silent}
      Banner::destroy
    ${EndIf}
    SetErrorLevel 2
    Quit

  NewInstallPrevalidateDone:
!macroend

; Standard post-registry electron-builder hook. All fallible extraction,
; restoration, Defender rebalancing and validation completed in
; customBeforeRegistryAddInstallInfo. This hook only commits the already
; prevalidated directory swap. P0.5 preserves the exact-current backup.
!macro customInstall
  StrCmp $lobsterNewInstallValidationStatus "success" 0 InstallFinalizeInvariantFailed
  StrCmp $lobsterOldInstallRenameStatus "prevalidated" 0 InstallFinalizeNoRename
    StrCpy $lobsterOldInstallRenameStatus "committed"
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=old-install-commit-complete attempt_id=$lobsterInstallerAttemptId status=$lobsterNewInstallValidationStatus reason=$lobsterNewInstallValidationReason registration=written backup_path=$lobsterOldInstallBackupPath$\r$\n"
    FileClose $2
  InstallFinalizeNoRename:

  ; A successful rename keeps the old tree intact during extraction. P0.5
  ; deliberately keeps that backup after commit: an asynchronous path-only
  ; delete cannot revalidate object identity or an exact app-owned delete set.
  ${If} $lobsterOldInstallRenameStatus == "committed"
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=old-install-backup-preserved attempt_id=$lobsterInstallerAttemptId backup_path=$lobsterOldInstallBackupPath cleanup_mode=disabled-p0.5$\r$\n"
    FileClose $2
  ${EndIf}
  Goto InstallFinalizeComplete

  InstallFinalizeInvariantFailed:
    ; The version-pinned template contract guarantees the pre-registry hook.
    ; Fail visibly if that contract is ever broken instead of silently
    ; finalizing an unvalidated tree.
    FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
    FileSeek $2 0 END
    !insertmacro GetTimestamp $8
    FileWrite $2 "$8 phase=install-finalize-invariant-failed attempt_id=$lobsterInstallerAttemptId validation_status=$lobsterNewInstallValidationStatus rename_status=$lobsterOldInstallRenameStatus$\r$\n"
    FileClose $2
    SetErrorLevel 2
    Quit

  InstallFinalizeComplete:
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" a
  FileSeek $2 0 END
  !insertmacro GetTimestamp $8
  FileWrite $2 "$8 phase=install-complete attempt_id=$lobsterInstallerAttemptId action=$lobsterInstallAction basis=$lobsterInstallActionBasis$\r$\n"
  FileClose $2
  DetailPrint "[Installer] Installation complete"

  ${If} ${Silent}
    Banner::destroy
  ${EndIf}
!macroend

; customUnInit intentionally not defined: the uninstaller stops app processes
; through customCheckAppRunning above, which the template invokes after the
; user confirms the uninstall (assisted mode) or immediately for silent /S
; uninstalls. Merely opening the uninstaller no longer kills the running app.

!macro customUnInstall
  ; -- Remove Windows Defender Exclusion on uninstall --
  ; Clean up every exclusion any installer version may have added: the
  ; current permanent set, the SKILLs entry from older versions, the
  ; single-file entries from the path-list era, and the install-scope
  ; whole-directory entry in case an install was interrupted before its
  ; rebalance step ran.
  !insertmacro ResolveTrustedPowerShell
  StrCmp $lobsterTrustedPowerShellPath "" DefenderUninstallCleanupDone
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "$INSTDIR")i'
  nsExec::ExecToStack '"$lobsterTrustedPowerShellPath" -NoProfile -NonInteractive -Command "try { $$root = $$env:LOBSTERAI_INSTALL_ROOT; $$targets = @($$root, (Join-Path $$root \"resources\cfmind\"), (Join-Path $$root \"resources\python-win\"), (Join-Path $$root \"resources\SKILLs\"), (Join-Path $$root \"resources\app.asar.unpacked\"), (Join-Path $$root \"resources\win-resources.tar\"), (Join-Path $$root \"resources\app.asar\")); Remove-MpPreference -ExclusionPath $$targets -ErrorAction SilentlyContinue } catch {}"'
  Pop $0
  Pop $1
  System::Call 'Kernel32::SetEnvironmentVariable(t "LOBSTERAI_INSTALL_ROOT", t "")i'
  DefenderUninstallCleanupDone:
!macroend
