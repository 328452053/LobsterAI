import { afterEach, expect, test } from 'vitest';

import {
  type RunSafetyTermination,
  RunSafetyTerminationKind,
} from '../../../shared/cowork/runSafety';
import { setLanguage } from '../../i18n';
import { formatRunSafetyTerminationMessage } from './runSafetyTermination';

const createTermination = (
  kind: RunSafetyTermination['kind'],
): RunSafetyTermination => {
  const common = {
    kind,
    rootInvocationId: 'root-1',
    runId: 'run-1',
  };
  return kind === RunSafetyTerminationKind.RunBudgetIdentityMissing
    ? common
    : {
        ...common,
        budgetScopeId: 'scope-1',
      };
};

afterEach(() => {
  setLanguage('zh');
});

test.each(['zh', 'en'] as const)(
  'run-safety messages are deterministic and distinct in %s',
  (language) => {
    setLanguage(language);
    const messages = Object.values(RunSafetyTerminationKind).map((kind) =>
      formatRunSafetyTerminationMessage(createTermination(kind)),
    );

    expect(new Set(messages).size).toBe(messages.length);
    for (const message of messages) {
      expect(message).not.toMatch(/充值|积分|top[\s-]?up|credits?/i);
    }
  },
);

test.each([
  RunSafetyTerminationKind.RunPromptExposureBudget,
  RunSafetyTerminationKind.RunPromptEstimateUnavailable,
])('legacy receive-only prompt terminal %s keeps its localized message', (kind) => {
  const messages = (['zh', 'en'] as const).map((language) => {
    setLanguage(language);
    return formatRunSafetyTerminationMessage(createTermination(kind));
  });

  expect(messages.every(message => message.trim().length > 0)).toBe(true);
  expect(messages[0]).not.toBe(messages[1]);
});
