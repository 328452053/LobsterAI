import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assertOpenClawRuntimeBuildInfoMatchesExpected,
  computeOpenClawPatchHash,
} = require('../scripts/electron-builder-hooks.cjs') as {
  assertOpenClawRuntimeBuildInfoMatchesExpected: (
    buildInfo: Record<string, unknown> | null,
    expected: {
      openclawVersion: string;
      runSafetyContract: string;
      patchHash: string;
    },
    buildHint: string,
  ) => void;
  computeOpenClawPatchHash: (patchesDir: string) => string;
};

describe('electron-builder OpenClaw runtime contract gate', () => {
  const expected = {
    openclawVersion: 'v2026.6.1',
    runSafetyContract: 'count-hardcaps-prompt-observe-v1',
    patchHash: 'expected-patch-hash',
  };

  test('hashes patch bytes in stable filename order', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-patch-hash-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'z-last.patch'), 'last\n');
      fs.writeFileSync(path.join(tmpDir, 'a-first.patch'), 'first\n');
      fs.writeFileSync(path.join(tmpDir, 'ignored.txt'), 'ignored\n');

      const expectedHash = createHash('sha256')
        .update('first\n')
        .update('last\n')
        .digest('hex');
      expect(computeOpenClawPatchHash(tmpDir)).toBe(expectedHash);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('accepts matching build metadata', () => {
    expect(() => assertOpenClawRuntimeBuildInfoMatchesExpected(
      {
        ...expected,
      },
      expected,
      'npm run openclaw:runtime:mac-arm64',
    )).not.toThrow();
  });

  test('rejects a stale OpenClaw version before packaging', () => {
    expect(() => assertOpenClawRuntimeBuildInfoMatchesExpected(
      {
        openclawVersion: 'v2026.5.12',
        runSafetyContract: expected.runSafetyContract,
        patchHash: expected.patchHash,
      },
      expected,
      'npm run openclaw:runtime:mac-arm64',
    )).toThrow(/Expected version=v2026\.6\.1.*found version=v2026\.5\.12/);
  });

  test('rejects missing or mismatched run-safety contracts before packaging', () => {
    expect(() => assertOpenClawRuntimeBuildInfoMatchesExpected(
      {
        openclawVersion: expected.openclawVersion,
        patchHash: expected.patchHash,
      },
      expected,
      'npm run openclaw:runtime:mac-arm64',
    )).toThrow(/runSafetyContract=missing/);

    expect(() => assertOpenClawRuntimeBuildInfoMatchesExpected(
      {
        openclawVersion: expected.openclawVersion,
        runSafetyContract: 'legacy-prompt-hard-stop-v1',
        patchHash: expected.patchHash,
      },
      expected,
      'npm run openclaw:runtime:mac-arm64',
    )).toThrow(/runSafetyContract=legacy-prompt-hard-stop-v1/);
  });

  test('rejects missing or stale patch hashes before packaging', () => {
    expect(() => assertOpenClawRuntimeBuildInfoMatchesExpected(
      {
        openclawVersion: expected.openclawVersion,
        runSafetyContract: expected.runSafetyContract,
      },
      expected,
      'npm run openclaw:runtime:mac-arm64',
    )).toThrow(/patchHash=missing/);

    expect(() => assertOpenClawRuntimeBuildInfoMatchesExpected(
      {
        openclawVersion: expected.openclawVersion,
        runSafetyContract: expected.runSafetyContract,
        patchHash: 'stale-patch-hash',
      },
      expected,
      'npm run openclaw:runtime:mac-arm64',
    )).toThrow(/patchHash=stale-patch-hash/);
  });
});
