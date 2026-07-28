import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

import { RunSafetyTerminationKind } from '../../../shared/cowork/runSafety';
import {
  expectPatchContains,
  readAddedPatchLines,
  readCurrentOpenClawPatch,
  readCurrentOpenClawPatchFileDiff,
  readRemovedPatchLines,
} from './patchTestUtils';

const patchFile = 'openclaw-varying-args-no-progress-core.patch';

describe('OpenClaw varying-arguments no-progress core patch', () => {
  test('keeps all OpenClaw and LobsterAI termination wire kinds exactly aligned', () => {
    const controllerAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-controller.ts'),
    );
    const kindObject = controllerAdded.match(
      /export const RunSafetyTerminationKind = \{(?<body>[\s\S]*?)\} as const;/,
    );
    expect(kindObject?.groups?.body).toBeTruthy();

    const openClawWireKinds = Array.from(
      kindObject?.groups?.body.matchAll(/^\s+\w+: "([^"]+)",$/gm) ?? [],
      (match) => match[1],
    );

    expect(openClawWireKinds).toEqual(Object.values(RunSafetyTerminationKind));
  });

  test('enforces local run budgets for every provider, including custom models', () => {
    const controllerAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-controller.ts'),
    );
    const providerGateAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/embedded-agent-runner/run/run-safety-gate.ts',
      ),
    );
    const attemptAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/embedded-agent-runner/run/attempt.ts',
      ),
    );
    const pluginRuntimeAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/plugins/provider-runtime.ts'),
    );

    for (const snippet of [
      'maxToolCallReservationsPerBudgetScope: 64',
      'maxProviderDispatchesPerBudgetScope: 32',
      'maxCumulativeEstimatedPromptTokensPerBudgetScope: 2_000_000',
      'warningRatio: 0.75',
      'reserveToolBatch(params: {',
      'reserveProviderDispatch(params: {',
    ]) {
      expect(controllerAdded).toContain(snippet);
    }
    for (const snippet of [
      'params.controller.reserveProviderDispatch({',
      'const finalEstimate = estimateRunSafetyPromptTokens(finalPayload, payloadModel);',
      'params.controller.refineProviderPromptEstimate({',
      'maxRetries: 0',
    ]) {
      expect(providerGateAdded).toContain(snippet);
    }
    expect(attemptAdded).toContain(
      'activeSession.agent.streamFn = wrapStreamFnWithRunSafety({',
    );
    for (const snippet of [
      'export function resolveProviderAgentStreamFnV1',
      'exposes an unversioned createStreamFn and cannot be used for Agent execution',
      'returned an unmarked createAgentStreamFnV1 result',
    ]) {
      expect(pluginRuntimeAdded).toContain(snippet);
    }

    expectPatchContains(patchFile, [
      'ProviderRunSafetyContractVersion',
      'Provider run-safety V1 stream requires the host-owned final-payload gate.',
      'Provider run-safety V1 preparation must return one finalPayload/transport descriptor.',
      'const prepared = await prepare({',
      'return await prepared.transport({',
      'awaits the host final-payload gate before the plugin transport can start',
      'invokes the one prepared transport exactly once',
      'rejects an unversioned Agent stream before it can be registered or invoked',
      'keeps utility streamSimple isolated when an Agent V1 stream is registered',
      'awaits the final payload gate and sends its replacement before fetch',
    ]);
  });

  test('closes audited provider retry, preload, cache, and provenance gaps', () => {
    const attemptDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'src/agents/embedded-agent-runner/run/attempt.ts',
    );
    const safetyWrapperIndex = attemptDiff.indexOf(
      '+        activeSession.agent.streamFn = wrapStreamFnWithRunSafety({',
    );
    const thinkingRecoveryPolicyIndex = attemptDiff.indexOf(
      'transcriptPolicy.preserveSignatures',
      safetyWrapperIndex,
    );

    expect(safetyWrapperIndex).toBeGreaterThanOrEqual(0);
    expect(thinkingRecoveryPolicyIndex).toBeGreaterThan(safetyWrapperIndex);
    expectPatchContains(patchFile, [
      'maxAttempts: 1',
      'internal transport retry is disabled for this run',
      'skips best-effort preload inside a host run-safety provider dispatch',
      'allowManagedSideEffects: !params.runSafety',
      'disables managed cache network side effects for run-safety Agent scopes',
      'runs the host prompt gate before profile discovery or Converse transport',
      'reserves the Anthropic without-thinking recovery as a second provider dispatch',
      'cloneProviderPluginWithHostProvenance',
      'resolveProviderPluginHostOrigin(plugin) === "bundled"',
      'rejects plugin-reported bundled identity without host provenance',
      'adaptBundledAuditedProviderPayloadHookStreamFnV1',
    ]);
    expect(readCurrentOpenClawPatch(patchFile)).not.toContain(
      'adaptAuditedProviderPayloadHookStreamFnV1',
    );
  });

  test('reserves raw tool calls before lookup, validation, hooks, or execution', () => {
    const agentLoopDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'packages/agent-core/src/agent-loop.ts',
    );
    const providerGateDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'src/agents/embedded-agent-runner/run/run-safety-gate.ts',
    );
    const hookInvocationIndex = agentLoopDiff.indexOf(
      '+  const decisions = (await config.beforeToolCallBatch?.(batchContext, signal)) ?? [];',
    );
    const lookupIndex = agentLoopDiff.indexOf(
      'const tool = currentContext.tools?.find((t) => t.name === toolCall.name);',
    );
    const reservationIndex = providerGateDiff.indexOf(
      '+    const safetyDecisions = params.controller.reserveToolBatch({',
    );
    const priorHookIndex = providerGateDiff.indexOf(
      '+      if (priorBeforeToolCallBatch && priorContext.toolCalls.length > 0) {',
    );

    expect(hookInvocationIndex).toBeGreaterThanOrEqual(0);
    expect(lookupIndex).toBeGreaterThan(hookInvocationIndex);
    expect(reservationIndex).toBeGreaterThanOrEqual(0);
    expect(priorHookIndex).toBeGreaterThan(reservationIndex);
    expectPatchContains(patchFile, [
      'runs before lookup, schema validation, per-tool hooks, and side effects',
      'blocks raw overflow calls and stops after the allowed sibling settles',
    ]);
  });

  test('locks the reviewed #112620, #110633, and #97485 overlap boundaries', () => {
    const patch = readCurrentOpenClawPatch(patchFile);
    const controllerAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-controller.ts'),
    );
    const providerGateAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/embedded-agent-runner/run/run-safety-gate.ts',
      ),
    );
    const providerContractTestsAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/provider-run-safety-contract.test.ts',
      ),
    );
    const agentLoopDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'packages/agent-core/src/agent-loop.ts',
    );
    const resultFallbackAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/embedded-agent-runner/result-fallback-classifier.ts',
      ),
    );
    const coordinatorTestsAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/run-safety-controller.test.ts',
      ),
    );
    const agentCoreBudgetTestsAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'packages/agent-core/src/agent.run-safety-tool-budget.test.ts',
      ),
    );

    // #112620 remains only a low-cardinality upstream detector candidate. The
    // local high-cardinality allowlist reserves every raw call before lookup.
    const rawReservationIndex = agentLoopDiff.indexOf(
      '+  const decisions = (await config.beforeToolCallBatch?.(batchContext, signal)) ?? [];',
    );
    const toolLookupIndex = agentLoopDiff.indexOf(
      'const tool = currentContext.tools?.find((t) => t.name === toolCall.name);',
    );
    expect(rawReservationIndex).toBeGreaterThanOrEqual(0);
    expect(toolLookupIndex).toBeGreaterThan(rawReservationIndex);
    expect(patch).toContain('normalizeReadOnlyPowerShellWindowCommand');

    // #97485 is an after-response tool-round limit with an additional summary
    // attempt. P0 must not enable it or mistake it for a provider request cap.
    expect(patch).not.toContain('maxToolCallingRounds');
    expect(providerGateAdded).toContain('params.controller.reserveProviderDispatch({');
    expect(providerGateAdded).toContain('maxRetries: 0');
    expect(providerContractTestsAdded).toContain(
      'invokes the one prepared transport exactly once',
    );
    expect(agentCoreBudgetTestsAdded).toContain(
      'expect(providerCall).toHaveBeenCalledTimes(1);',
    );
    expect(agentCoreBudgetTestsAdded).toContain(
      'expect(prepareNextTurn).not.toHaveBeenCalled();',
    );

    // #110633 may eventually own core termination, but this patch currently
    // enforces one write-once terminal and suppresses fallback/provider recovery.
    expect(controllerAdded).toContain('if (this.scopeTerminalReasonValue) {');
    expect(coordinatorTestsAdded).toContain('publishes only the first product terminal outcome');
    expect(resultFallbackAdded).toContain('if (params.result.meta.terminationReason) {');
    expect(resultFallbackAdded).toContain('return null;');
  });

  test('detects only the allowlisted read-only PowerShell window family', () => {
    expectPatchContains(patchFile, [
      'normalizeReadOnlyPowerShellWindowCommand',
      'Select-Object\\s+-First\\s+([0-9]+)',
      'variant.distinctArgsHashCount >= config.variantCriticalThreshold',
      'detector: "variant_no_progress"',
      'terminates on the third distinct argument',
    ]);
  });

  test('estimates prompt exposure in CJK-aware tokens instead of raw bytes', () => {
    const controllerAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-controller.ts'),
    );

    // The 2M budget is calibrated in tokens (FR-12.1). Counting serialized
    // UTF-8 bytes shrank it 3-4x (worst for CJK) and hard-blocked any single
    // payload above 2MB on its first dispatch.
    expect(controllerAdded).toContain(
      'import { estimateStringChars, estimateTokensFromChars } from "../utils/cjk-chars.js";',
    );
    expect(controllerAdded).toContain('INLINE_MEDIA_TOKEN_ESTIMATE');
    expect(controllerAdded).toContain('source: "stable_text_tokens"');
    expect(controllerAdded).not.toContain('Buffer.byteLength(serialized');
    expectPatchContains(patchFile, [
      'estimates tokens, not bytes, so the configured budget keeps its calibration',
      'weights CJK content fairly instead of tripling it through UTF-8 bytes',
      'caps inline base64 media at a fixed conservative estimate',
    ]);
  });

  test('threads the normalized run id into the self-registered compaction scope', () => {
    const compactQueuedAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/embedded-agent-runner/compact.queued.ts',
      ),
    );

    // Without the run id the downstream harness compaction host receives a
    // scope but no run identity and fails closed on every production trigger.
    expect(compactQueuedAdded).toContain('const runId = params.runId ?? params.sessionId;');
    expect(compactQueuedAdded).toContain('runId,\n        runSafety: registration.context,');
  });

  test('registers one root before preflight and shares it with child work and compaction', () => {
    const agentRunnerDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'src/auto-reply/reply/agent-runner.ts',
    );
    const agentRunnerAdded = readAddedPatchLines(agentRunnerDiff);
    const registrationIndex = agentRunnerDiff.indexOf(
      '+  const runSafetyRegistration = runSafetyRegistry.registerRoot({',
    );
    const preflightIndex = agentRunnerDiff.indexOf(
      'activeSessionEntry = await traceAgentPhase("reply.preflight_compaction"',
    );
    const rootRegistrationCount =
      agentRunnerAdded.match(/runSafetyRegistry\.registerRoot\(\{/g)?.length ?? 0;
    const sharedContextCount =
      agentRunnerAdded.match(/runSafety: runSafetyRegistration\.context,/g)?.length ?? 0;

    expect(rootRegistrationCount).toBe(1);
    expect(registrationIndex).toBeGreaterThanOrEqual(0);
    expect(preflightIndex).toBeGreaterThan(registrationIndex);
    expect(sharedContextCount).toBe(3);
    expectPatchContains(patchFile, [
      'consumes an inherited claim exactly once',
      'does not let a late child event revive a tombstoned scope',
      'shares the run-safety provider budget with compaction stream calls',
    ]);
  });

  test('gates CLI inference before process spawn without claiming visibility into CLI tools', () => {
    const cliExecuteDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'src/agents/cli-runner/execute.ts',
    );
    const cliSafetyAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/cli-runner/run-safety.ts',
      ),
    );

    expect(readAddedPatchLines(cliExecuteDiff)).toContain(
      'runSafetyReservation = reserveCliProviderDispatch({',
    );
    expect(cliSafetyAdded).toContain('Native CLI');
    expect(cliSafetyAdded).toContain('tool calls remain opaque to the host');
    expect(readCurrentOpenClawPatch(patchFile)).toContain(
      'returns a typed terminal without spawning when the dispatch budget rejects',
    );
  });

  test('fails restart recovery closed instead of restarting provider work', () => {
    const restartRecoveryDiff = readCurrentOpenClawPatchFileDiff(
      patchFile,
      'src/agents/main-session-restart-recovery.ts',
    );
    const added = readAddedPatchLines(restartRecoveryDiff);
    const removed = readRemovedPatchLines(restartRecoveryDiff);

    expect(added).toContain('Never create a fresh scope for an old turn');
    expect(added).toContain(
      'resumeBlockReason ?? "run-safety state unavailable after process restart"',
    );
    expect(removed).toContain('async function resumeMainSession');
    expect(removed).toContain('method: "agent"');
    expect(readCurrentOpenClawPatch(patchFile)).toContain(
      'fails closed after restart without dispatching an agent provider run',
    );
  });

  test('remains independently applicable before deterministic delivery', () => {
    expect(readCurrentOpenClawPatch(patchFile)).not.toContain('run-safety-delivery');
  });

  test('keeps patch application fail-closed for reset and ambiguous states', () => {
    const script = fs.readFileSync(
      path.resolve('scripts', 'apply-openclaw-patches.cjs'),
      'utf8',
    );

    expect(script).toContain('const requiredRunSafetyPatchFiles = [');
    expect(script).toContain("'openclaw-varying-args-no-progress-core.patch'");
    expect(script).toContain(
      "'openclaw-varying-args-no-progress-correction-btw-utility.patch'",
    );
    expect(script).toContain("'openclaw-varying-args-no-progress-delivery.patch'");
    expect(script).toContain(
      "'openclaw-varying-args-no-progress-native-receipt.patch'",
    );
    expect(script).toContain("'openclaw-z-agent-harness-run-safety.patch'");
    expect(script).toContain('Missing required run-safety patch file(s):');
    expect(script).toContain('Failed to reset openclaw source:');
    expect(script).toContain('Refusing to apply patches to an unknown working-tree state.');
    expect(script).toContain('Patch state is ambiguous or partial:');
    expect(script).toContain('Both reverse and forward checks failed.');
    expect(script).toContain(
      'Refusing to infer a complete application from source sentinels.',
    );
    expect(script).not.toContain('alreadyExists');
    expect(script).not.toContain('patchDoesNotApply');
    expect(script).not.toContain('isStrongPatchApplied');

    const resetFailureIndex = script.indexOf('Failed to reset openclaw source:');
    const patchLoopIndex = script.indexOf('let applied = 0;');
    const resetExitIndex = script.indexOf('process.exit(1);', resetFailureIndex);
    expect(resetExitIndex).toBeGreaterThan(resetFailureIndex);
    expect(resetExitIndex).toBeLessThan(patchLoopIndex);

    const ambiguousIndex = script.indexOf('Patch state is ambiguous or partial:');
    const applyIndex = script.indexOf('// Apply the patch.', ambiguousIndex);
    const ambiguousSection = script.slice(ambiguousIndex, applyIndex);
    expect(ambiguousSection).toContain('process.exit(1);');
    expect(ambiguousSection).not.toContain('assertStrongPatchApplied');
  });
});
