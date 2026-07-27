import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

const repoFile = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

const installerInclude = repoFile('scripts/nsis-installer.nsh');
const installSection = repoFile(
  'node_modules/app-builder-lib/templates/nsis/installSection.nsh',
);
const extractTemplate = repoFile(
  'node_modules/app-builder-lib/templates/nsis/include/extractAppPackage.nsh',
);
const installerTemplate = repoFile(
  'node_modules/app-builder-lib/templates/nsis/include/installer.nsh',
);
const installUtilTemplate = repoFile(
  'node_modules/app-builder-lib/templates/nsis/include/installUtil.nsh',
);
const rootInstallerTemplate = repoFile(
  'node_modules/app-builder-lib/templates/nsis/installer.nsi',
);
const webPackageTemplate = repoFile(
  'node_modules/app-builder-lib/templates/nsis/include/webPackage.nsh',
);
const appBuilderPatch = repoFile('patches/app-builder-lib+24.13.3.patch');
const electronBuilderConfig = JSON.parse(repoFile('electron-builder.json')) as {
  nsis?: {
    deleteAppDataOnUninstall?: boolean;
    oneClick?: boolean;
  };
};

// TypeScript model of the NSIS install-root action planner: live registry
// candidates (stale values are reconciled away before this decision), one
// target enumeration, and footprint probing produce exactly one action.
const planInstallRootAction = ({
  liveCandidateDirs = [],
  targetPath = 'c:/users/u/appdata/local/programs/lobsterai',
  entries,
  enumerationError,
  footprint = false,
}: {
  liveCandidateDirs?: string[];
  targetPath?: string;
  entries?: string[];
  enumerationError?: number;
  footprint?: boolean;
}): 'fresh-install' | 'update-in-place' | 'repair-in-place' | 'blocked-conflict' => {
  const distinct = [...new Set(liveCandidateDirs.map((dir) => dir.toLowerCase()))];
  let dirState: 'missing' | 'empty' | 'nonempty' | 'error';
  if (enumerationError !== undefined) {
    dirState =
      enumerationError === 2 ? 'missing' : enumerationError === 18 ? 'empty' : 'error';
  } else {
    dirState = entries?.some((entry) => entry !== '.' && entry !== '..')
      ? 'nonempty'
      : 'empty';
  }
  if (dirState === 'error') {
    return 'blocked-conflict';
  }
  if (distinct.length > 1) {
    return 'blocked-conflict';
  }
  if (distinct.length === 1) {
    if (distinct[0] !== targetPath.toLowerCase()) {
      return 'blocked-conflict';
    }
    if (dirState !== 'nonempty') {
      return 'fresh-install';
    }
    return footprint ? 'update-in-place' : 'blocked-conflict';
  }
  if (dirState !== 'nonempty') {
    return 'fresh-install';
  }
  return footprint ? 'repair-in-place' : 'blocked-conflict';
};

const classifyInstallLocationProbe = ({
  attributes,
  lastError = 0,
}: {
  attributes: number;
  lastError?: number;
}): 'live' | 'stale' | 'blocked' => {
  if (attributes === -1) {
    return lastError === 2 || lastError === 3 ? 'stale' : 'blocked';
  }
  return (attributes & 0x10) !== 0 ? 'live' : 'stale';
};

const classifyUninstallEntry = (
  rawValue: string,
  probe: (path: string) => { attributes: number; lastError?: number } = () => ({
    attributes: -1,
    lastError: 2,
  }),
): 'absent' | 'live' | 'stale' | 'unknown' => {
  if (!rawValue) {
    return 'absent';
  }

  let executablePath = rawValue;
  let quoted = false;
  if (!rawValue.startsWith('"')) {
    executablePath = rawValue;
  } else {
    const closingQuote = rawValue.indexOf('"', 1);
    if (closingQuote < 0) {
      return 'unknown';
    }
    executablePath = rawValue.slice(1, closingQuote);
    quoted = true;
    if (!executablePath) {
      return 'unknown';
    }
  }

  const { attributes, lastError = 0 } = probe(executablePath);
  if (attributes === -1) {
    return quoted && (lastError === 2 || lastError === 3) ? 'stale' : 'unknown';
  }
  return (attributes & 0x10) === 0 ? 'live' : 'unknown';
};

