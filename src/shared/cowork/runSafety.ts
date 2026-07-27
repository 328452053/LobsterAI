export const RunSafetyTerminationKind = {
  VariantNoProgress: 'variant_no_progress',
  RunToolBudget: 'run_tool_budget',
  RunProviderDispatchBudget: 'run_provider_dispatch_budget',
  RunPromptExposureBudget: 'run_prompt_exposure_budget',
  RunPromptEstimateUnavailable: 'run_prompt_estimate_unavailable',
  RunBudgetIdentityMissing: 'run_budget_identity_missing',
  RunSafetyStateUnavailable: 'run_safety_state_unavailable',
} as const;

export type RunSafetyTerminationKind =
  typeof RunSafetyTerminationKind[keyof typeof RunSafetyTerminationKind];

type RunSafetyTerminationDetails = {
  detector?: string;
  toolName?: string;
  observedCount?: number;
  limit?: number;
  rootInvocationId: string;
  runId: string;
  toolCallReservationCount?: number;
  providerDispatchCount?: number;
  cumulativeEstimatedPromptTokens?: number;
};

export type RunSafetyTermination =
  | (RunSafetyTerminationDetails & {
      kind: typeof RunSafetyTerminationKind.RunBudgetIdentityMissing;
      budgetScopeId?: undefined;
    })
  | (RunSafetyTerminationDetails & {
      kind: Exclude<
        RunSafetyTerminationKind,
        typeof RunSafetyTerminationKind.RunBudgetIdentityMissing
      >;
      budgetScopeId: string;
    });

export type RunSafetyScopeIdentity = {
  rootInvocationId: string;
  budgetScopeId: string;
};

const RUN_SAFETY_OPAQUE_ID_MAX_LENGTH = 256;
const RUN_SAFETY_LABEL_MAX_LENGTH = 128;
const RUN_SAFETY_TERMINATION_KINDS = new Set<RunSafetyTerminationKind>(
  Object.values(RunSafetyTerminationKind),
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readBoundedString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
};

const readOptionalBoundedString = (
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
): { valid: boolean; value?: string } => {
  if (!(key in record)) return { valid: true };
  const value = readBoundedString(record[key], maxLength);
  return value ? { valid: true, value } : { valid: false };
};

const readOptionalNonNegativeSafeInteger = (
  record: Record<string, unknown>,
  key: string,
): { valid: boolean; value?: number } => {
  if (!(key in record)) return { valid: true };
  const value = record[key];
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
  ) {
    return { valid: false };
  }
  return { valid: true, value };
};

export const isRunSafetyTerminationKind = (
  value: unknown,
): value is RunSafetyTerminationKind =>
  typeof value === 'string'
  && RUN_SAFETY_TERMINATION_KINDS.has(value as RunSafetyTerminationKind);

/**
 * Parse the versioned OpenClaw run-safety wire value.
 *
 * Unknown fields are ignored for forward compatibility. Known fields are
 * accepted only when their complete trusted shape is present; malformed
 * values fall back to the ordinary lifecycle path.
 */
export const parseRunSafetyTermination = (
  value: unknown,
): RunSafetyTermination | null => {
  if (!isRecord(value) || !isRunSafetyTerminationKind(value.kind)) {
    return null;
  }

  const rootInvocationId = readBoundedString(
    value.rootInvocationId,
    RUN_SAFETY_OPAQUE_ID_MAX_LENGTH,
  );
  const runId = readBoundedString(value.runId, RUN_SAFETY_OPAQUE_ID_MAX_LENGTH);
  if (!rootInvocationId || !runId) return null;

  const detector = readOptionalBoundedString(
    value,
    'detector',
    RUN_SAFETY_LABEL_MAX_LENGTH,
  );
  const toolName = readOptionalBoundedString(
    value,
    'toolName',
    RUN_SAFETY_LABEL_MAX_LENGTH,
  );
  const observedCount = readOptionalNonNegativeSafeInteger(value, 'observedCount');
  const limit = readOptionalNonNegativeSafeInteger(value, 'limit');
  const toolCallReservationCount = readOptionalNonNegativeSafeInteger(
    value,
    'toolCallReservationCount',
  );
  const providerDispatchCount = readOptionalNonNegativeSafeInteger(
    value,
    'providerDispatchCount',
  );
  const cumulativeEstimatedPromptTokens = readOptionalNonNegativeSafeInteger(
    value,
    'cumulativeEstimatedPromptTokens',
  );
  if (
    !detector.valid
    || !toolName.valid
    || !observedCount.valid
    || !limit.valid
    || !toolCallReservationCount.valid
    || !providerDispatchCount.valid
    || !cumulativeEstimatedPromptTokens.valid
  ) {
    return null;
  }

  const details = {
    rootInvocationId,
    runId,
    ...(detector.value ? { detector: detector.value } : {}),
    ...(toolName.value ? { toolName: toolName.value } : {}),
    ...(observedCount.value !== undefined ? { observedCount: observedCount.value } : {}),
    ...(limit.value !== undefined ? { limit: limit.value } : {}),
    ...(toolCallReservationCount.value !== undefined
      ? { toolCallReservationCount: toolCallReservationCount.value }
      : {}),
    ...(providerDispatchCount.value !== undefined
      ? { providerDispatchCount: providerDispatchCount.value }
      : {}),
    ...(cumulativeEstimatedPromptTokens.value !== undefined
      ? { cumulativeEstimatedPromptTokens: cumulativeEstimatedPromptTokens.value }
      : {}),
  };

  if (value.kind === RunSafetyTerminationKind.RunBudgetIdentityMissing) {
    if (value.budgetScopeId !== undefined) return null;
    return {
      ...details,
      kind: value.kind,
    };
  }

  const budgetScopeId = readBoundedString(
    value.budgetScopeId,
    RUN_SAFETY_OPAQUE_ID_MAX_LENGTH,
  );
  if (!budgetScopeId) return null;
  return {
    ...details,
    kind: value.kind,
    budgetScopeId,
  };
};

export const parseRunSafetyScopeIdentity = (
  value: unknown,
): RunSafetyScopeIdentity | null => {
  if (!isRecord(value)) return null;
  const rootInvocationId = readBoundedString(
    value.rootInvocationId,
    RUN_SAFETY_OPAQUE_ID_MAX_LENGTH,
  );
  const budgetScopeId = readBoundedString(
    value.budgetScopeId,
    RUN_SAFETY_OPAQUE_ID_MAX_LENGTH,
  );
  return rootInvocationId && budgetScopeId
    ? { rootInvocationId, budgetScopeId }
    : null;
};

export const buildRunSafetyTerminationKey = (
  termination: Pick<RunSafetyTermination, 'rootInvocationId' | 'kind'>,
): string => JSON.stringify([termination.rootInvocationId, termination.kind]);
