'use strict';

/**
 * Apply version-specific LobsterAI patches to the openclaw source tree.
 *
 * Patches are organised in scripts/patches/<version>/ directories, where
 * <version> matches the "openclaw.version" field in package.json (e.g.
 * "v2026.3.2").  Only patches for the currently pinned version are applied.
 *
 * Usage:
 *   node scripts/apply-openclaw-patches.cjs [openclaw-src-dir]
 *
 * If openclaw-src-dir is not specified, uses OPENCLAW_SRC when set, then
 * defaults to ../openclaw relative to the LobsterAI project root.
 *
 * Safe to run multiple times — already-applied patches are skipped.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const openclawSrc = process.argv[2]
  ? path.resolve(process.argv[2])
  : process.env.OPENCLAW_SRC
    ? path.resolve(process.env.OPENCLAW_SRC)
    : path.resolve(rootDir, '..', 'openclaw');

// Read pinned openclaw version from package.json.
const pkg = require(path.join(rootDir, 'package.json'));
const openclawVersion = pkg.openclaw && pkg.openclaw.version;
if (!openclawVersion) {
  console.error('[apply-openclaw-patches] Missing "openclaw.version" in package.json.');
  process.exit(1);
}

const patchesDir = path.join(rootDir, 'scripts', 'patches', openclawVersion);

if (!fs.existsSync(openclawSrc)) {
  console.error(`[apply-openclaw-patches] openclaw source not found: ${openclawSrc}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(openclawSrc, 'package.json'))) {
  console.error(`[apply-openclaw-patches] Not an openclaw project: ${openclawSrc}`);
  process.exit(1);
}

if (!fs.existsSync(patchesDir)) {
  console.log(`[apply-openclaw-patches] No patches directory for ${openclawVersion}, nothing to do.`);
  process.exit(0);
}

const patchFiles = fs.readdirSync(patchesDir)
  .filter(f => f.endsWith('.patch'))
  .sort();

const requiredRunSafetyPatchFiles = [
  'openclaw-varying-args-no-progress-core.patch',
  'openclaw-varying-args-no-progress-delivery.patch',
  'openclaw-varying-args-no-progress-native-receipt.patch',
  'openclaw-z-agent-harness-run-safety.patch',
];
const missingRequiredRunSafetyPatches = requiredRunSafetyPatchFiles.filter(
  patchFile => !patchFiles.includes(patchFile),
);
if (missingRequiredRunSafetyPatches.length > 0) {
  console.error(
    `[apply-openclaw-patches] Missing required run-safety patch file(s): ${missingRequiredRunSafetyPatches.join(', ')}`,
  );
  process.exit(1);
}

if (patchFiles.length === 0) {
  console.log(`[apply-openclaw-patches] No patches found for ${openclawVersion}, nothing to do.`);
  process.exit(0);
}

console.log(`[apply-openclaw-patches] Applying patches for openclaw ${openclawVersion} (${patchFiles.length} file(s))`);

const strongPatchValidators = {
  'openclaw-terminate-run-on-critical-tool-loop.patch': [
    {
      file: 'packages/agent-core/src/agent.ts',
      snippets: [
        'ShouldStopAfterTurnContext',
        'this.shouldStopAfterTurn = options.shouldStopAfterTurn',
        'shouldStopAfterTurn: this.shouldStopAfterTurn',
      ],
    },
    {
      file: 'src/agents/agent-tools.before-tool-call.ts',
      snippets: [
        'const terminateRun = deniedReason === "tool-loop"',
        '...(terminateRun ? { terminate: true } : {})',
      ],
    },
    {
      file: 'src/agents/sessions/sdk.ts',
      snippets: [
        'shouldStopAfterTurn: (context) => {',
        'details?.deniedReason === "tool-loop"',
      ],
    },
    {
      file: 'packages/agent-core/src/agent.critical-tool-loop.test.ts',
      snippets: [
        'stops a mixed parallel batch after normal sibling tools finish',
        'expect(providerTurns).toBe(1)',
        'expect(shouldStopCalls).toBe(1)',
      ],
    },
    {
      file: 'src/agents/agent-tools.before-tool-call.blocked-result.test.ts',
      snippets: [
        'terminates critical tool-loop vetoes',
        'keeps %s vetoes non-terminating',
        'expect(result.terminate).toBe(true)',
      ],
    },
  ],
  'openclaw-stop-loop-after-aborted-tool-run.patch': [
    {
      file: 'packages/agent-core/src/agent-loop.ts',
      snippets: [
        'const stopIfAborted = async (): Promise<boolean> => {',
        'signal.reason instanceof Error ? signal.reason : new Error("Agent run aborted")',
        'await emit({ type: "turn_end", message: abortedMessage, toolResults: [] });',
        'if (await stopIfAborted())',
      ],
    },
    {
      file: 'packages/agent-core/src/agent-loop.test.ts',
      snippets: [
        'does not request another model turn after a tool aborts the run',
        'does not request another model turn when an async turn hook aborts the run',
        'expect(streamCalls).toBe(1)',
      ],
    },
  ],
  'openclaw-dashscope-context-cache.patch': [
    {
      file: 'src/agents/embedded-agent-runner/prompt-cache-retention.ts',
      snippets: [
        'contextCacheProvider === "dashscope"',
        'contextCacheProvider === "anthropic-compatible"',
        'contextCacheMode === "explicit"',
        'explicitContextCacheEligible',
      ],
    },
    {
      file: 'src/llm/providers/openai-completions.ts',
      snippets: [
        'getCompatCacheControl(compat, cacheRetention, options)',
        'options?.contextCacheProvider === "dashscope"',
        'options?.contextCacheProvider === "anthropic-compatible"',
        'options?.contextCacheMode === "explicit"',
        'isOpenAICompatibleExplicitContextCache(options)',
        'EXPLICIT_CONTEXT_CACHE_LOG_PREFIX = "********************"',
        '[ExplicitCachePayload]',
        'hasCacheControl=',
        'cache_control: cacheControl',
        'return { type: "ephemeral", ...(ttl ? { ttl } : {}) };',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/extra-params.ts',
      snippets: [
        'contextCacheProvider?: "dashscope" | "anthropic-compatible"',
        'contextCacheMode?: "explicit"',
        'resolveExplicitContextCacheStreamParams',
        'EXPLICIT_CONTEXT_CACHE_LOG_PREFIX = "********************"',
        '[ExplicitCachePassThrough]',
        '...explicitContextCacheParams',
      ],
    },
    {
      file: 'src/agents/openai-transport-stream.ts',
      snippets: [
        'contextCacheProvider?: string',
        'contextCacheMode?: string',
        'isOpenAICompatibleExplicitContextCache',
        'applyOpenAICompletionsExplicitContextCache',
        'EXPLICIT_CONTEXT_CACHE_LOG_PREFIX = "********************"',
        '[ExplicitCachePayload]',
        'cache_control: cacheControl',
      ],
    },
  ],
  'openclaw-user-turn-cache-stability.patch': [
    {
      file: 'src/agents/embedded-agent-runner/run/attempt.llm-boundary.ts',
      snippets: [
        'canonicalizeTextOnlyUserContent',
        'stampUserTextWithMessageTimestamp',
        'currentUserTimestampOverride',
      ],
    },
    {
      file: 'src/gateway/server-methods/agent-timestamp.ts',
      snippets: ['export function buildTimestampPrefix'],
    },
    {
      file: 'src/gateway/server-methods/chat.ts',
      snippets: ['BodyForAgent: messageForAgent'],
    },
    {
      file: 'src/agents/embedded-agent-runner/run/attempt.llm-boundary.cache-stability.test.ts',
      snippets: ['prompt-cache byte-identity', 'turn1AsCurrent', 'turn1AsHistorical'],
    },
  ],
  'openclaw-live-tool-result-cache-stability.patch': [
    {
      file: 'src/agents/embedded-agent-runner/run/attempt.ts',
      snippets: [
        'const PROMPT_TOOL_RESULT_AGGREGATE_CAP_MULTIPLIER = 4',
        'promptToolResultMaxChars * PROMPT_TOOL_RESULT_AGGREGATE_CAP_MULTIPLIER',
      ],
      forbiddenSnippets: ['promptToolResultMaxChars,\n            null,'],
    },
    {
      file: 'src/agents/embedded-agent-runner/tool-result-truncation.ts',
      snippets: ['aggregateMaxCharsOverride?: number'],
      forbiddenSnippets: [
        'aggregateMaxCharsOverride?: number | null',
        'aggregateMaxCharsOverride === null',
        'Number.POSITIVE_INFINITY',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/tool-result-truncation.test.ts',
      snippets: ['keeps aggregate-bounded prompt projections byte-stable across retry and fallback'],
    },
  ],
  'openclaw-varying-args-no-progress-core.patch': [
    {
      file: 'src/agents/run-safety-controller.ts',
      snippets: [
        'maxToolCallReservationsPerBudgetScope: 64',
        'maxProviderDispatchesPerBudgetScope: 32',
        'maxCumulativeEstimatedPromptTokensPerBudgetScope: 2_000_000',
        'warningRatio: 0.75',
        'reserveToolBatch(params: {',
        'reserveProviderDispatch(params: {',
        'containsUnknownRemoteMedia',
        'publishTerminalOnce(reason: RunSafetyTermination): boolean {',
        'if (this.scopeTerminalReasonValue) {',
        // The prompt-exposure budget is calibrated in tokens; the estimator
        // must count CJK-aware token equivalents with a bounded per-blob
        // inline-media estimate, never raw serialized bytes.
        'estimateStringChars, estimateTokensFromChars',
        'INLINE_MEDIA_TOKEN_ESTIMATE',
      ],
      forbiddenSnippets: ['Buffer.byteLength(serialized'],
    },
    {
      file: 'src/agents/run-safety-controller.test.ts',
      snippets: [
        'publishes only the first product terminal outcome',
        'expect(coordinator.publishTerminalOnce(first)).toBe(true)',
        'expect(coordinator.publishTerminalOnce(second)).toBe(false)',
      ],
    },
    {
      file: 'src/agents/run-safety-registry.ts',
      snippets: [
        'maxActiveScopes: 128',
        'maxTombstones: 512',
        'tombstoneTtlMs: 30 * 60 * 1_000',
        'claimToken: string;',
        'resolveInheritedRun(params: ResolveInheritedRunParams)',
        'export const runSafetyRegistry = new RunSafetyRegistry();',
      ],
    },
    {
      file: 'src/agents/provider-run-safety-contract.ts',
      snippets: [
        'ProviderRunSafetyContractVersion',
        'Provider run-safety V1 stream requires the host-owned final-payload gate.',
        'Provider run-safety V1 preparation must return one finalPayload/transport descriptor.',
        'const prepared = await prepare({',
        'const replacement = await onPayload(prepared.finalPayload, model);',
        'return await prepared.transport({',
        'adaptBundledAuditedProviderPayloadHookStreamFnV1',
      ],
      forbiddenSnippets: ['adaptAuditedProviderPayloadHookStreamFnV1'],
    },
    {
      file: 'src/agents/embedded-agent-runner/run/run-safety-gate.ts',
      snippets: [
        'params.controller.reserveToolBatch({',
        'params.controller.reserveProviderDispatch({',
        'const finalEstimate = estimateRunSafetyPromptTokens(finalPayload, payloadModel);',
        'params.controller.refineProviderPromptEstimate({',
        'runWithRunSafetyProviderDispatch',
        'maxRetries: 0',
      ],
      orderedSnippets: [
        'const safetyDecisions = params.controller.reserveToolBatch({',
        'if (priorBeforeToolCallBatch && priorContext.toolCalls.length > 0) {',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/run/attempt.ts',
      snippets: [
        'installRunSafetyAgentHooks({',
        'activeSession.agent.streamFn = wrapStreamFnWithRunSafety({',
        'controller: params.runSafety.controller',
        'allowManagedSideEffects: !params.runSafety',
      ],
      orderedSnippets: [
        'activeSession.agent.streamFn = wrapStreamFnWithRunSafety({',
        'activeSession.agent.streamFn = wrapAnthropicStreamWithRecovery(',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/result-fallback-classifier.ts',
      snippets: [
        'if (params.result.meta.terminationReason) {',
        'return null;',
      ],
      orderedSnippets: [
        'if (params.result.meta.terminationReason) {',
        'return null;',
      ],
    },
    {
      file: 'src/plugins/provider-runtime.ts',
      snippets: [
        'export function resolveProviderAgentStreamFnV1',
        'exposes an unversioned createStreamFn and cannot be used for Agent execution',
        'returned an unmarked createAgentStreamFnV1 result',
        'isProviderRunSafetyStreamFnV1(streamFn)',
        'resolveProviderPluginHostOrigin(plugin) === "bundled"',
        'adaptBundledAuditedProviderPayloadHookStreamFnV1(streamFn)',
      ],
    },
    {
      file: 'src/plugins/provider-registration-provenance.ts',
      snippets: [
        'const providerHostOrigins = new WeakMap<ProviderPlugin, PluginOrigin>();',
        'cloneProviderPluginWithHostProvenance',
        'params.records.find((candidate) => candidate.id === params.registration.pluginId)',
        'providerHostOrigins.set(plugin, record.origin);',
      ],
    },
    {
      file: 'src/plugin-sdk/provider-model-shared.ts',
      snippets: [
        'createProviderRunSafetyStreamFnV1',
        'type ProviderRunSafetyPreparedDispatchV1',
        'type ProviderRunSafetyPrepareV1',
      ],
      forbiddenSnippets: ['adaptAuditedProviderPayloadHookStreamFnV1'],
    },
    {
      file: 'extensions/amazon-bedrock/stream.runtime.ts',
      snippets: [
        'function buildBedrockRuntimeClientConfig(options: BedrockOptions)',
        'maxAttempts: 1',
      ],
    },
    {
      file: 'extensions/amazon-bedrock/register.sync.runtime.ts',
      snippets: [
        'maxAttempts: 1',
        '(await originalOnPayload?.(payload, payloadModel)) ?? payload',
        'const traits = await resolveAppProfileTraits(modelId, region);',
      ],
      orderedSnippets: [
        '(await originalOnPayload?.(payload, payloadModel)) ?? payload',
        'const traits = await resolveAppProfileTraits(modelId, region);',
      ],
    },
    {
      file: 'extensions/google/transport-stream.ts',
      snippets: [
        'shouldDisableInternalProviderTransportRetries()',
        'internal transport retry is disabled for this run',
      ],
    },
    {
      file: 'extensions/lmstudio/src/stream.ts',
      snippets: ['shouldDisableInternalProviderTransportRetries()'],
    },
    {
      file: 'src/agents/embedded-agent-runner/google-prompt-cache.ts',
      snippets: [
        'allowManagedSideEffects?: boolean;',
        'if (params.allowManagedSideEffects === false) {',
      ],
    },
    {
      file: 'src/config/zod-schema.agent-defaults.ts',
      snippets: [
        'runSafety: z',
        'maxToolCallReservationsPerBudgetScope: z.number().int().positive().safe().optional()',
        'maxProviderDispatchesPerBudgetScope: z.number().int().positive().safe().optional()',
        'maxCumulativeEstimatedPromptTokensPerBudgetScope: z',
      ],
      forbiddenSnippets: ['maxToolCallingRounds'],
    },
    {
      file: 'packages/agent-core/src/agent-loop.ts',
      snippets: [
        'const decisions = (await config.beforeToolCallBatch?.(batchContext, signal)) ?? [];',
        'decision: decisions.find((decision) => decision.rawIndex === rawIndex)',
        'await config.afterToolCallBatch?.({ ...batchContext, decisions }, signal);',
      ],
      orderedSnippets: [
        'const decisions = (await config.beforeToolCallBatch?.(batchContext, signal)) ?? [];',
        'const tool = currentContext.tools?.find((t) => t.name === toolCall.name);',
      ],
    },
    {
      file: 'src/agents/tool-loop-detection.ts',
      snippets: [
        'normalizeReadOnlyPowerShellWindowCommand',
        'Select-Object\\s+-First\\s+([0-9]+)',
        'detector: "variant_no_progress"',
        'variant.distinctArgsHashCount >= config.variantCriticalThreshold',
      ],
    },
    {
      file: 'src/auto-reply/reply/agent-runner.ts',
      snippets: [
        'const runSafetyRegistration = runSafetyRegistry.registerRoot({',
        'if (!runSafetyRegistration.ok) {',
        'runSafety: runSafetyRegistration.context,',
        'runSafetyRegistry.releaseRun({',
      ],
      orderedSnippets: [
        'const runSafetyRegistration = runSafetyRegistry.registerRoot({',
        'traceAgentPhase("reply.preflight_compaction"',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/compact.ts',
      snippets: [
        'runSafetyRegistry.registerRoot({',
        'wrapStreamFnWithRunSafety',
        'runSafetyRegistry.releaseRun({',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/compact.queued.ts',
      snippets: [
        // The self-registered scope must thread its normalized run id into the
        // recursive call, or downstream harness compaction fails closed on a
        // scope without a run id.
        'runId,\n        runSafety: registration.context,',
      ],
    },
    {
      file: 'src/agents/cli-runner/run-safety.ts',
      snippets: [
        'Native CLI',
        'tool calls remain opaque to the host',
        'export function reserveCliProviderDispatch',
        'RunPromptEstimateUnavailable',
      ],
    },
    {
      file: 'src/agents/cli-runner/execute.ts',
      snippets: [
        'runSafetyReservation = reserveCliProviderDispatch({',
        'runSafetyReservation?.complete();',
      ],
      orderedSnippets: [
        'runSafetyReservation = reserveCliProviderDispatch({',
        'const managedRun = await supervisor.spawn({',
      ],
    },
    {
      file: 'src/agents/main-session-restart-recovery.ts',
      snippets: [
        'Never create a fresh scope for an old turn',
        'resumeBlockReason ?? "run-safety state unavailable after process restart"',
        'entry.status = "failed";',
      ],
      forbiddenSnippets: [
        'method: "agent"',
        'async function resumeMainSession',
      ],
    },
    {
      file: 'src/agents/main-session-restart-recovery.test.ts',
      snippets: [
        'fails closed after restart without dispatching an agent provider run',
        'does not use a durable pending payload to restart provider work',
        'call[0].method === "agent"',
      ],
    },
    {
      file: 'packages/agent-core/src/agent.run-safety-tool-budget.test.ts',
      snippets: [
        'runs before lookup, schema validation, per-tool hooks, and side effects',
        'forwards raw batch hooks through Agent and stops before prepareNextTurn',
        'expect(providerCall).toHaveBeenCalledTimes(1)',
        'expect(prepareNextTurn).not.toHaveBeenCalled()',
      ],
    },
    {
      file: 'src/agents/run-safety-registry.test.ts',
      snippets: [
        'keeps all 128 active scopes and fails the next root closed without eviction',
        'consumes an inherited claim exactly once',
        'does not let a late child event revive a tombstoned scope',
      ],
    },
    {
      file: 'src/agents/provider-run-safety-contract.test.ts',
      snippets: [
        'awaits the host final-payload gate before the plugin transport can start',
        'invokes the one prepared transport exactly once',
        'rejects malformed preparation before any transport can start',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/run/run-safety-gate.test.ts',
      snippets: [
        'reserves the Anthropic without-thinking recovery as a second provider dispatch',
        'counts the final payload instead of the larger Agent Context and disables SDK retries',
        'atomically refines concurrent dispatches exactly to the prompt limit',
        'blocks the next logical dispatch before invoking the provider',
        'blocks raw overflow calls and stops after the allowed sibling settles',
      ],
    },
    {
      file: 'src/plugins/provider-runtime.test.ts',
      snippets: [
        'applies the audited compatibility bridge only to host-proven bundled providers',
        'rejects plugin-reported bundled identity without host provenance',
      ],
    },
    {
      file: 'extensions/amazon-bedrock/stream.runtime.test.ts',
      snippets: [
        'forces one SDK attempt despite default, environment, or profile retry configuration',
      ],
    },
    {
      file: 'extensions/amazon-bedrock/index.test.ts',
      snippets: [
        'forces one control-plane attempt despite AWS retry configuration',
        'runs the host prompt gate before profile discovery or Converse transport',
      ],
    },
    {
      file: 'extensions/google/transport-stream.test.ts',
      snippets: [
        'does not retry a Gemini 3 first-response timeout inside one host dispatch',
        'expect(guardedFetchMock).toHaveBeenCalledTimes(1)',
      ],
    },
    {
      file: 'extensions/lmstudio/src/stream.test.ts',
      snippets: [
        'skips best-effort preload inside a host run-safety provider dispatch',
        'expect(ensureLmstudioModelLoadedMock).not.toHaveBeenCalled()',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/google-prompt-cache.test.ts',
      snippets: [
        'disables managed cache network side effects for run-safety Agent scopes',
        'expect(fetchMock).not.toHaveBeenCalled()',
      ],
    },
    {
      file: 'src/agents/custom-api-registry.test.ts',
      snippets: [
        'rejects an unversioned Agent stream before it can be registered or invoked',
        'keeps utility streamSimple isolated when an Agent V1 stream is registered',
      ],
    },
    {
      file: 'extensions/ollama/src/stream-runtime.test.ts',
      snippets: [
        'awaits the final payload gate and sends its replacement before fetch',
      ],
    },
  ],
  'openclaw-varying-args-no-progress-delivery.patch': [
    {
      file: 'src/agents/run-safety-delivery.ts',
      snippets: [
        'return JSON.stringify([termination.rootInvocationId, termination.kind]);',
        'deliverDespiteSourceReplySuppression: true',
        'buildRunSafetyNativeReplyPayloadsForOwner',
        'recordRunSafetyDeliveryReceiptForPayload',
        // In-flight claims are leases: an orphaned claim (payload identity lost
        // in a delivery transform) must expire instead of pending forever.
        'DEFAULT_RUN_SAFETY_DELIVERY_CLAIM_TIMEOUT_MS',
        'clearTimeout(attempt.expiryTimer);',
      ],
    },
    {
      file: 'src/auto-reply/reply/reply-dispatcher.ts',
      snippets: [
        'copyReplyPayloadMetadata(payload, normalizedResult)',
        'copyReplyPayloadMetadata(normalized, deliverPayload)',
      ],
    },
    {
      file: 'src/auto-reply/dispatch.ts',
      snippets: [
        'copyReplyPayloadMetadata(payload, { ...payload, text: result.content })',
      ],
    },
    {
      file: 'src/auto-reply/reply/reply-payload-sending-hook.ts',
      snippets: ['copyReplyPayloadMetadata(params.payload, replacement)'],
    },
    {
      file: 'src/auto-reply/reply/dispatch-from-config.ts',
      snippets: [
        // Marked terminal payloads (run-safety stops) must bypass block-lane
        // source suppression exactly like the final-reply loop does.
        'if (suppressDelivery && !shouldDeliverDespiteSourceReplySuppression(payload)) {',
      ],
    },
    {
      file: 'src/auto-reply/reply/followup-runner.ts',
      snippets: ['recordRunSafetyDeliveryReceiptForPayload(payload, false);'],
      // Queue admission must never be recorded as a successful delivery; the
      // dispatcher / origin route settles the receipt with the real outcome.
      forbiddenSnippets: [
        'recordRunSafetyDeliveryReceiptForPayload(payload, { ok: true })',
      ],
    },
    {
      file: 'src/agents/command/delivery.ts',
      snippets: [
        'ownsRunSafetyTerminal: boolean;',
        'runSafetyPayloadsPrepared?: boolean;',
        'params.runSafetyPayloadsPrepared === true',
        'recordRunSafetyDeliveryReceiptForPayload',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/replay-history.ts',
      snippets: [
        'MIN_REPEATED_TOOL_HISTORY_PAIRS = 4',
        'MAX_PRESERVED_REPEATED_TOOL_HISTORY_PAIRS = 2',
        'pairs.slice(0, -MAX_PRESERVED_REPEATED_TOOL_HISTORY_PAIRS)',
      ],
    },
    {
      file: 'src/agents/main-session-restart-recovery.ts',
      snippets: [
        'pendingFinalDeliveryResult?: { delivered: boolean; error?: string }',
        'if (params.pendingFinalDeliveryResult?.delivered)',
        '} else if (entry.pendingFinalDeliveryText) {',
        'entry.pendingFinalDelivery = true;',
        'entry.pendingFinalDeliveryLastError =',
        'pendingFinalDeliveryResult: deliveryResult',
      ],
    },
    {
      file: 'src/gateway/server-methods/agent.ts',
      snippets: [
        'buildRunSafetyNativeReplyPayloadsForOwner',
        'runSafetyPayloadsPrepared: true',
      ],
    },
    {
      file: 'src/agents/run-safety-delivery.test.ts',
      snippets: [
        'deduplicates receipts by root invocation and kind, not child run id',
        'arbitrates a root-result and late-child delivery race through one in-flight claim',
        'releases a failed in-flight claim so the owner can retry',
      ],
    },
    {
      file: 'src/agents/command/delivery.test.ts',
      snippets: [
        'does not let inherited child delivery claim the root-owned safety terminal',
        'preserves a gateway-prepared owner payload and settles its receipt once',
        'releases a failed gateway-prepared owner attempt so the owner can retry',
      ],
    },
    {
      file: 'src/agents/main-session-restart-recovery.test.ts',
      snippets: [
        'delivers a deterministic interruption notice through the current run context',
        'retains a durable pending payload when direct restart delivery fails',
        'clears pending final text instead of putting it into a recovery prompt',
        'expect(gatewayCall?.method).toBe("message.action")',
      ],
    },
  ],
  'openclaw-varying-args-no-progress-native-receipt.patch': [
    {
      file: 'src/auto-reply/reply/agent-runner.ts',
      snippets: [
        'await opts.onBlockReply(applyReplyToMode(payload));',
        'await waitForRunSafetyDeliveryReceipt(reason)',
        'Run-safety terminal reply was queued but not delivered.',
        'const payloadArray = await buildRunSafetyNativeReplyPayloadsForOwner({',
      ],
      orderedSnippets: [
        'await opts.onBlockReply(applyReplyToMode(payload));',
        'await waitForRunSafetyDeliveryReceipt(reason)',
      ],
    },
    {
      file: 'src/agents/run-safety-controller.ts',
      snippets: [
        'const publishTask = (async () => {',
        'this.ownerPublishTask = publishTask;',
        'if (!succeeded && this.ownerPublishTask === publishTask) {',
        'this.ownerPublishTask = undefined;',
      ],
    },
    {
      file: 'src/agents/run-safety-controller.test.ts',
      snippets: [
        'releases a failed owner publication task so the retained owner can retry',
        'expect(deliveryAttempts).toBe(4);',
      ],
    },
    {
      file: 'src/agents/run-safety-delivery.test.ts',
      snippets: [
        'retries a queued owner reply until an actual delivery receipt succeeds',
        'expect(deliveredPayloads).toHaveLength(3);',
        'expect(hasRunSafetyDeliveryReceipt(reason)).toBe(true);',
        'expires an orphaned claim so the retained owner can re-claim and deliver',
        'waits out a live claim instead of expiring it early',
      ],
    },
  ],
  'openclaw-z-agent-harness-run-safety.patch': [
    {
      file: 'src/agents/harness/run-safety-contract.ts',
      snippets: [
        'const runAttemptHandlersV1 = new WeakSet<AgentHarnessRunAttemptHandlerV1>();',
        'const compactHandlersV1 = new WeakSet<AgentHarnessCompactHandlerV1>();',
        'Unversioned AgentHarness runAttempt is not permitted.',
        'Unversioned AgentHarness compact is not permitted.',
        'runSafety.controller.reserveProviderDispatch({',
        'estimateRunSafetyPromptTokens(finalPayload, model)',
        'runSafety.controller.refineProviderPromptEstimate({',
        'return await transport(finalPayload);',
      ],
    },
    {
      file: 'src/agents/harness/lifecycle.ts',
      snippets: [
        'await runAgentHarnessAttemptV1({',
        'legacyHandlerPresent: typeof harness.runAttempt === "function"',
      ],
    },
    {
      file: 'src/agents/harness/compaction.ts',
      snippets: [
        'await runAgentHarnessCompactV1({',
        'legacyHandlerPresent: typeof harness.compact === "function"',
        // Production compaction entry points carry a session identity but no
        // live run; the entry must normalize the run id and bootstrap a scope
        // instead of failing closed on every real trigger.
        'const runId = params.runId?.trim() || params.sessionId;',
        'runSafetyRegistry.registerRoot({',
        'runSafetyRegistry.releaseRun({',
      ],
    },
    {
      file: 'src/agents/harness/selection.test.ts',
      snippets: [
        'compacts a production-shaped request without a run id or run-safety scope',
        'normalizes a missing run id when the caller already provides a run-safety scope',
      ],
    },
    {
      file: 'extensions/codex/src/app-server/run-attempt.ts',
      snippets: [
        'finalPayload: turnStartParams',
        'client.request("turn/start", finalPayload as typeof turnStartParams',
      ],
    },
    {
      file: 'extensions/copilot/src/attempt.ts',
      snippets: [
        'const finalPayload = {',
        'sessionConfig,',
        'messageOptions,',
        'return await session!.sendAndWait(finalMessageOptions, input.timeoutMs);',
      ],
    },
    {
      file: 'src/agents/harness/run-safety-contract.test.ts',
      snippets: [
        'rejects an unversioned attempt before invoking plugin code',
        'counts one normal send as one provider dispatch',
        'creates a new ticket for each recovery send on the shared controller',
        'does not call transport when the dispatch limit is exhausted',
        'does not call transport when final prompt exposure exceeds the limit',
      ],
    },
  ],
  'zz-openclaw-task-cwd-system-prompt.patch': [
    {
      file: 'src/agents/system-prompt.ts',
      snippets: [
        'runtimeCwd?: string',
        'const hasSeparateRuntimeCwd =',
        '"## Directory Roles"',
        '`Task working directory: ${sanitizedRuntimeCwd}`',
        '`Agent workspace: ${sanitizedWorkspaceDir}`',
        'MEMORY.md, and memory/**',
        'runtimeCwd: sanitizedRuntimeCwd',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/system-prompt.ts',
      snippets: ['runtimeCwd?: string', 'runtimeCwd: params.runtimeCwd'],
    },
    {
      file: 'src/agents/embedded-agent-runner/run/attempt.ts',
      snippets: ['workspaceDir: effectiveWorkspace,\n        runtimeCwd: effectiveCwd,'],
    },
    {
      file: 'src/agents/embedded-agent-runner/compact.ts',
      snippets: ['workspaceDir: effectiveWorkspace,\n        runtimeCwd: effectiveCwd,'],
    },
    {
      file: 'src/agents/system-prompt.test.ts',
      snippets: [
        'separates the task working directory from the persistent agent workspace',
        'preserves workspace guidance when task cwd is not separate',
      ],
    },
    {
      file: 'src/agents/embedded-agent-runner/run/attempt.cwd-split.test.ts',
      snippets: ['expect(promptCall?.runtimeCwd).toBe(taskRepo)'],
    },
  ],
};

function collectMissingStrongPatchSnippets(patchFile) {
  const validators = strongPatchValidators[patchFile];
  if (!validators) {
    return [];
  }

  const missing = [];
  for (const validator of validators) {
    const targetPath = path.join(openclawSrc, validator.file);
    if (!fs.existsSync(targetPath)) {
      missing.push(`${validator.file}: file not found`);
      continue;
    }

    const source = fs.readFileSync(targetPath, 'utf8');
    for (const snippet of validator.snippets) {
      if (!source.includes(snippet)) {
        missing.push(`${validator.file}: missing ${JSON.stringify(snippet)}`);
      }
    }
    for (const snippet of validator.forbiddenSnippets ?? []) {
      if (source.includes(snippet)) {
        missing.push(`${validator.file}: contains forbidden ${JSON.stringify(snippet)}`);
      }
    }
    let orderedSearchOffset = 0;
    for (const snippet of validator.orderedSnippets ?? []) {
      const index = source.indexOf(snippet, orderedSearchOffset);
      if (index < 0) {
        missing.push(`${validator.file}: missing ordered ${JSON.stringify(snippet)}`);
        break;
      }
      orderedSearchOffset = index + snippet.length;
    }
  }
  return missing;
}

function assertStrongPatchApplied(patchFile) {
  const missing = collectMissingStrongPatchSnippets(patchFile);
  if (missing.length === 0) {
    return;
  }

  console.error(`[apply-openclaw-patches] Strong validation failed for ${patchFile}.`);
  console.error('[apply-openclaw-patches] The patch was not applied to the actual OpenClaw source tree:');
  for (const item of missing) {
    console.error(`[apply-openclaw-patches]   - ${item}`);
  }
  process.exit(1);
}

// Reset openclaw source to a clean tag state before applying patches.
// This removes stale patches left by a different LobsterAI branch that may have
// applied different patches for the same openclaw version.
try {
  execFileSync('git', ['reset', 'HEAD', '.'], { cwd: openclawSrc, stdio: 'pipe' });
  execFileSync('git', ['checkout', '.'], { cwd: openclawSrc, stdio: 'pipe' });
  execFileSync('git', ['clean', '-fd'], { cwd: openclawSrc, stdio: 'pipe' });
  console.log('[apply-openclaw-patches] Reset openclaw source to clean state before patching.');
} catch (err) {
  console.error(`[apply-openclaw-patches] Failed to reset openclaw source: ${err.message}`);
  console.error('[apply-openclaw-patches] Refusing to apply patches to an unknown working-tree state.');
  process.exit(1);
}

let applied = 0;
let skipped = 0;

for (const patchFile of patchFiles) {
  const originalPatchPath = path.join(patchesDir, patchFile);

  // Normalize line endings: strip \r so that CRLF-checked-out patches don't
  // cause "corrupt patch" errors on Windows (git apply rejects \r in diffs).
  const raw = fs.readFileSync(originalPatchPath, 'utf8');
  const needsNormalize = raw.includes('\r');
  let patchPath = originalPatchPath;
  if (needsNormalize) {
    patchPath = path.join(os.tmpdir(), `lobsterai-patch-${patchFile}`);
    fs.writeFileSync(patchPath, raw.replace(/\r/g, ''), 'utf8');
  }

  try {
    // Check if patch is already applied.
    //
    // Strategy:
    //   1. Try `git apply --check --reverse` — if it succeeds the patch is applied.
    //   2. Try `git apply --check` (forward) — if it succeeds the patch is NOT applied.
    //   3. If BOTH fail, the state is ambiguous or partial and must fail closed.
    //
    // Strong source sentinels validate known complete states, but never turn an
    // ambiguous git-apply result into success.

    let reverseOk = false;
    try {
      execFileSync('git', ['apply', '--check', '--reverse', '--ignore-whitespace', patchPath], {
        cwd: openclawSrc,
        stdio: 'pipe',
      });
      reverseOk = true;
    } catch {
      // reverse check failed — patch may or may not be applied
    }

    if (reverseOk) {
      assertStrongPatchApplied(patchFile);
      console.log(`[apply-openclaw-patches] Already applied: ${patchFile}`);
      skipped++;
      continue;
    }

    // Try forward apply check.
    let forwardErr = null;
    try {
      execFileSync('git', ['apply', '--check', '--ignore-whitespace', patchPath], {
        cwd: openclawSrc,
        stdio: 'pipe',
      });
    } catch (err) {
      forwardErr = err;
    }

    if (forwardErr) {
      const stderr = forwardErr.stderr ? forwardErr.stderr.toString() : '';
      console.error(`[apply-openclaw-patches] Patch state is ambiguous or partial: ${patchFile}`);
      console.error('[apply-openclaw-patches] Both reverse and forward checks failed.');
      console.error('[apply-openclaw-patches] Refusing to infer a complete application from source sentinels.');
      console.error('[apply-openclaw-patches] Reset to the pinned OpenClaw tag or regenerate the patch.');
      if (stderr) console.error(stderr);
      process.exit(1);
    }

    // Apply the patch.
    try {
      execFileSync('git', ['apply', '--ignore-whitespace', patchPath], {
        cwd: openclawSrc,
        stdio: 'pipe',
      });
      assertStrongPatchApplied(patchFile);
      console.log(`[apply-openclaw-patches] Applied: ${patchFile}`);
      applied++;
    } catch (err) {
      console.error(`[apply-openclaw-patches] Failed to apply: ${patchFile}`);
      const stderr = err.stderr ? err.stderr.toString() : '';
      if (stderr) console.error(stderr);
      process.exit(1);
    }
  } finally {
    // Clean up temporary normalized patch file.
    if (needsNormalize && fs.existsSync(patchPath)) {
      try { fs.unlinkSync(patchPath); } catch {}
    }
  }
}

for (const patchFile of patchFiles) {
  assertStrongPatchApplied(patchFile);
}

console.log(`[apply-openclaw-patches] Done. Applied: ${applied}, Skipped (already applied): ${skipped}`);
