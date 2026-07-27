import { describe, expect, test } from 'vitest';

import {
  buildRunSafetyTerminationKey,
  parseRunSafetyScopeIdentity,
  parseRunSafetyTermination,
  RunSafetyTerminationKind,
} from './runSafety';

const validTermination = {
  kind: RunSafetyTerminationKind.RunToolBudget,
  rootInvocationId: 'root-1',
  budgetScopeId: 'scope-1',
  runId: 'run-1',
  toolCallReservationCount: 64,
  unknownFutureField: true,
};

describe('run-safety wire parser', () => {
  test('locks all seven wire values and ignores unknown fields', () => {
    expect(Object.values(RunSafetyTerminationKind)).toEqual([
      'variant_no_progress',
      'run_tool_budget',
      'run_provider_dispatch_budget',
      'run_prompt_exposure_budget',
      'run_prompt_estimate_unavailable',
      'run_budget_identity_missing',
      'run_safety_state_unavailable',
    ]);
    expect(parseRunSafetyTermination(validTermination)).toEqual({
      kind: RunSafetyTerminationKind.RunToolBudget,
      rootInvocationId: 'root-1',
      budgetScopeId: 'scope-1',
      runId: 'run-1',
      toolCallReservationCount: 64,
    });
  });

  test('requires trusted root, run, and scope fields', () => {
    expect(parseRunSafetyTermination({
      ...validTermination,
      rootInvocationId: '',
    })).toBeNull();
    expect(parseRunSafetyTermination({
      ...validTermination,
      runId: 42,
    })).toBeNull();
    expect(parseRunSafetyTermination({
      ...validTermination,
      budgetScopeId: undefined,
    })).toBeNull();
    expect(parseRunSafetyTermination({
      ...validTermination,
      providerDispatchCount: -1,
    })).toBeNull();
  });

  test('allows only identity-missing to omit the budget scope', () => {
    expect(parseRunSafetyTermination({
      kind: RunSafetyTerminationKind.RunBudgetIdentityMissing,
      rootInvocationId: 'root-bootstrap',
      runId: 'run-bootstrap',
    })).toEqual({
      kind: RunSafetyTerminationKind.RunBudgetIdentityMissing,
      rootInvocationId: 'root-bootstrap',
      runId: 'run-bootstrap',
    });
    expect(parseRunSafetyTermination({
      kind: RunSafetyTerminationKind.RunBudgetIdentityMissing,
      rootInvocationId: 'root-bootstrap',
      budgetScopeId: 'unexpected-scope',
      runId: 'run-bootstrap',
    })).toBeNull();
  });

  test('parses complete lifecycle scope identities only', () => {
    expect(parseRunSafetyScopeIdentity({
      rootInvocationId: ' root-1 ',
      budgetScopeId: ' scope-1 ',
    })).toEqual({
      rootInvocationId: 'root-1',
      budgetScopeId: 'scope-1',
    });
    expect(parseRunSafetyScopeIdentity({
      rootInvocationId: 'root-1',
    })).toBeNull();
  });

  test('builds an unambiguous root plus kind delivery key', () => {
    expect(buildRunSafetyTerminationKey(
      parseRunSafetyTermination(validTermination)!,
    )).toBe('["root-1","run_tool_budget"]');
  });
});
