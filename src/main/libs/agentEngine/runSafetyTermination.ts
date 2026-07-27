import {
  buildRunSafetyTerminationKey,
  type RunSafetyTermination,
  RunSafetyTerminationKind,
} from '../../../shared/cowork/runSafety';
import type { CoworkMessage, CoworkMessageMetadata } from '../../coworkStore';
import { t } from '../../i18n';

const RunSafetyTerminationI18nKey = {
  [RunSafetyTerminationKind.VariantNoProgress]: 'runSafetyVariantNoProgress',
  [RunSafetyTerminationKind.RunToolBudget]: 'runSafetyToolBudget',
  [RunSafetyTerminationKind.RunProviderDispatchBudget]: 'runSafetyProviderDispatchBudget',
  [RunSafetyTerminationKind.RunPromptExposureBudget]: 'runSafetyPromptExposureBudget',
  [RunSafetyTerminationKind.RunPromptEstimateUnavailable]: 'runSafetyPromptEstimateUnavailable',
  [RunSafetyTerminationKind.RunBudgetIdentityMissing]: 'runSafetyBudgetIdentityMissing',
  [RunSafetyTerminationKind.RunSafetyStateUnavailable]: 'runSafetyStateUnavailable',
} as const satisfies Record<RunSafetyTermination['kind'], string>;

export const formatRunSafetyTerminationMessage = (
  termination: RunSafetyTermination,
): string => t(RunSafetyTerminationI18nKey[termination.kind]);

export const buildRunSafetyTerminationMetadata = (
  termination: RunSafetyTermination,
): CoworkMessageMetadata => ({
  runSafetyTermination: true,
  kind: termination.kind,
  rootInvocationId: termination.rootInvocationId,
  ...(termination.budgetScopeId
    ? { budgetScopeId: termination.budgetScopeId }
    : {}),
  runId: termination.runId,
  ...(termination.detector ? { detector: termination.detector } : {}),
  ...(termination.toolName ? { toolName: termination.toolName } : {}),
  ...(termination.observedCount !== undefined
    ? { observedCount: termination.observedCount }
    : {}),
  ...(termination.limit !== undefined ? { limit: termination.limit } : {}),
  ...(termination.toolCallReservationCount !== undefined
    ? { toolCallReservationCount: termination.toolCallReservationCount }
    : {}),
  ...(termination.providerDispatchCount !== undefined
    ? { providerDispatchCount: termination.providerDispatchCount }
    : {}),
  ...(termination.cumulativeEstimatedPromptTokens !== undefined
    ? {
        cumulativeEstimatedPromptTokens:
          termination.cumulativeEstimatedPromptTokens,
      }
    : {}),
});

export const hasPersistedRunSafetyTermination = (
  messages: readonly CoworkMessage[],
  termination: RunSafetyTermination,
): boolean => {
  const key = buildRunSafetyTerminationKey(termination);
  return messages.some((message) => {
    if (message.type !== 'system' || message.metadata?.runSafetyTermination !== true) {
      return false;
    }
    const rootInvocationId = message.metadata.rootInvocationId;
    const kind = message.metadata.kind;
    if (typeof rootInvocationId !== 'string' || typeof kind !== 'string') {
      return false;
    }
    return JSON.stringify([rootInvocationId, kind]) === key;
  });
};
