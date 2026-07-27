import { describe, expect, test } from 'vitest';

import {
  expectPatchContains,
  readAddedPatchLines,
  readCurrentOpenClawPatch,
  readCurrentOpenClawPatchFileDiff,
} from './patchTestUtils';

const patchFile = 'openclaw-varying-args-no-progress-delivery.patch';

describe('OpenClaw run-safety deterministic delivery patch', () => {
  test('keys exactly-once delivery by root invocation and terminal kind', () => {
    const deliveryAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-delivery.ts'),
    );

    for (const snippet of [
      'return JSON.stringify([termination.rootInvocationId, termination.kind]);',
      'deliverDespiteSourceReplySuppression: true',
      'const inFlightRunSafetyDeliveries = new Map<',
      'recordRunSafetyDeliveryReceiptForPayload',
    ]) {
      expect(deliveryAdded).toContain(snippet);
    }
    expectPatchContains(patchFile, [
      'deduplicates receipts by root invocation and kind, not child run id',
      'does not share a receipt between distinct terminal kinds',
    ]);
  });

  test('arbitrates the root result and late-child owner callback through one receipt', () => {
    expectPatchContains(patchFile, [
      'buildRunSafetyNativeReplyPayloadsForOwner',
      'waitForRunSafetyDeliveryReceipt',
      'arbitrates a root-result and late-child delivery race through one in-flight claim',
      'releases a failed in-flight claim so the owner can retry',
      'does not let inherited child delivery claim the root-owned safety terminal',
    ]);
  });

  test('preserves an already-prepared gateway payload and settles it once', () => {
    const commandDeliveryAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/command/delivery.ts'),
    );
    const gatewayAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/gateway/server-methods/agent.ts'),
    );

    for (const snippet of [
      'runSafetyPayloadsPrepared?: boolean;',
      'params.runSafetyPayloadsPrepared === true',
      'recordRunSafetyDeliveryReceiptForPayload',
    ]) {
      expect(commandDeliveryAdded).toContain(snippet);
    }
    expect(gatewayAdded).toContain('runSafetyPayloadsPrepared: true');
    expectPatchContains(patchFile, [
      'preserves a gateway-prepared owner payload and settles its receipt once',
      'releases a failed gateway-prepared owner attempt so the owner can retry',
    ]);
  });

  test('folds repeated no-progress history after four pairs and keeps the latest two', () => {
    expectPatchContains(patchFile, [
      'MIN_REPEATED_TOOL_HISTORY_PAIRS = 4',
      'MAX_PRESERVED_REPEATED_TOOL_HISTORY_PAIRS = 2',
      'pairs.slice(0, -MAX_PRESERVED_REPEATED_TOOL_HISTORY_PAIRS)',
    ]);
  });

  test('expires orphaned delivery claims instead of waiting on them forever', () => {
    const deliveryAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/agents/run-safety-delivery.ts'),
    );

    // A claim is a lease: when a delivery transform replaces the payload
    // object and loses the receipt identity, the claimed attempt can never
    // settle itself. Without a deadline the owner publish task hangs and the
    // active registry scope leaks until the gateway restarts.
    expect(deliveryAdded).toContain('DEFAULT_RUN_SAFETY_DELIVERY_CLAIM_TIMEOUT_MS');
    expect(deliveryAdded).toContain('clearTimeout(attempt.expiryTimer);');
  });

  test('keeps the receipt identity across first-party payload transforms', () => {
    const dispatcherAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/auto-reply/reply/reply-dispatcher.ts'),
    );
    const dispatchAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/auto-reply/dispatch.ts'),
    );
    const sendingHookAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/auto-reply/reply/reply-payload-sending-hook.ts',
      ),
    );

    expect(dispatcherAdded).toContain('copyReplyPayloadMetadata(payload, normalizedResult)');
    expect(dispatcherAdded).toContain('copyReplyPayloadMetadata(normalized, deliverPayload)');
    expect(dispatchAdded).toContain(
      'copyReplyPayloadMetadata(payload, { ...payload, text: result.content })',
    );
    expect(sendingHookAdded).toContain('copyReplyPayloadMetadata(params.payload, replacement)');
  });

  test('delivers marked terminals through the block lane and settles suppressed drops', () => {
    const dispatchFromConfigAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/auto-reply/reply/dispatch-from-config.ts'),
    );

    expect(dispatchFromConfigAdded).toContain(
      'if (suppressDelivery && !shouldDeliverDespiteSourceReplySuppression(payload)) {',
    );
  });

  test('never records queue admission as a successful followup delivery', () => {
    const followupAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(patchFile, 'src/auto-reply/reply/followup-runner.ts'),
    );

    expect(followupAdded).not.toContain(
      'recordRunSafetyDeliveryReceiptForPayload(payload, { ok: true })',
    );
    expectPatchContains(patchFile, [
      'does not mask a downstream send failure as a delivered safety terminal',
    ]);
  });

  test('delivers restart terminals directly and retains failed pending delivery', () => {
    const restartRecoveryAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/main-session-restart-recovery.ts',
      ),
    );

    for (const snippet of [
      'pendingFinalDeliveryResult?: { delivered: boolean; error?: string };',
      'if (params.pendingFinalDeliveryResult?.delivered) {',
      '} else if (entry.pendingFinalDeliveryText) {',
      'entry.pendingFinalDeliveryLastError =',
      'pendingFinalDeliveryResult: deliveryResult,',
    ]) {
      expect(restartRecoveryAdded).toContain(snippet);
    }
    const patch = readCurrentOpenClawPatch(patchFile);
    expect(patch).toContain(
      'delivers a deterministic interruption notice through the current run context',
    );
    expect(patch).toContain(
      'retains a durable pending payload when direct restart delivery fails',
    );
    expect(patch).toContain(
      'clears pending final text instead of putting it into a recovery prompt',
    );
  });
});
