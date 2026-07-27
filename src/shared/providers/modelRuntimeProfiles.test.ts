import { describe, expect, test } from 'vitest';

import { OpenClawApi, OpenClawProviderId } from './constants';
import {
  applyModelRuntimeProfileMetadata,
  findKimiK3ReservedCustomParamKeys,
  getModelRuntimeProfileDefinition,
  isOfficialMoonshotChatCompletionsUrl,
  KIMI_K3_RUNTIME_PROFILE,
  ModelCompatibilityMode,
  ModelRuntimeProfile,
  ModelRuntimeProfileSource,
  normalizeModelIdForComparison,
  parseModelCompatibilityMode,
  parseModelRuntimeProfile,
  resolveModelRuntimeProfile,
} from './modelRuntimeProfiles';

const resolve = (
  overrides: Partial<Parameters<typeof resolveModelRuntimeProfile>[0]> = {},
) => resolveModelRuntimeProfile({
  source: ModelRuntimeProfileSource.BuiltIn,
  providerId: OpenClawProviderId.Moonshot,
  modelId: 'kimi-k3',
  api: OpenClawApi.OpenAICompletions,
  baseUrl: 'https://api.moonshot.cn/v1',
  ...overrides,
});

describe('Kimi K3 runtime profile', () => {
  test('matches the controlled OpenClaw profile', () => {
    expect(getModelRuntimeProfileDefinition(ModelRuntimeProfile.MoonshotKimiK3)).toEqual({
      reasoning: true,
      input: ['text', 'image', 'video'],
      contextWindow: 1_048_576,
      maxTokens: 8_192,
      thinkingLevelMap: {
        off: null,
        minimal: 'max',
        low: 'max',
        medium: 'max',
        high: 'max',
        xhigh: 'max',
        max: 'max',
      },
      compat: {
        maxTokensField: 'max_tokens',
        supportsUsageInStreaming: false,
        requiresStringContent: true,
        supportsReasoningEffort: true,
        supportedReasoningEfforts: [
          'minimal',
          'low',
          'medium',
          'high',
          'xhigh',
          'max',
        ],
      },
    });
    expect(KIMI_K3_RUNTIME_PROFILE.maxTokens).toBe(8_192);
  });

  test('parses only controlled persisted values', () => {
    expect(parseModelRuntimeProfile('moonshot-kimi-k3')).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(parseModelRuntimeProfile('unknown')).toBeUndefined();
    expect(parseModelRuntimeProfile({ profile: 'moonshot-kimi-k3' })).toBeUndefined();
    expect(parseModelCompatibilityMode('auto')).toBe(ModelCompatibilityMode.Auto);
    expect(parseModelCompatibilityMode('unknown')).toBeUndefined();
  });
});

describe('model identity and Moonshot URL guards', () => {
  test('normalizes equivalent model IDs without fuzzy matching', () => {
    expect(normalizeModelIdForComparison(' Kimi_K3 ')).toBe('kimik3');
    expect(normalizeModelIdForComparison('kimi.k3')).toBe('kimik3');
    expect(normalizeModelIdForComparison('my-kimi-k3')).toBe('mykimik3');
  });

  test.each([
    'https://api.moonshot.cn/v1',
    'https://api.moonshot.cn/v1/',
    'https://api.moonshot.ai/v1',
    'https://api.moonshot.ai:443/v1',
  ])('accepts official Chat Completions URL %s', (url) => {
    expect(isOfficialMoonshotChatCompletionsUrl(url)).toBe(true);
  });

  test.each([
    'http://api.moonshot.cn/v1',
    'https://api.moonshot.cn.evil.example/v1',
    'https://api.moonshot.cn@evil.example/v1',
    'https://user:pass@api.moonshot.cn/v1',
    'https://api.moonshot.cn:8443/v1',
    'https://api.moonshot.cn/v1/chat/completions',
    'https://api.moonshot.cn/v1?route=proxy',
    'not-a-url',
  ])('rejects non-official or unsafe URL %s', (url) => {
    expect(isOfficialMoonshotChatCompletionsUrl(url)).toBe(false);
  });
});

