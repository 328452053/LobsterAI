export const OpenClawPromptExposureMode = {
  Observe: 'observe',
} as const;

export type OpenClawPromptExposureMode =
  typeof OpenClawPromptExposureMode[keyof typeof OpenClawPromptExposureMode];

export const OPENCLAW_LEGACY_PROMPT_EXPOSURE_BUDGET_FIELD =
  'maxCumulativeEstimatedPromptTokensPerBudgetScope';

export const MANAGED_OPENCLAW_RUN_SAFETY = {
  maxToolCallReservationsPerBudgetScope: 64,
  maxProviderDispatchesPerBudgetScope: 32,
  warningRatio: 0.75,
  promptExposure: {
    mode: OpenClawPromptExposureMode.Observe,
    legacyDiagnosticThreshold: 2_000_000,
  },
} as const;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

export const cloneManagedOpenClawRunSafety = (): Record<string, unknown> => ({
  ...MANAGED_OPENCLAW_RUN_SAFETY,
  promptExposure: {
    ...MANAGED_OPENCLAW_RUN_SAFETY.promptExposure,
  },
});

export const hasManagedOpenClawRunSafety = (config: unknown): boolean => {
  const root = asRecord(config);
  const agents = asRecord(root?.agents);
  const defaults = asRecord(agents?.defaults);
  const runSafety = asRecord(defaults?.runSafety);
  if (!runSafety) return false;

  const promptExposure = asRecord(runSafety.promptExposure);
  const expectedKeys = Object.keys(MANAGED_OPENCLAW_RUN_SAFETY).sort();
  const actualKeys = Object.keys(runSafety).sort();
  const expectedPromptKeys = Object.keys(MANAGED_OPENCLAW_RUN_SAFETY.promptExposure).sort();
  const actualPromptKeys = Object.keys(promptExposure ?? {}).sort();

  return (
    !Object.prototype.hasOwnProperty.call(
      runSafety,
      OPENCLAW_LEGACY_PROMPT_EXPOSURE_BUDGET_FIELD,
    )
    && JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
    && JSON.stringify(actualPromptKeys) === JSON.stringify(expectedPromptKeys)
    && runSafety.maxToolCallReservationsPerBudgetScope
      === MANAGED_OPENCLAW_RUN_SAFETY.maxToolCallReservationsPerBudgetScope
    && runSafety.maxProviderDispatchesPerBudgetScope
      === MANAGED_OPENCLAW_RUN_SAFETY.maxProviderDispatchesPerBudgetScope
    && runSafety.warningRatio === MANAGED_OPENCLAW_RUN_SAFETY.warningRatio
    && promptExposure?.mode === MANAGED_OPENCLAW_RUN_SAFETY.promptExposure.mode
    && promptExposure?.legacyDiagnosticThreshold
      === MANAGED_OPENCLAW_RUN_SAFETY.promptExposure.legacyDiagnosticThreshold
  );
};

export const applyManagedOpenClawRunSafety = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const agents = asRecord(config.agents) ?? {};
  const defaults = asRecord(agents.defaults) ?? {};

  return {
    ...config,
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        runSafety: cloneManagedOpenClawRunSafety(),
      },
    },
  };
};
