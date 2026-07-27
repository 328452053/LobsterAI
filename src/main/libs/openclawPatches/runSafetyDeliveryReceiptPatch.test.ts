import { describe, expect, test } from 'vitest';

import {
  expectPatchContains,
  readAddedPatchLines,
  readCurrentOpenClawPatchFileDiff,
} from './patchTestUtils';

const patchFile = 'openclaw-varying-args-no-progress-native-receipt.patch';

describe('OpenClaw run-safety native delivery receipt patch', () => {
  test('does not treat queue admission as a successful owner delivery', () => {
    const agentRunnerAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/auto-reply/reply/agent-runner.ts',
      ),
    );

    expect(agentRunnerAdded).toContain('waitForRunSafetyDeliveryReceipt');
    expect(agentRunnerAdded).toContain(
      'await buildRunSafetyNativeReplyPayloadsForOwner({',
    );
    expect(agentRunnerAdded).toContain(
      'Run-safety terminal reply was queued but not delivered.',
    );
  });

  test('releases a failed coordinator task for a retained-owner retry', () => {
    const controllerAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-controller.ts'),
    );

    expect(controllerAdded).toContain('const publishTask = (async () => {');
    expect(controllerAdded).toContain('this.ownerPublishTask = undefined;');
    expectPatchContains(patchFile, [
      'releases a failed owner publication task so the retained owner can retry',
      'retries a queued owner reply until an actual delivery receipt succeeds',
      'expect(deliveredPayloads).toHaveLength(3);',
      'expect(hasRunSafetyDeliveryReceipt(reason)).toBe(true);',
    ]);
  });

  test('locks the orphaned-claim lease expiry regression coverage', () => {
    expectPatchContains(patchFile, [
      'expires an orphaned claim so the retained owner can re-claim and deliver',
      'waits out a live claim instead of expiring it early',
    ]);
  });
});
