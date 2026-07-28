import { describe, expect, test } from 'vitest';

import {
  expectPatchContains,
  readAddedPatchLines,
  readCurrentOpenClawPatch,
  readCurrentOpenClawPatchFileDiff,
  readRemovedPatchLines,
} from './patchTestUtils';

const patchFile = 'openclaw-z-agent-harness-run-safety.patch';

describe('OpenClaw AgentHarness run-safety patch', () => {
  test('contains one complete diff block for the harness contract and its tests', () => {
    const patch = readCurrentOpenClawPatch(patchFile);
    for (const file of [
      'src/agents/harness/run-safety-contract.ts',
      'src/agents/harness/run-safety-contract.test.ts',
    ]) {
      const header = `diff --git a/${file} b/${file}`;
      expect(patch.split(header)).toHaveLength(2);
    }
  });

  test('fails closed before invoking an unversioned harness handler', () => {
    const contractAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/harness/run-safety-contract.ts',
      ),
    );
    const lifecycleAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/harness/lifecycle.ts'),
    );
    const lifecycleRemoved = readRemovedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/harness/lifecycle.ts'),
    );

    expect(contractAdded).toContain('AgentHarnessRunSafetyContractVersion');
    expect(contractAdded).toContain('const runAttemptHandlersV1 = new WeakSet');
    expect(contractAdded).toContain('runAttemptHandlersV1.has(params.handler)');
    expect(contractAdded).toContain('Unversioned AgentHarness runAttempt is not permitted.');
    expect(lifecycleAdded).toContain('await runAgentHarnessAttemptV1({');
    expect(lifecycleRemoved).toContain('await harness.runAttempt(params)');
  });

  test('reserves and observes the final payload before the real transport', () => {
    const contractAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/harness/run-safety-contract.ts',
      ),
    );

    const reservationIndex = contractAdded.indexOf(
      'runSafety.controller.reserveProviderDispatch({',
    );
    const estimateIndex = contractAdded.indexOf(
      'estimateRunSafetyPromptObservation(finalPayload, model)',
    );
    const observationIndex = contractAdded.indexOf(
      'runSafety.controller.observeProviderPromptEstimate({',
    );
    const transportIndex = contractAdded.indexOf('return await transport(finalPayload);');

    expect(reservationIndex).toBeGreaterThanOrEqual(0);
    expect(observationIndex).toBeGreaterThan(reservationIndex);
    expect(estimateIndex).toBeGreaterThan(observationIndex);
    expect(transportIndex).toBeGreaterThan(estimateIndex);
    expect(contractAdded).toContain(
      'runSafety.controller.completeProviderDispatch(providerDispatchId);',
    );
  });

  test('keeps prompt observations fail-open and legacy prompt terminals receive-only', () => {
    const contractAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/harness/run-safety-contract.ts',
      ),
    );
    const contractTestsAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/harness/run-safety-contract.test.ts',
      ),
    );

    expect(contractAdded).toContain(
      'runSafety.controller.observeProviderPromptEstimate({',
    );
    expect(contractAdded).not.toContain('refineProviderPromptEstimate(');
    expect(contractAdded).not.toContain(
      'kind: RunSafetyTerminationKind.RunPromptExposureBudget',
    );
    expect(contractAdded).not.toContain(
      'kind: RunSafetyTerminationKind.RunPromptEstimateUnavailable',
    );
    expect(contractTestsAdded).toContain(
      'calls transport when final prompt estimation is unavailable',
    );
    expect(contractTestsAdded).toContain(
      'calls transport when final prompt exposure exceeds the legacy threshold',
    );
  });

  test('gates Codex and Copilot sends at their final request boundaries', () => {
    expectPatchContains(patchFile, [
      'runAttemptV1: createAgentHarnessRunAttemptV1',
      'runSafetyDispatch: host.dispatch',
      'finalPayload: turnStartParams',
      'client.request("turn/start", finalPayload as typeof turnStartParams',
      'const finalPayload = {',
      'sessionConfig,',
      'messageOptions,',
      'return await session!.sendAndWait(finalMessageOptions, input.timeoutMs);',
      'model: params.model',
    ]);
  });

  test('requires the same V1 dispatch seam for harness compaction', () => {
    const compactionAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/harness/compaction.ts'),
    );

    expect(compactionAdded).toContain('await runAgentHarnessCompactV1({');
    expect(compactionAdded).toContain('legacyHandlerPresent: typeof harness.compact === "function"');
    expectPatchContains(patchFile, [
      'Unversioned AgentHarness compact is not permitted.',
      'compactV1: createAgentHarnessCompactV1',
      'client.request("thread/compact/start", finalPayload as typeof compactPayload)',
      'sdkSessionId: compatibleTracked.sdkSessionId',
      'compactResult = await host.dispatch({',
    ]);
  });

  test('bootstraps production compaction requests that carry no run id or scope', () => {
    const compactionAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/harness/compaction.ts'),
    );

    // Manual compact RPC, /compact, memory flush, and native CLI harness
    // compaction pass neither runId nor runSafety; the entry must normalize
    // the run id from the session and register its own scope instead of
    // throwing the V1 contract error on every production trigger.
    expect(compactionAdded).toContain('const runId = params.runId?.trim() || params.sessionId;');
    expect(compactionAdded).toContain('runSafetyRegistry.registerRoot({');
    expect(compactionAdded).toContain('runSafetyRegistry.releaseRun({');
    expectPatchContains(patchFile, [
      'compacts a production-shaped request without a run id or run-safety scope',
      'normalizes a missing run id when the caller already provides a run-safety scope',
    ]);
  });

  test('locks dispatch counts, zero-send vetoes, and the trusted-plugin boundary', () => {
    const patch = readCurrentOpenClawPatch(patchFile);

    expectPatchContains(patchFile, [
      'counts one normal send as one provider dispatch',
      'creates a new ticket for each recovery send on the shared controller',
      'does not call transport when the dispatch limit is exhausted',
      'calls transport when final prompt estimation is unavailable',
      'calls transport when final prompt exposure exceeds the legacy threshold',
      'expect(transport).not.toHaveBeenCalled();',
      'it is not an in-process plugin sandbox',
      'A malicious plugin could perform',
      'network I/O outside `dispatch`',
    ]);
    expect(patch).not.toContain('src/agents/cli-runner');
    expect(patch).not.toContain('child-process internal tools');
  });
});
