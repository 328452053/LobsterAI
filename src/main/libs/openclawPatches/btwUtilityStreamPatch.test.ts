import { describe, expect, test } from 'vitest';

import {
  expectPatchContains,
  readAddedPatchLines,
  readCurrentOpenClawPatchFileDiff,
} from './patchTestUtils';

const patchFile = 'openclaw-varying-args-no-progress-correction-btw-utility.patch';

describe('OpenClaw /btw utility stream patch', () => {
  test('keeps utility fallbacks outside Agent run-safety boundaries', () => {
    const resolverAdded = readAddedPatchLines(
      readCurrentOpenClawPatchFileDiff(
        patchFile,
        'src/agents/embedded-agent-runner/stream-resolution.ts',
      ),
    );

    expect(resolverAdded).toContain(
      'const purpose = params.purpose ?? ProviderStreamPurpose.Agent;',
    );
    expect(resolverAdded).toContain('purpose === ProviderStreamPurpose.Agent &&');
    expectPatchContains(patchFile, [
      'authProfileId: resolvedAuthProfileId,\n+    purpose: ProviderStreamPurpose.Utility,',
      'keeps default Agent fallbacks on boundary transports with runtime auth',
      'keeps utility streamSimple fallbacks outside Agent boundary transports',
      'expect(streamFn).not.toBe(streamSimple);',
      'expect(streamFn).toBe(streamSimple);',
      'purpose: registerProviderStreamForModelMock.mock.calls[0]?.[0]?.purpose,',
    ]);
  });
});
