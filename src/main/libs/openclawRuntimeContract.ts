import fs from 'fs';
import path from 'path';

import { hasManagedOpenClawRunSafety } from './openclawRunSafetyPolicy';

export const OpenClawRuntimeContractFailureReason = {
  HostManifestMissing: 'host_manifest_missing',
  RuntimeBuildInfoMissing: 'runtime_build_info_missing',
  OpenClawVersionMismatch: 'openclaw_version_mismatch',
  RunSafetyContractMismatch: 'run_safety_contract_mismatch',
} as const;

export type OpenClawRuntimeContractFailureReason =
  typeof OpenClawRuntimeContractFailureReason[
    keyof typeof OpenClawRuntimeContractFailureReason
  ];

export const OpenClawManagedConfigFailureReason = {
  ConfigMissingOrInvalid: 'config_missing_or_invalid',
  RunSafetyPolicyMismatch: 'run_safety_policy_mismatch',
} as const;

export type OpenClawManagedConfigFailureReason =
  typeof OpenClawManagedConfigFailureReason[
    keyof typeof OpenClawManagedConfigFailureReason
  ];

export type OpenClawRuntimeContractExpectation = {
  openclawVersion: string;
  runSafetyContract: string;
};

export type OpenClawRuntimeBuildInfo = {
  openclawVersion?: unknown;
  runSafetyContract?: unknown;
  patchHash?: unknown;
};

export type OpenClawRuntimeContractValidation =
  | {
      ok: true;
      expected: OpenClawRuntimeContractExpectation;
      actual: OpenClawRuntimeContractExpectation;
    }
  | {
      ok: false;
      reason: OpenClawRuntimeContractFailureReason;
      expected: OpenClawRuntimeContractExpectation | null;
      actual: OpenClawRuntimeContractExpectation | null;
    };

export type OpenClawManagedConfigValidation =
  | { ok: true }
  | { ok: false; reason: OpenClawManagedConfigFailureReason };

const parseJsonFile = (filePath: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return null;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const readContractPair = (
  value: unknown,
  versionKey: string,
): OpenClawRuntimeContractExpectation | null => {
  const record = asRecord(value);
  const openclawVersion = record?.[versionKey];
  const runSafetyContract = record?.runSafetyContract;
  if (
    typeof openclawVersion !== 'string'
    || openclawVersion.length === 0
    || typeof runSafetyContract !== 'string'
    || runSafetyContract.length === 0
  ) {
    return null;
  }
  return { openclawVersion, runSafetyContract };
};

export const readOpenClawRuntimeContractExpectation = (
  appRoot: string,
): OpenClawRuntimeContractExpectation | null => {
  const packageJson = asRecord(parseJsonFile(path.join(appRoot, 'package.json')));
  return readContractPair(packageJson?.openclaw, 'version');
};

export const readOpenClawRuntimeBuildInfo = (
  runtimeRoot: string,
): OpenClawRuntimeBuildInfo | null => {
  const value = parseJsonFile(path.join(runtimeRoot, 'runtime-build-info.json'));
  return asRecord(value) as OpenClawRuntimeBuildInfo | null;
};

export const validateOpenClawRuntimeContract = (
  expected: OpenClawRuntimeContractExpectation | null,
  buildInfo: OpenClawRuntimeBuildInfo | null,
): OpenClawRuntimeContractValidation => {
  if (!expected) {
    return {
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.HostManifestMissing,
      expected: null,
      actual: readContractPair(buildInfo, 'openclawVersion'),
    };
  }

  const actual = readContractPair(buildInfo, 'openclawVersion');
  if (!actual) {
    return {
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.RuntimeBuildInfoMissing,
      expected,
      actual: null,
    };
  }
  if (actual.openclawVersion !== expected.openclawVersion) {
    return {
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.OpenClawVersionMismatch,
      expected,
      actual,
    };
  }
  if (actual.runSafetyContract !== expected.runSafetyContract) {
    return {
      ok: false,
      reason: OpenClawRuntimeContractFailureReason.RunSafetyContractMismatch,
      expected,
      actual,
    };
  }

  return { ok: true, expected, actual };
};

export const validateOpenClawManagedConfig = (
  configPath: string,
): OpenClawManagedConfigValidation => {
  const config = parseJsonFile(configPath);
  if (!asRecord(config)) {
    return {
      ok: false,
      reason: OpenClawManagedConfigFailureReason.ConfigMissingOrInvalid,
    };
  }
  if (!hasManagedOpenClawRunSafety(config)) {
    return {
      ok: false,
      reason: OpenClawManagedConfigFailureReason.RunSafetyPolicyMismatch,
    };
  }
  return { ok: true };
};