describe('resolveModelRuntimeProfile', () => {
  test('auto-resolves exact built-in Moonshot K3 on official routes', () => {
    expect(resolve()).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(resolve({ modelId: 'Kimi_K3' })).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(resolve({
      compatibilityMode: ModelCompatibilityMode.Standard,
    })).toBe(ModelRuntimeProfile.MoonshotKimiK3);
  });

  test('fails closed for Coding Plan, aliases, and non-OpenAI transport', () => {
    expect(resolve({ codingPlanEnabled: true })).toBeUndefined();
    expect(resolve({ modelId: 'my-kimi-prod' })).toBeUndefined();
    expect(resolve({ api: OpenClawApi.AnthropicMessages })).toBeUndefined();
  });

  test('requires an explicit profile for non-official built-in Moonshot routes', () => {
    expect(resolve({ baseUrl: 'https://proxy.example.com/v1' })).toBeUndefined();
    expect(resolve({
      baseUrl: 'https://proxy.example.com/v1',
      compatibilityMode: ModelCompatibilityMode.Standard,
    })).toBeUndefined();
    expect(resolve({
      baseUrl: 'https://proxy.example.com/v1',
      compatibilityMode: ModelCompatibilityMode.MoonshotKimiK3,
    })).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(resolve({
      modelId: 'my-kimi-prod',
      baseUrl: 'https://proxy.example.com/v1',
      compatibilityMode: ModelCompatibilityMode.MoonshotKimiK3,
    })).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(resolve({
      modelId: 'my-kimi-prod',
      compatibilityMode: ModelCompatibilityMode.MoonshotKimiK3,
    })).toBeUndefined();
  });

  test('auto-resolves only exact custom K3 IDs', () => {
    expect(resolve({
      source: ModelRuntimeProfileSource.Custom,
      providerId: 'custom_0',
      baseUrl: 'https://proxy.example.com/v1',
    })).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(resolve({
      source: ModelRuntimeProfileSource.Custom,
      providerId: 'custom_0',
      modelId: 'my-kimi-prod',
      baseUrl: 'https://proxy.example.com/v1',
    })).toBeUndefined();
    expect(resolve({
      source: ModelRuntimeProfileSource.Custom,
      providerId: 'custom_0',
      compatibilityMode: ModelCompatibilityMode.Standard,
      baseUrl: 'https://proxy.example.com/v1',
    })).toBeUndefined();
  });

  test('allows explicit K3 compatibility for a custom alias', () => {
    const profile = resolve({
      source: ModelRuntimeProfileSource.Custom,
      providerId: 'custom_9',
      modelId: 'my-kimi-prod',
      baseUrl: 'https://proxy.example.com/v1',
      compatibilityMode: ModelCompatibilityMode.MoonshotKimiK3,
    });

    expect(profile).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(applyModelRuntimeProfileMetadata({
      supportsImage: false,
      supportsThinking: false,
      contextWindow: 200_000,
    }, profile)).toEqual({
      supportsImage: true,
      supportsVideo: true,
      supportsThinking: true,
      contextWindow: 1_048_576,
      maxTokens: 8_192,
    });
  });

  test('accepts only controlled server profiles on the package provider', () => {
    expect(resolve({
      source: ModelRuntimeProfileSource.Server,
      providerId: OpenClawProviderId.LobsteraiServer,
      modelId: 'kimi-k3-YoudaoInner',
      baseUrl: 'http://127.0.0.1:12345/v1',
      serverRuntimeProfile: ModelRuntimeProfile.MoonshotKimiK3,
    })).toBe(ModelRuntimeProfile.MoonshotKimiK3);
    expect(resolve({
      source: ModelRuntimeProfileSource.Server,
      providerId: OpenClawProviderId.LobsteraiServer,
      modelId: 'kimi-k3-YoudaoInner',
      baseUrl: 'http://127.0.0.1:12345/v1',
      serverRuntimeProfile: 'unknown-profile',
    })).toBeUndefined();
  });
});

test('findKimiK3ReservedCustomParamKeys reports only runtime-owned keys', () => {
  expect(findKimiK3ReservedCustomParamKeys({
    reasoning_effort: 'low',
    max_tokens: 4096,
    service_tier: 'priority',
    temperature: 1,
  })).toEqual(['max_tokens', 'reasoning_effort', 'temperature']);
  expect(findKimiK3ReservedCustomParamKeys({ service_tier: 'priority' })).toEqual([]);
});