describe('Windows installer hardening contracts', () => {
  test('releases the installer current-directory lock before the update rename', () => {
    const switchOutPath = installerInclude.indexOf('SetOutPath "$PLUGINSDIR"');
    const rename = installerInclude.indexOf(
      'MoveFileW(w "$lobsterOldInstallOriginalPath", w "$lobsterOldInstallBackupPath")',
    );

    expect(switchOutPath).toBeGreaterThan(-1);
    expect(rename).toBeGreaterThan(switchOutPath);
    expect(installerInclude).toContain('phase=old-install-rename-attempt');
    expect(installerInclude).toContain('phase=old-install-rename-complete attempt_id=');
    expect(installerInclude).toContain('status=$lobsterOldInstallRenameStatus');
    expect(installerInclude).not.toContain('phase=old-install-cleanup-complete');
    expect(installerInclude).not.toContain('phase=old-install-cleanup-scheduled');
  });

  test('stages planner-approved installs without an updated-flag gate', () => {
    const renameStart = installerInclude.indexOf('phase=old-install-rename-start');
    const renameAttempt = installerInclude.indexOf('OldInstallRenameAttempt:');
    const trigger = installerInclude.slice(renameStart, renameAttempt);

    // The stage rename is driven by the planner action, not by the in-app
    // --updated invocation, and re-checks the footprint right before moving.
    expect(trigger).toContain('"action-not-staging"');
    expect(trigger).toContain(
      'StrCmp $lobsterInstallAction "update-in-place" OldInstallRenameActionEligible',
    );
    expect(trigger).toContain(
      'StrCmp $lobsterInstallAction "repair-in-place" OldInstallRenameActionEligible',
    );
    expect(trigger).toContain('IfFileExists "$lobsterOldInstallOriginalPath\\${APP_EXECUTABLE_FILENAME}"');
    expect(trigger).toContain('IfFileExists "$lobsterOldInstallOriginalPath\\${UNINSTALL_FILENAME}"');
    expect(trigger).not.toContain('${isUpdated}');
    expect(installerInclude).not.toContain('${IfNot} ${isUpdated}');
    expect(installerInclude).not.toContain('"ambiguous-dual-registration"');
    expect(installerInclude).not.toContain('"install-location-mismatch"');
  });

  test('reconciles stale registration values only when their target is gone', () => {
    const locStart = installerInclude.indexOf('!macro LobsterPlanInstallLocationValue');
    const locEnd = installerInclude.indexOf('!macroend', locStart);
    const loc = installerInclude.slice(locStart, locEnd);
    const unStart = installerInclude.indexOf('!macro LobsterPlanUninstallValue');
    const unEnd = installerInclude.indexOf('!macroend', unStart);
    const un = installerInclude.slice(unStart, unEnd);

    // Only definitive not-found errors can authorize stale cleanup. Access
    // denial and every other probe failure preserve the registration and
    // select the planner's fail-closed exit.
    expect(loc).toContain('kernel32::GetFileAttributesW(w "${VALUEVAR}") i .r4 ?e');
    expect(loc).toContain('Pop $6');
    expect(loc).toContain(
      'IntCmp $6 ${LOBSTER_WIN32_ERROR_FILE_NOT_FOUND} LobsterPlanLoc${TAG}Stale',
    );
    expect(loc).toContain(
      'IntCmp $6 ${LOBSTER_WIN32_ERROR_PATH_NOT_FOUND} LobsterPlanLoc${TAG}Stale',
    );
    expect(loc).toContain('Goto LobsterPlanRegistryProbeFailed');
    expect(loc).not.toContain('IntCmp $4 -1 LobsterPlanLoc${TAG}Stale');
    expect(loc).toContain('DeleteRegValue ${HIVE} "${INSTALL_REGISTRY_KEY}" InstallLocation');
    expect(loc).toContain('state=error');
    expect(loc).toContain('state=stale-cleanup-failed');

    // A quoted command proves an exact executable path. Unquoted or malformed
    // commands that cannot be resolved as a whole remain unknown and cannot
    // authorize deletion of the uninstall key.
    expect(un).toContain('Call lobsterResolveUninstallEntry');
    expect(installerInclude).toContain(
      'System::Call \'kernel32::GetFileAttributesW(w "$0") i .r1 ?e\'',
    );
    expect(installerInclude).toContain(
      'IntCmp $2 ${LOBSTER_WIN32_ERROR_FILE_NOT_FOUND} LobsterResolveUninstallEntryStale',
    );
    expect(installerInclude).toContain(
      'IntCmp $2 ${LOBSTER_WIN32_ERROR_PATH_NOT_FOUND} LobsterResolveUninstallEntryStale',
    );
    expect(installerInclude).toContain('target-is-directory');
    expect(un).toContain(
      'StrCmp $R7 "${LOBSTER_UNINSTALL_ENTRY_STALE}" LobsterPlanUn${TAG}Stale',
    );
    expect(un).toContain('state=unknown');
    expect(un).toContain('Goto LobsterPlanRegistryProbeFailed');
    expect(un).toContain('DeleteRegKey ${HIVE} "${UNINSTALL_REGISTRY_KEY}"');
    expect(installerInclude.match(/^\s*DeleteRegValue /gm)).toHaveLength(1);
    expect(installerInclude.match(/^\s*DeleteRegKey /gm)).toHaveLength(1);
    expect(installerInclude).toContain('phase=stale-registration-reconciled');
    expect(installerInclude).toContain('"stale-registration-cleanup-failed"');
    expect(installerInclude).toContain('"fresh-stale-candidate-ignored"');
  });

  test('classifies registry probes without turning uncertainty into stale evidence', () => {
    expect(classifyInstallLocationProbe({ attributes: 0x10 })).toBe('live');
    expect(classifyInstallLocationProbe({ attributes: 0 })).toBe('stale');
    expect(classifyInstallLocationProbe({ attributes: -1, lastError: 2 })).toBe('stale');
    expect(classifyInstallLocationProbe({ attributes: -1, lastError: 3 })).toBe('stale');
    expect(classifyInstallLocationProbe({ attributes: -1, lastError: 5 })).toBe('blocked');
    expect(classifyInstallLocationProbe({ attributes: -1, lastError: 32 })).toBe('blocked');

    const executable = String.raw`C:\Program Files\LobsterAI\Uninstall LobsterAI.exe`;
    const executableProbe = (path: string) => ({
      attributes: path === executable ? 0 : -1,
      lastError: 2,
    });
    expect(classifyUninstallEntry(`"${executable}" /S`, executableProbe)).toBe('live');
    expect(classifyUninstallEntry(`"${executable}" /S`)).toBe('stale');
    expect(
      classifyUninstallEntry(`"${executable}" /S`, () => ({
        attributes: -1,
        lastError: 5,
      })),
    ).toBe('unknown');
    expect(
      classifyUninstallEntry(`"${executable}" /S`, () => ({ attributes: 0x10 })),
    ).toBe('unknown');
    expect(classifyUninstallEntry(`${executable} /S`, executableProbe)).toBe('unknown');
    expect(classifyUninstallEntry(`"${executable} /S`, executableProbe)).toBe('unknown');
    const unquotedExecutable = String.raw`C:\LobsterAI\uninstall.exe`;
    expect(
      classifyUninstallEntry(unquotedExecutable, (path) => ({
        attributes: path === unquotedExecutable ? 0 : -1,
        lastError: 2,
      })),
    ).toBe('live');
    expect(classifyUninstallEntry(unquotedExecutable)).toBe('unknown');
  });

  test('captures shortcut state and keeps old-tree execution unreachable', () => {
    const shortcutProbe = installSection.indexOf('Var /GLOBAL keepShortcuts');
    const checkAppRunning = installSection.indexOf('!insertmacro CHECK_APP_RUNNING');
    const oldUninstaller = installSection.indexOf(
      '!insertmacro customUninstallOldVersion SHELL_CONTEXT',
    );
    const postUninstallHook = installSection.indexOf(
      '!insertmacro customAfterUninstallOldVersions',
    );
    const installFiles = installSection.indexOf('!insertmacro installApplicationFiles');

    expect(shortcutProbe).toBeGreaterThan(-1);
    expect(shortcutProbe).toBeLessThan(checkAppRunning);
    expect(oldUninstaller).toBeGreaterThan(checkAppRunning);
    expect(postUninstallHook).toBeGreaterThan(oldUninstaller);
    expect(postUninstallHook).toBeLessThan(installFiles);
    expect(installerInclude).toContain('phase=old-uninstaller-skipped');
    expect(installerInclude).toContain('phase=old-tree-execution-blocked');
    expect(installerInclude).toContain('old_tree_execution=disabled-p0.5');
    expect(installerInclude).not.toContain('phase=old-uninstaller-start');
    expect(installerInclude).not.toContain('phase=old-uninstaller-returned');
    expect(installerInclude).not.toContain('phase=old-uninstaller-complete');

    const wrapperStart = installerInclude.indexOf('!macro customUninstallOldVersion');
    const wrapperEnd = installerInclude.indexOf(
      '!macro customAfterUninstallOldVersions',
      wrapperStart,
    );
    const wrapper = installerInclude.slice(wrapperStart, wrapperEnd);
    expect(wrapper).not.toContain('!insertmacro uninstallOldVersion');
    expect(wrapper).not.toContain('!insertmacro handleUninstallResult');
    expect(installUtilTemplate).toContain('!ifmacrodef customUninstallOldVersion');
    expect(installUtilTemplate).toContain(
      'uninstaller functions entirely so warning-as-error builds do not retain an',
    );
    expect(installUtilTemplate).toContain(
      'ExecWait \'"$uninstallerFileNameTemp" /S /KEEP_APP_DATA',
    );
    expect(installUtilTemplate).toContain(
      'ExecWait \'"$uninstallerFileName" /S /KEEP_APP_DATA',
    );
  });

  test('applies and verifies Defender exclusion only after the no-execution gate', () => {
    expect(installerInclude).toContain('!macro customAfterUninstallOldVersions');
    expect(installerInclude).toContain('point=post-old-tree-execution-gate');
    expect(installerInclude).toContain(
      String.raw`$$target = $$env:LOBSTERAI_INSTALL_ROOT;`,
    );
    expect(installerInclude).toContain('before_count=');
    expect(installerInclude).toContain('remove=');
    expect(installerInclude).toContain('after_count=');
    expect(installerInclude).toContain('Remove-MpPreference -ExclusionPath $$targets');
    expect(installerInclude).toContain('phase=old-install-backup-preserved');
    expect(installerInclude).toContain(
      '${If} $lobsterOldInstallRenameStatus == "committed"',
    );
    expect(installerInclude).toContain('cleanup_mode=disabled-p0.5');
    expect(installerInclude.indexOf('phase=old-install-backup-preserved')).toBeGreaterThan(
      installerInclude.indexOf('phase=defender-exclusion-permanent-complete'),
    );
  });

  test('preserves staged old and failed trees instead of dispatching path-only cleanup', () => {
    expect(installerInclude).toContain('phase=rollback-failed-tree-preserved');
    expect(installerInclude).toContain('phase=old-install-backup-preserved');
    expect(installerInclude).toContain('cleanup_mode=preserve-only-p0.5');
    expect(installerInclude).toContain('cleanup_mode=disabled-p0.5');
    expect(installerInclude).not.toContain('LOBSTERAI_FAILED_CLEANUP_PATH');
    expect(installerInclude).not.toContain('LOBSTERAI_OLD_CLEANUP_PATH');
    expect(installerInclude).not.toContain('cleanup_mode=deferred');
    expect(installerInclude).not.toContain('cleanup_mode=async-exec-after-commit');
  });

  test('splits embedded package extraction, copying, cache, and size phases', () => {
    expect(extractTemplate).toContain('customAppPackageMaterializeStart');
    expect(extractTemplate).toContain('customAppPackageMaterializeEnd');
    expect(extractTemplate).toContain('customAppPackageExtractStart "staging" "${FILE}"');
    expect(extractTemplate).toContain('customAppPackageExtractEnd "staging" "unchecked"');
    expect(extractTemplate).toContain('customAppPackageCopyStart');
    expect(extractTemplate).toContain('customAppPackageCopyEnd "success"');
    expect(extractTemplate).toContain('customAppPackageCopyEnd "error"');
    expect(installerTemplate).toContain('customInstallerCacheCopyStart "installer"');
    expect(installerTemplate).toContain('customInstallerCacheCopyEnd "installer" "success"');
    expect(installerTemplate).toContain('customEstimatedSizeKnown');
    expect(installerTemplate).toContain('customEstimatedSizeScanStart');
    expect(installerTemplate).toContain('customEstimatedSizeScanEnd "$0"');

    const copyStart = extractTemplate.indexOf('customAppPackageCopyStart');
    const clearErrors = extractTemplate.indexOf('ClearErrors', copyStart);
    const copyFiles = extractTemplate.indexOf('CopyFiles /SILENT', copyStart);
    const copyErrorCheck = extractTemplate.indexOf('IfErrors CopyExtract7zaFailed', copyStart);
    expect(clearErrors).toBeGreaterThan(copyStart);
    expect(clearErrors).toBeLessThan(copyFiles);
    expect(copyFiles).toBeLessThan(copyErrorCheck);
  });

  test('rolls a renamed installation back before every controlled failure exit', () => {
    expect(installerInclude).toContain('Function lobsterRollbackOldInstall');
    expect(installerInclude).toContain('phase=old-install-rollback-start');
    expect(installerInclude).toContain('phase=old-install-rollback-complete');
    expect(installerInclude).toContain('phase=old-install-commit-complete');
    expect(installerInclude).toContain('phase=skill-backup-failed-abort');
    expect(installerInclude).toContain('phase=skill-restore-failed');
    expect(installerInclude).toContain(
      'StrCmp $lobsterOldInstallRollbackStatus "success"',
    );
    expect(installerInclude).toContain('!macro customBeforeInstallerQuit REASON');
    expect(rootInstallerTemplate).toContain('!define MUI_CUSTOMFUNCTION_ABORT');
    expect(rootInstallerTemplate).toContain('Function .onInstFailed');
    expect(extractTemplate).toContain(
      '!insertmacro customBeforeInstallerQuit "payload-copy-aborted"',
    );
    expect(webPackageTemplate).toContain(
      '!insertmacro customBeforeInstallerQuit "web-package-download-cancelled"',
    );

    const commit = installerInclude.indexOf('phase=old-install-commit-complete');
    const preserved = installerInclude.indexOf('phase=old-install-backup-preserved');
    expect(commit).toBeGreaterThan(-1);
    expect(preserved).toBeGreaterThan(commit);
  });

  test('terminates the attempt after rename verification rollback', () => {
    const start = installerInclude.indexOf('OldInstallRenameVerificationFailed:');
    const end = installerInclude.indexOf('OldInstallRenameComplete:', start);
    const failure = installerInclude.slice(start, end);

    expect(failure).toContain(
      '!insertmacro customRollbackOldInstall "rename-verification-failed"',
    );
    expect(failure).toContain(
      'StrCmp $lobsterOldInstallRollbackStatus "success" OldInstallRenameVerificationRestored',
    );
    expect(failure).toContain('outcome=recovery-required');
    expect(failure).toContain('outcome=restored');
    expect(failure).toContain('SetErrorLevel 3');
    expect(failure).toContain('SetErrorLevel 2');
    expect(failure.match(/^\s+Quit$/gm)).toHaveLength(2);
    expect(failure).not.toContain('Goto OldInstallRenameComplete');
  });

  test('plans the install-root action before helpers and blocks before any process stop', () => {
    const checkStart = installerInclude.indexOf('!macro customCheckAppRunning');
    const checkEnd = installerInclude.indexOf('!macro customUninstallOldVersion', checkStart);
    const check = installerInclude.slice(checkStart, checkEnd);
    const preflight = check.indexOf('!insertmacro PlanInstallRootAction');
    const blocked = check.indexOf('StrCmp $lobsterInstallAction "blocked-conflict"');
    const sourceProbe = check.indexOf('phase=legacy-skills-source-preflight');
    const resolver = check.indexOf('!insertmacro ResolveTrustedPowerShell');
    const stop = check.indexOf('!insertmacro stopLobsterAIProcesses');
    const backup = check.indexOf('phase=skill-backup-complete');

    expect(preflight).toBeGreaterThan(-1);
    // A blocked-conflict decision terminates the attempt before the running
    // application is stopped or any backup helper is launched.
    expect(blocked).toBeGreaterThan(preflight);
    expect(blocked).toBeLessThan(sourceProbe);
    expect(sourceProbe).toBeGreaterThan(preflight);
    expect(resolver).toBeGreaterThan(sourceProbe);
    expect(stop).toBeGreaterThan(resolver);
    expect(backup).toBeGreaterThan(stop);
    expect(check).toContain(
      'StrCmp $lobsterInstallAction "fresh-install" CustomCheckFreshInstall',
    );
    expect(check).toContain('Call lobsterPrepareBlockedTerminalText');
    expect(check).toContain('Call lobsterAbortOldTreeExecution');
    expect(check).toContain('phase=install-blocked-preflight');
    expect(check).toContain('phase=fresh-install-old-flow-skipped');
    expect(check).toContain('"legacy-not-applicable-fresh-install"');

    const blockedSlice = check.slice(blocked, sourceProbe);
    expect(blockedSlice).toMatch(/^\s+Return$/m);
  });

  test('maps install-root evidence onto the five planner actions', () => {
    const target = 'c:/users/u/appdata/local/programs/lobsterai';

    // Fresh only for an enumerably empty/absent target with no live evidence.
    expect(planInstallRootAction({ entries: [] })).toBe('fresh-install');
    expect(planInstallRootAction({ entries: ['.', '..'] })).toBe('fresh-install');
    expect(planInstallRootAction({ enumerationError: 2 })).toBe('fresh-install');
    expect(planInstallRootAction({ enumerationError: 18 })).toBe('fresh-install');
    expect(planInstallRootAction({ enumerationError: 5 })).toBe('blocked-conflict');

    // Registered match: footprint decides between staging and blocking.
    expect(
      planInstallRootAction({
        liveCandidateDirs: [target],
        entries: ['.', '..', 'LobsterAI.exe'],
        footprint: true,
      }),
    ).toBe('update-in-place');
    expect(
      planInstallRootAction({
        liveCandidateDirs: [target.toUpperCase()],
        entries: ['MyData'],
        footprint: false,
      }),
    ).toBe('blocked-conflict');
    expect(
      planInstallRootAction({ liveCandidateDirs: [target], entries: [] }),
    ).toBe('fresh-install');

    // Orphan trees: our footprint repairs in place, foreign content blocks.
    expect(
      planInstallRootAction({ entries: ['LobsterAI.exe'], footprint: true }),
    ).toBe('repair-in-place');
    expect(
      planInstallRootAction({ entries: ['node_modules'], footprint: false }),
    ).toBe('blocked-conflict');

    // Relocations and distinct dual registrations fail closed.
    expect(
      planInstallRootAction({
        liveCandidateDirs: ['c:/program files/lobsterai'],
        entries: [],
      }),
    ).toBe('blocked-conflict');
    expect(
      planInstallRootAction({
        liveCandidateDirs: [target, 'c:/program files/lobsterai'],
        entries: ['.', '..', 'LobsterAI.exe'],
        footprint: true,
      }),
    ).toBe('blocked-conflict');

    const start = installerInclude.indexOf('!macro PlanInstallRootAction');
    const end = installerInclude.indexOf('!macroend', start);
    const planner = installerInclude.slice(start, end);
    expect(planner).toContain('FindFirst $4 $5 "$INSTDIR\\*"');
    expect(planner).toContain('FindNext $4 $5');
    expect(planner).toContain('StrCmp $5 "."');
    expect(planner).toContain('StrCmp $5 ".."');
    expect(planner).toContain('IntCmp $6 2 LobsterPlanEnumMissing');
    expect(planner).toContain('IntCmp $6 18 LobsterPlanEnumDone');
    expect(planner).not.toContain('IfFileExists "$INSTDIR\\*"');
    expect(planner).not.toContain('IfFileExists "$INSTDIR\\*.*"');
    expect(planner).toContain('"update-in-place"');
    expect(planner).toContain('"repair-in-place"');
    expect(planner).toContain('"blocked-conflict"');
    expect(planner).toContain('"registered-target-empty"');
    expect(planner).toContain('"relocate-existing-install"');
    expect(planner).toContain('"dual-registration-paths"');
    expect(planner).toContain('"target-scan-error"');
    expect(planner).toContain('phase=install-root-planned');
  });

  test('records blocked evidence losslessly and drops the misleading remedy copy', () => {
    // Evidence lines carry non-ASCII paths, so they go to a UTF-16LE log.
    const evidenceStart = installerInclude.indexOf('!macro LobsterWriteEvidenceLine');
    const evidenceEnd = installerInclude.indexOf('!macroend', evidenceStart);
    const evidence = installerInclude.slice(evidenceStart, evidenceEnd);
    expect(evidence).toContain('install-evidence.log');
    expect(evidence).toContain('FileWriteUTF16LE /BOM $9 ""');
    expect(evidence).toContain('FileWriteUTF16LE $9 "$8 ${LINE}$\\r$\\n"');
    expect(installerInclude).toContain('phase=install-root-entries');
    expect(installerInclude).toContain('!macro LobsterRecordRegistryInput');
    expect(installerInclude).toContain(
      '!insertmacro LobsterRecordRegistryInput hkcu InstallLocation $0 hkcuLoc',
    );
    expect(installerInclude).toContain(
      '!insertmacro LobsterRecordRegistryInput hklm InstallLocation $1 hklmLoc',
    );
    expect(installerInclude).toContain(
      '!insertmacro LobsterRecordRegistryInput hkcu UninstallString $2 hkcuUn',
    );
    expect(installerInclude).toContain(
      '!insertmacro LobsterRecordRegistryInput hklm UninstallString $3 hklmUn',
    );
    expect(installerInclude).toContain('phase=install-root-registry-evidence');
    expect(installerInclude).toContain('state=absent');
    expect(installerInclude).toContain('state=present');
    expect(installerInclude).toContain('state=live normalized_path=[');
    expect(installerInclude).toContain('state=error raw_path=[');
    expect(installerInclude).toContain('state=unknown raw_path=[');
    expect(installerInclude).toContain('registry_error=$lobsterPreflightRegistryError');

    // The blocked terminal page names the blocking entries and the accurate
    // remedy; the old "move personal files out" copy is gone in both languages.
    expect(installerInclude).toContain('Function lobsterPrepareBlockedTerminalText');
    expect(installerInclude).toContain('LOBSTER_INSTALL_BLOCKED_UNPROVEN_ZH');
    expect(installerInclude).toContain('LOBSTER_INSTALL_BLOCKED_ITEMS_A_ZH');
    expect(installerInclude).toContain('$lobsterPreflightEntrySample');
    expect(installerInclude).not.toContain('Move personal files out');
    expect(installerInclude).not.toContain('${U+79FB}${U+51FA}');

    // Pre-composed evidence text survives the abort path unless the outcome
    // escalates to recovery-required.
    const abortStart = installerInclude.indexOf('Function lobsterAbortOldTreeExecution');
    const abortEnd = installerInclude.indexOf('FunctionEnd', abortStart);
    const abort = installerInclude.slice(abortStart, abortEnd);
    expect(abort).toContain(
      'StrCmp $lobsterInstallerTerminalOutcome "recovery-required" LobsterOldTreeExecutionChooseLanguageDefault',
    );
    expect(abort).toContain(
      'StrCmp $lobsterInstallerTerminalText "" LobsterOldTreeExecutionChooseLanguageDefault LobsterOldTreeExecutionLog',
    );
  });

  test('resolves PowerShell and tar only from trusted absolute system paths', () => {
    expect(installerInclude).toContain(
      String.raw`$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe`,
    );
    expect(installerInclude).toContain(
      String.raw`$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe`,
    );
    expect(installerInclude).toContain(String.raw`$WINDIR\Sysnative\tar.exe`);
    expect(installerInclude).toContain(String.raw`$WINDIR\System32\tar.exe`);
    expect(installerInclude).toContain(
      String.raw`nsExec::ExecToLog '"$lobsterTrustedTarPath"`,
    );
    expect(installerInclude).not.toMatch(
      /(?:nsExec::\w+|Exec)\s+['"][^'"\n]*\bpowershell(?:\.exe)?\b/i,
    );
    expect(installerInclude).not.toContain(String.raw`$SYSDIR\tar.exe`);

    const interpretedCommands = installerInclude
      .split('\n')
      .filter((line) => /(?:nsExec::\w+|Exec).*-Command/.test(line));
    expect(interpretedCommands.length).toBeGreaterThan(0);
    for (const command of interpretedCommands) {
      expect(command).toContain('$lobsterTrustedPowerShellPath');
      expect(command).not.toMatch(/\$(?:INSTDIR|APPDATA|lobsterOldInstall\w*)/);
    }
  });

  test('uses typed helper outcomes and a marker-backed ten-minute watchdog', () => {
    const watchdogStart = installerInclude.indexOf('LOBSTERAI_WATCHDOG_MARKER_PATH');
    const watchdogEnd = installerInclude.indexOf('TarExtractVerify:', watchdogStart);
    const watchdog = installerInclude.slice(watchdogStart, watchdogEnd);

    expect(installerInclude).toContain('"process-start-blocked"');
    expect(installerInclude).toContain('"numeric-exit-code"');
    expect(installerInclude).toContain('"legacy-helper-launch-failed"');
    expect(watchdog).toContain('WaitForExit(600000)');
    expect(watchdog).toContain('WaitForExit(30000)');
    expect(watchdog).toContain('"process-timeout"');
    expect(watchdog).toContain('"process-termination-failed"');
    expect(watchdog).toContain('LOBSTERAI_WATCHDOG_TIMEOUT');
    expect(watchdog).toContain('LOBSTERAI_WATCHDOG_TERMINATION_FAILED');
    expect(watchdog).toContain('function Write-LobsterWatchdogMarker');
    expect(watchdog).toContain(
      'LOBSTERAI_WATCHDOG_MARKER_WRITE_FAILED:',
    );
    expect(
      watchdog.match(/Set-Content -LiteralPath \$\$marker/g),
    ).toHaveLength(1);
    expect(watchdog.indexOf('StrCmp $R2 "error"')).toBeLessThan(
      watchdog.indexOf('IntCmp $R2 0'),
    );
    expect(watchdog).toContain(
      'StrCmp $R2 "126" TarExtractTerminationFailed',
    );
    expect(
      watchdog.indexOf('StrCmp $R2 "126" TarExtractTerminationFailed'),
    ).toBeLessThan(
      watchdog.indexOf(
        'StrCmp $R4 "process-termination-failed" TarExtractTerminationFailed',
      ),
    );
    expect(watchdog).toContain(
      'StrCmp $R4 "process-timeout" 0 TarExtractNumericResult',
    );
    expect(watchdog).toContain('StrCmp $R2 "124" TarExtractTimeout');
  });

  test('binds Skills backup and restore to the current attempt manifest', () => {
    expect(installerInclude).toContain('backup-manifest.json');
    expect(installerInclude).toContain('schemaVersion = 1');
    expect(installerInclude).toContain('attemptId = $$attempt');
    expect(installerInclude).toContain('source = $$src');
    expect(installerInclude).toContain('oldVersion = $$oldVer');
    expect(installerInclude).toContain('skills = @($$userSkills.Name');
    expect(installerInclude).toContain('directories = $$directories');
    expect(installerInclude).toContain('files = $$files');
    expect(installerInclude).toContain('statistics = [ordered]@{');
    expect(installerInclude).toContain('Get-FileHash -LiteralPath');
    expect(installerInclude).toContain('$$verified.validation.status = \\"verified\\"');
    expect(installerInclude).toContain(
      'StrCmp $lobsterLegacySkillsStatus "legacy-backup-succeeded" 0 SkipSkillRestore',
    );
    expect(installerInclude).toContain('if ($$manifest.attemptId -ne $$attempt)');
    expect(installerInclude).toContain('if ($$manifest.source -ne $$source)');
    expect(installerInclude).toContain(
      String.raw`skills-backup\$lobsterInstallerAttemptId`,
    );
    expect(installerInclude).not.toContain(String.raw`skills-backup\*.*`);

    const restoreStart = installerInclude.indexOf(
      'StrCmp $lobsterLegacySkillsStatus "legacy-backup-succeeded" 0 SkipSkillRestore',
    );
    const restoreEnd = installerInclude.indexOf('SkipSkillRestore:', restoreStart);
    const restore = installerInclude.slice(restoreStart, restoreEnd);
    expect(restore).toContain(
      'IfFileExists "$APPDATA\\LobsterAI\\skills-backup\\$lobsterInstallerAttemptId\\backup-manifest.json" SkillRestoreAttemptBackupReady',
    );
    expect(restore).toContain('"legacy-restore-backup-missing"');
    expect(restore).toContain('Write-Output (\\"name-conflict:\\"');
    expect(restore).toContain('exit 20');
    expect(restore).toContain('"legacy-restore-name-conflict"');
    expect(restore).toContain('phase=skill-restore-conflict-preserved');
    expect(restore).toContain('phase=skill-restore-degraded');
    expect(restore.indexOf('$$conflicts = @(')).toBeLessThan(
      restore.indexOf('Remove-Item -LiteralPath $$backup'),
    );
  });

  test('appends attempt-correlated logs and records conservative provenance', () => {
    const initStart = installerInclude.indexOf('!macro customInit');
    const initEnd = installerInclude.indexOf('!macroend', initStart);
    const init = installerInclude.slice(initStart, initEnd);
    expect(installerInclude).toContain(
      "System::Call 'ole32::CoCreateGuid(g .s)'",
    );
    expect(installerInclude).toContain('RequestExecutionLevel admin');
    expect(init).toContain('!insertmacro EnsureInstallerAttemptId');
    expect(init.indexOf('!insertmacro EnsureInstallerAttemptId')).toBeLessThan(
      init.indexOf('FileOpen $9'),
    );
    expect(init).toContain(
      'FileOpen $9 "$APPDATA\\LobsterAI\\install-timing.log" a',
    );
    expect(init).toContain('FileSeek $9 0 END');
    expect(init).not.toContain(
      'FileOpen $9 "$APPDATA\\LobsterAI\\install-timing.log" w',
    );
    expect(init).toContain('StrCpy $lobsterInvocationSource "unknown"');
    expect(init).toContain('${If} ${isUpdated}');
    expect(init).toContain('${AndIf} ${isForceRun}');
    expect(init).toContain('StrCpy $lobsterInvocationSource "app-update"');
    expect(installerInclude).toContain(
      '!define LOBSTER_INSTALL_UI_MODE_WIZARD "wizard"',
    );
    expect(installerInclude).toContain(
      '!define LOBSTER_INSTALL_UI_MODE_PROGRESS_VISIBLE "progress-visible"',
    );
    expect(installerInclude).toContain(
      '!define LOBSTER_INSTALL_UI_MODE_SILENT "silent"',
    );
    expect(init).toContain(
      'StrCpy $lobsterUiMode "${LOBSTER_INSTALL_UI_MODE_WIZARD}"',
    );
    expect(init).toContain(
      [
        '${If} ${Silent}',
        '    StrCpy $lobsterUiMode "${LOBSTER_INSTALL_UI_MODE_SILENT}"',
        '  ${ElseIf} ${isUpdated}',
        '    StrCpy $lobsterUiMode "${LOBSTER_INSTALL_UI_MODE_PROGRESS_VISIBLE}"',
        '  ${EndIf}',
      ].join('\n'),
    );
    expect(init).not.toContain('StrCpy $lobsterUiMode "interactive"');
    expect(init).toContain('launcher_fallback=$lobsterLauncherFallback');

    const phaseWrites = installerInclude
      .split('\n')
      .filter((line) => /FileWrite .*phase=/.test(line));
    expect(phaseWrites.length).toBeGreaterThan(0);
    for (const phaseWrite of phaseWrites) {
      expect(phaseWrite).toContain('attempt_id=');
    }
  });

  test('prevalidates before registration and commits only in the standard finalize hook', () => {
    const installFiles = installSection.indexOf('!insertmacro installApplicationFiles');
    const prepare = installSection.indexOf(
      '!insertmacro customBeforeRegistryAddInstallInfo',
    );
    const registry = installSection.indexOf('!insertmacro registryAddInstallInfo');
    const shortcuts = installSection.indexOf('!insertmacro addStartMenuLink');
    const finalize = installSection.indexOf('!insertmacro customInstall', prepare + 1);
    const prepareMacro = installerInclude.indexOf(
      '!macro customBeforeRegistryAddInstallInfo',
    );
    const prevalidated = installerInclude.indexOf(
      'phase=new-install-prevalidated',
      prepareMacro,
    );
    const finalizeMacro = installerInclude.indexOf('!macro customInstall', prepareMacro + 1);
    const committed = installerInclude.indexOf(
      'phase=old-install-commit-complete',
      finalizeMacro,
    );

    expect(prepare).toBeGreaterThan(installFiles);
    expect(registry).toBeGreaterThan(prepare);
    expect(shortcuts).toBeGreaterThan(registry);
    expect(finalize).toBeGreaterThan(shortcuts);
    expect(prevalidated).toBeGreaterThan(prepareMacro);
    expect(prevalidated).toBeLessThan(finalizeMacro);
    expect(committed).toBeGreaterThan(finalizeMacro);
    expect(installerInclude).toContain(
      'StrCmp $lobsterOldInstallRenameStatus "prevalidated" 0 LobsterRollbackDone',
    );
    expect(installerInclude).toContain('registration=not-written');
  });

  test('aborts failed extraction and never treats recovery artifacts as success', () => {
    const failure = installerInclude.slice(
      installerInclude.indexOf('TarExtractFailed:'),
      installerInclude.indexOf('TarExtractDone:'),
    );

    expect(failure).toContain(
      '!insertmacro customRollbackOldInstall "resource-extraction-failed"',
    );
    expect(failure).toContain('SetErrorLevel 3');
    expect(failure).toContain('Quit');
    expect(installerInclude).toContain(
      'IfFileExists "$INSTDIR\\resources\\cfmind\\gateway-bundle.mjs"',
    );
    expect(installerInclude).not.toContain('runtime-and-recovery-artifacts-missing');
    expect(installerInclude).not.toContain('retry the extraction automatically');
    expect(installerInclude.indexOf('TarExtractSucceeded:')).toBeLessThan(
      installerInclude.indexOf('Delete "$INSTDIR\\resources\\win-resources.tar"'),
    );
    expect(installerInclude).toContain('Recovery files (if any):');
    expect(installerInclude).not.toContain('Previous files (if staged):');
  });

  test('defers old-app relaunch until the terminal page closes and requires inventory trust', () => {
    const start = installerInclude.indexOf('Function lobsterTryRelaunchOldApp');
    const end = installerInclude.indexOf('FunctionEnd', start);
    const relaunch = installerInclude.slice(start, end);
    const rollbackStart = installerInclude.indexOf(
      'Function lobsterRollbackOldInstall',
    );
    const rollbackEnd = installerInclude.indexOf('FunctionEnd', rollbackStart);
    const rollback = installerInclude.slice(rollbackStart, rollbackEnd);
    const completeStart = installerInclude.indexOf(
      'Function lobsterCompleteTerminalResult',
    );
    const completeEnd = installerInclude.indexOf('FunctionEnd', completeStart);
    const complete = installerInclude.slice(completeStart, completeEnd);
    const initStart = installerInclude.indexOf('!macro customInit');
    const initEnd = installerInclude.indexOf('!macroend', initStart);
    const init = installerInclude.slice(initStart, initEnd);

    expect(relaunch).toContain(
      'StrCmp $lobsterOldAppExecutionTrust "trusted-inventory-hash" 0 LobsterOldAppRelaunchLog',
    );
    expect(relaunch).toContain('${StdUtils.TestParameter} $0 "updated"');
    expect(relaunch).toContain('${StdUtils.TestParameter} $0 "force-run"');
    expect(relaunch).toContain('IfSilent 0 LobsterOldAppRelaunchInteractive');
    expect(relaunch).toContain(
      'StrCmp $lobsterTargetProcessesStopStatus "success"',
    );
    expect(installerInclude).toContain(
      'StrCpy $lobsterOldAppAsarPath "$INSTDIR\\resources\\app.asar"',
    );
    expect(relaunch).toContain('$lobsterOldAppAsarPath');
    expect(relaunch).toContain('IntOp $1 $0 & 0x410');
    expect(relaunch).toContain(
      '${StdUtils.ExecShellAsUser} $0 "$lobsterOldAppExecutablePath" "open" ""',
    );
    expect(relaunch).toContain('StrCmp $0 "0" LobsterOldAppRelaunchSucceeded');
    expect(relaunch).toContain('"old-app-relaunch-failed"');
    expect(init).toContain(
      'StrCpy $lobsterOldAppExecutionTrust "not-evaluated-p0.5"',
    );
    expect(rollback).not.toContain('Call lobsterTryRelaunchOldApp');
    expect(complete).toContain(
      'StrCmp $lobsterInstallerTerminalOutcome "recovery-required" LobsterTerminalCompleteNoRelaunch',
    );
    expect(complete).toContain(
      'StrCmp $lobsterInstallerTerminalPageState "visible" LobsterTerminalCompleteStart',
    );
    expect(complete).not.toContain(
      'StrCmp $lobsterInstallerTerminalPageState "ready" LobsterTerminalCompleteStart',
    );
    expect(complete).toContain('Call lobsterTryRelaunchOldApp');
    expect(complete.indexOf('Call lobsterTryRelaunchOldApp')).toBeLessThan(
      complete.indexOf(
        'StrCpy $lobsterInstallerTerminalPageState "closed"',
      ),
    );
    expect(
      installerInclude.match(/^\s*Call lobsterTryRelaunchOldApp$/gm),
    ).toHaveLength(1);
  });

  test('uses an installer-native terminal page for assisted guard failures', () => {
    const finishStart = installerInclude.indexOf('!macro customFinishPage');
    const finishEnd = installerInclude.indexOf('!macroend', finishStart);
    const finish = installerInclude.slice(finishStart, finishEnd);
    const abortStart = installerInclude.indexOf(
      'Function lobsterAbortOldTreeExecution',
    );
    const abortEnd = installerInclude.indexOf('FunctionEnd', abortStart);
    const abort = installerInclude.slice(abortStart, abortEnd);
    const wrapperStart = installerInclude.indexOf('!macro customUninstallOldVersion');
    const wrapperEnd = installerInclude.indexOf('!macroend', wrapperStart);
    const wrapper = installerInclude.slice(wrapperStart, wrapperEnd);

    expect(electronBuilderConfig.nsis?.oneClick).toBe(false);
    expect(finish).toContain('Function lobsterTerminalFinishPre');
    expect(finish).toContain('IfSilent LobsterTerminalFinishSkip 0');
    expect(finish).toContain(
      'StrCmp $lobsterInstallerTerminalFailureKind "" LobsterTerminalFinishSkip',
    );
    expect(finish).toContain('!define MUI_FINISHPAGE_LINK');
    expect(finish).toContain('Function lobsterTerminalFinishLeave');
    expect(finish).toContain('Call lobsterCompleteTerminalResult');
    expect(finish).toContain('Function lobsterSuccessFinishPre');
    expect(finish).toContain('${If} ${isUpdated}');
    expect(finish).toContain('Goto LobsterSuccessFinishSkip');
    expect(abort).toContain(
      'StrCpy $lobsterInstallerTerminalPageState "ready"',
    );
    expect(abort).not.toMatch(/^\s*MessageBox\b/m);
    expect(abort).not.toMatch(/^\s+Quit$/m);
    expect(wrapper).toMatch(
      /Call lobsterAbortOldTreeExecution[\s\S]*?;\s*Return ends the install Section[\s\S]*?^\s+Return$/m,
    );
    expect(installerInclude).not.toContain('Banner::show');

    const failedStart = installerInclude.indexOf('!macro customInstallerFailed');
    const failedEnd = installerInclude.indexOf('!macroend', failedStart);
    const failed = installerInclude.slice(failedStart, failedEnd);
    const quitStart = installerInclude.indexOf(
      '!macro customBeforeInstallerQuit',
    );
    const quitEnd = installerInclude.indexOf('!macroend', quitStart);
    const quit = installerInclude.slice(quitStart, quitEnd);
    const userAbortStart = installerInclude.indexOf(
      '!macro customInstallerUserAbort',
    );
    const userAbortEnd = installerInclude.indexOf('!macroend', userAbortStart);
    const userAbort = installerInclude.slice(userAbortStart, userAbortEnd);

    expect(failed).toContain('Call lobsterApplyTerminalExitCode');
    expect(quit).toContain('Call lobsterApplyTerminalExitCode');
    expect(userAbort).toContain('Call lobsterApplyTerminalExitCode');
  });

  test('preserves userData on uninstall by default', () => {
    expect(electronBuilderConfig.nsis?.deleteAppDataOnUninstall).toBe(false);
  });

  test('persists every template hook in the version-pinned patch', () => {
    expect(appBuilderPatch).toContain('templates/nsis/installSection.nsh');
    expect(appBuilderPatch).toContain('templates/nsis/installer.nsi');
    expect(appBuilderPatch).toContain('templates/nsis/include/extractAppPackage.nsh');
    expect(appBuilderPatch).toContain('templates/nsis/include/installer.nsh');
    expect(appBuilderPatch).toContain('templates/nsis/include/installUtil.nsh');
    expect(appBuilderPatch).toContain('templates/nsis/include/webPackage.nsh');
    expect(appBuilderPatch).toContain('!ifmacrodef customUninstallOldVersion');
    expect(appBuilderPatch).toContain('customAfterUninstallOldVersions');
    expect(appBuilderPatch).toContain('customBeforeRegistryAddInstallInfo');
    expect(appBuilderPatch).toContain('customAppPackageExtractStart');
    expect(appBuilderPatch).toContain('customInstallerCacheCopyStart');

    // Preserve the existing explicit web-package URL behavior while updating
    // the larger patch file.
    expect(appBuilderPatch).toContain('Computed URLs point at a directory');
    expect(appBuilderPatch).toContain('defines.APP_PACKAGE_URL_IS_INCOMPLETE = null;');
  });
});
