import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, test, vi } from 'vitest';

const engineTestPaths = vi.hoisted(() => ({
  appPath: process.cwd(),
  userData: process.cwd(),
}));
const engineMaintenanceMocks = vi.hoisted(() => ({
  cleanupStaleThirdPartyPluginsFromBundledDir: vi.fn(() => [] as string[]),
  listLocalOpenClawExtensionIds: vi.fn(() => [] as string[]),
  syncLocalOpenClawExtensionsIntoRuntime: vi.fn(() => ({
    copied: [] as string[],
  })),
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => engineTestPaths.appPath,
    getPath: () => engineTestPaths.userData,
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('./openclawLocalExtensions', () => engineMaintenanceMocks);

import { OpenClawEngineErrorCode } from '../../shared/openclawEngine/constants';
import {
  buildOpenClawCompileCacheEnv,
  buildOpenClawGatewayExecArgv,
  isOpenClawConfigStartupFailure,
  isOpenClawGatewayHeapOutOfMemory,
  OpenClawEngineManager,
} from './openclawEngineManager';
import {
  OpenClawManagedConfigFailureReason,
  OpenClawRuntimeContractFailureReason,
  validateOpenClawManagedConfig,
  validateOpenClawRuntimeContract,
} from './openclawRuntimeContract';

describe('buildOpenClawCompileCacheEnv', () => {
  test('prevents the packaged launcher from respawning Electron Helper', () => {
    expect(buildOpenClawCompileCacheEnv('/tmp/openclaw-cache')).toEqual({
      NODE_COMPILE_CACHE: '/tmp/openclaw-cache',
      OPENCLAW_PACKAGED_COMPILE_CACHE_RESPAWNED: '1',
    });
  });
});

describe('buildOpenClawGatewayExecArgv', () => {
  test('adds a gateway heap limit when NODE_OPTIONS is empty', () => {
    expect(buildOpenClawGatewayExecArgv(undefined)).toEqual(['--max-old-space-size=4096']);
  });

  test('adds a gateway heap limit alongside unrelated NODE_OPTIONS', () => {
    expect(buildOpenClawGatewayExecArgv('--trace-warnings')).toEqual(['--max-old-space-size=4096']);
  });

  test('respects an existing max old space setting with equals syntax', () => {
    expect(buildOpenClawGatewayExecArgv('--max-old-space-size=8192 --trace-warnings')).toEqual([]);
  });

  test('respects an existing max old space setting with space syntax', () => {
    expect(buildOpenClawGatewayExecArgv('--max-old-space-size 8192 --trace-warnings')).toEqual([]);
  });
});

describe('validateOpenClawRuntimeContract', () => {
  const expected = {
    openclawVersion: 'v2026.6.1',
    runSafetyContract: 'count-hardcaps-prompt-observe-v1',
  };

  test('accepts a matching pinned version and run-safety contract', () => {
    expect(validateOpenClawRuntimeContract(expected, {
      ...expected,
      patchHash: 'patch-hash',
    })).toEqual({
      ok: true,
      expected,
      actual: expected,
    });
  });

  test('fails closed when runtime build info has no contract marker', () => {
    expect(validateOpenClawRuntimeContract(expected, {
      openclawVersion: expected.openclawVersion,
    })).toMatchObject({
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.RuntimeBuildInfoMissing,
      expected,
      actual: null,
    });
  });

  test('fails closed when the pinned OpenClaw version differs', () => {
    expect(validateOpenClawRuntimeContract(expected, {
      openclawVersion: 'v2026.7.2',
      runSafetyContract: expected.runSafetyContract,
    })).toMatchObject({
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.OpenClawVersionMismatch,
    });
  });

  test('fails closed when the run-safety contract differs', () => {
    expect(validateOpenClawRuntimeContract(expected, {
      openclawVersion: expected.openclawVersion,
      runSafetyContract: 'legacy-prompt-hard-stop-v1',
    })).toMatchObject({
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.RunSafetyContractMismatch,
    });
  });
});

describe('OpenClawEngineManager runtime contract gate', () => {
  test('stops a tracked gateway before returning a contract mismatch', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-runtime-gate-'));
    const appPath = path.join(tmpDir, 'app');
    const userData = path.join(tmpDir, 'user-data');
    const runtimeRoot = path.join(appPath, 'vendor', 'openclaw-runtime', 'current');
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.writeFileSync(path.join(appPath, 'package.json'), JSON.stringify({
      openclaw: {
        version: 'v2026.6.1',
        runSafetyContract: 'count-hardcaps-prompt-observe-v1',
        plugins: [],
      },
    }));
    fs.writeFileSync(path.join(runtimeRoot, 'package.json'), JSON.stringify({
      version: '2026.6.1',
    }));
    fs.writeFileSync(path.join(runtimeRoot, 'runtime-build-info.json'), JSON.stringify({
      openclawVersion: 'v2026.6.1',
      runSafetyContract: 'legacy-prompt-hard-stop-v1',
    }));

    const previousAppPath = engineTestPaths.appPath;
    const previousUserData = engineTestPaths.userData;
    let restartTimer: NodeJS.Timeout | null = null;
    engineTestPaths.appPath = appPath;
    engineTestPaths.userData = userData;
    try {
      const manager = new OpenClawEngineManager();
      type TestGatewayProcess = { pid: number; exitCode: number | null };
      type TestableManager = {
        gatewayProcess: TestGatewayProcess | null;
        gatewayRestartTimer: NodeJS.Timeout | null;
        stopGatewayProcess: (process: TestGatewayProcess) => Promise<void>;
      };
      const testableManager = manager as unknown as TestableManager;
      const gatewayProcess = { pid: 123, exitCode: null };
      testableManager.gatewayProcess = gatewayProcess;
      restartTimer = setTimeout(() => undefined, 60_000);
      testableManager.gatewayRestartTimer = restartTimer;
      const stopSpy = vi
        .spyOn(testableManager, 'stopGatewayProcess')
        .mockResolvedValue();

      const status = await manager.ensureReady();

      expect(stopSpy).toHaveBeenCalledWith(gatewayProcess);
      expect(testableManager.gatewayProcess).toBeNull();
      expect(testableManager.gatewayRestartTimer).toBeNull();
      expect(status).toMatchObject({
        phase: 'error',
        errorCode: OpenClawEngineErrorCode.RuntimeContractMismatch,
        canRetry: true,
      });
    } finally {
      if (restartTimer) clearTimeout(restartTimer);
      engineTestPaths.appPath = previousAppPath;
      engineTestPaths.userData = previousUserData;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('stops a tracked gateway when the runtime root is missing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-missing-runtime-gate-'));
    const appPath = path.join(tmpDir, 'app');
    const userData = path.join(tmpDir, 'user-data');
    fs.mkdirSync(appPath, { recursive: true });

    const previousAppPath = engineTestPaths.appPath;
    const previousUserData = engineTestPaths.userData;
    const realExistsSync = fs.existsSync.bind(fs);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((candidate) => {
      if (
        String(candidate).includes(
          path.join('vendor', 'openclaw-runtime', 'current'),
        )
      ) {
        return false;
      }
      return realExistsSync(candidate);
    });
    let restartTimer: NodeJS.Timeout | null = null;
    engineTestPaths.appPath = appPath;
    engineTestPaths.userData = userData;
    try {
      const manager = new OpenClawEngineManager();
      type TestGatewayProcess = { pid: number; exitCode: number | null };
      type TestableManager = {
        gatewayProcess: TestGatewayProcess | null;
        gatewayRestartTimer: NodeJS.Timeout | null;
        stopGatewayProcess: (process: TestGatewayProcess) => Promise<void>;
      };
      const testableManager = manager as unknown as TestableManager;
      const gatewayProcess = { pid: 456, exitCode: null };
      testableManager.gatewayProcess = gatewayProcess;
      restartTimer = setTimeout(() => undefined, 60_000);
      testableManager.gatewayRestartTimer = restartTimer;
      const stopSpy = vi
        .spyOn(testableManager, 'stopGatewayProcess')
        .mockResolvedValue();

      const status = await manager.validateRuntimeContractGate();

      expect(stopSpy).toHaveBeenCalledWith(gatewayProcess);
      expect(testableManager.gatewayProcess).toBeNull();
      expect(testableManager.gatewayRestartTimer).toBeNull();
      expect(status).toMatchObject({
        phase: 'not_installed',
        canRetry: true,
      });
    } finally {
      if (restartTimer) clearTimeout(restartTimer);
      existsSpy.mockRestore();
      engineTestPaths.appPath = previousAppPath;
      engineTestPaths.userData = previousUserData;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('does not repeat startup maintenance after the runtime is ready', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-running-gate-'));
    const appPath = path.join(tmpDir, 'app');
    const userData = path.join(tmpDir, 'user-data');
    const runtimeRoot = path.join(appPath, 'vendor', 'openclaw-runtime', 'current');
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.writeFileSync(path.join(appPath, 'package.json'), JSON.stringify({
      openclaw: {
        version: 'v2026.6.1',
        runSafetyContract: 'count-hardcaps-prompt-observe-v1',
        plugins: [],
      },
    }));
    fs.writeFileSync(path.join(runtimeRoot, 'package.json'), JSON.stringify({
      version: '2026.6.1',
    }));
    fs.writeFileSync(path.join(runtimeRoot, 'runtime-build-info.json'), JSON.stringify({
      openclawVersion: 'v2026.6.1',
      runSafetyContract: 'count-hardcaps-prompt-observe-v1',
    }));

    const previousAppPath = engineTestPaths.appPath;
    const previousUserData = engineTestPaths.userData;
    engineTestPaths.appPath = appPath;
    engineTestPaths.userData = userData;
    engineMaintenanceMocks.cleanupStaleThirdPartyPluginsFromBundledDir.mockClear();
    engineMaintenanceMocks.listLocalOpenClawExtensionIds.mockClear();
    engineMaintenanceMocks.syncLocalOpenClawExtensionsIntoRuntime.mockClear();
    try {
      const manager = new OpenClawEngineManager();
      type TestableManager = {
        status: {
          phase: 'ready' | 'running';
          version: string;
          message: string;
          canRetry: false;
        };
      };
      const testableManager = manager as unknown as TestableManager;
      for (const phase of ['ready', 'running'] as const) {
        testableManager.status = {
          phase,
          version: '2026.6.1',
          message: phase,
          canRetry: false,
        };
        expect(await manager.validateRuntimeContractGate()).toBeNull();
        expect(await manager.ensureReady()).toMatchObject({ phase });
      }
      expect(
        engineMaintenanceMocks.syncLocalOpenClawExtensionsIntoRuntime,
      ).not.toHaveBeenCalled();
      expect(
        engineMaintenanceMocks.listLocalOpenClawExtensionIds,
      ).not.toHaveBeenCalled();
      expect(
        engineMaintenanceMocks.cleanupStaleThirdPartyPluginsFromBundledDir,
      ).not.toHaveBeenCalled();
    } finally {
      engineTestPaths.appPath = previousAppPath;
      engineTestPaths.userData = previousUserData;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('validateOpenClawManagedConfig', () => {
  test('rejects a legacy prompt-exposure hard limit and accepts observe-only policy', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-managed-config-'));
    const configPath = path.join(tmpDir, 'openclaw.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify({
        agents: {
          defaults: {
            runSafety: {
              maxToolCallReservationsPerBudgetScope: 64,
              maxProviderDispatchesPerBudgetScope: 32,
              maxCumulativeEstimatedPromptTokensPerBudgetScope: 2_000_000,
              warningRatio: 0.75,
            },
          },
        },
      }));
      expect(validateOpenClawManagedConfig(configPath)).toMatchObject({
        ok: false,
        reason: OpenClawManagedConfigFailureReason.RunSafetyPolicyMismatch,
      });

      fs.writeFileSync(configPath, JSON.stringify({
        agents: {
          defaults: {
            runSafety: {
              maxToolCallReservationsPerBudgetScope: 64,
              maxProviderDispatchesPerBudgetScope: 32,
              warningRatio: 0.75,
              promptExposure: {
                mode: 'observe',
                legacyDiagnosticThreshold: 2_000_000,
              },
            },
          },
        },
      }));
      expect(validateOpenClawManagedConfig(configPath)).toEqual({ ok: true });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('isOpenClawConfigStartupFailure', () => {
  test('matches OpenClaw config validation failures', () => {
    expect(isOpenClawConfigStartupFailure([
      '[stderr] Error: Invalid config at /Users/test/Library/Application Support/LobsterAI/openclaw/state/openclaw.json.',
      '[stderr] - models.providers.openai.api: invalid config: unsupported value',
    ].join('\n'))).toBe(true);
  });

  test('matches JSON5 parse failures for openclaw.json', () => {
    expect(isOpenClawConfigStartupFailure(
      '[stderr] JSON5 parse failed: invalid character at 4:3 in openclaw.json'
    )).toBe(true);
  });

  test('matches schema validation messages', () => {
    expect(isOpenClawConfigStartupFailure(
      '[stderr] Config validation failed: plugins.allow: unknown plugin id'
    )).toBe(true);
  });

  test('does not match unrelated runtime configuration errors', () => {
    expect(isOpenClawConfigStartupFailure(
      '[stderr] Invalid configuration: region from ARN does not match client region'
    )).toBe(false);
  });
});

describe('isOpenClawGatewayHeapOutOfMemory', () => {
  test('matches the V8 fatal heap OOM emitted by the gateway', () => {
    expect(isOpenClawGatewayHeapOutOfMemory(
      'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory',
    )).toBe(true);
  });

  test('matches the alternate mark-compacts heap limit signature', () => {
    expect(isOpenClawGatewayHeapOutOfMemory(
      'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed',
    )).toBe(true);
  });

  test('does not classify ordinary gateway disconnects as heap OOM', () => {
    expect(isOpenClawGatewayHeapOutOfMemory(
      'gateway websocket closed with code=1006',
    )).toBe(false);
  });
});
