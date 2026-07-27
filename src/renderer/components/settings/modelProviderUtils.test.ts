import { expect, test } from 'vitest';

import { OpenClawProviderId, ProviderAuthType, ProviderName } from '../../../shared/providers';
import {
  buildOpenAIConnectionTestRequestBody,
  getOpenClawProviderIdForConfig,
  hasEquivalentProviderModelId,
  hasProviderAuthConfigured,
  type ProviderConfig,
  providerRequiresApiKey,
  shouldShowApiFormatSelector,
  supportsKimiK3Compatibility,
} from './modelProviderUtils';

const providerConfig = (overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  enabled: true,
  apiKey: '',
  baseUrl: 'https://api.example.com',
  models: [],
  ...overrides,
});

test('GitHub Copilot does not require a persisted API key', () => {
  expect(providerRequiresApiKey(ProviderName.Copilot)).toBe(false);
});

test('GitHub Copilot OAuth auth is tracked by authType instead of apiKey', () => {
  expect(hasProviderAuthConfigured(
    ProviderName.Copilot,
    providerConfig({ authType: ProviderAuthType.OAuth }),
  )).toBe(true);

  expect(hasProviderAuthConfigured(
    ProviderName.Copilot,
    providerConfig({ apiKey: 'legacy-short-token' }),
  )).toBe(false);
});

test('MiniMax OAuth resolves to the OpenClaw portal provider', () => {
  expect(getOpenClawProviderIdForConfig(
    ProviderName.Minimax,
    providerConfig({ authType: ProviderAuthType.OAuth }),
  )).toBe(OpenClawProviderId.MinimaxPortal);

  expect(getOpenClawProviderIdForConfig(
    ProviderName.Minimax,
    providerConfig({ authType: ProviderAuthType.ApiKey }),
  )).toBe(OpenClawProviderId.Minimax);
});

test('OpenAI OAuth models use the canonical OpenClaw OpenAI provider id', () => {
  expect(getOpenClawProviderIdForConfig(
    ProviderName.OpenAI,
    providerConfig({ authType: ProviderAuthType.OAuth }),
  )).toBe(OpenClawProviderId.OpenAI);
});

test('provider model identity comparison ignores K3 punctuation and casing', () => {
  expect(hasEquivalentProviderModelId(
    [{ id: 'kimi-k3' }],
    ' Kimi_K3 ',
  )).toBe(true);
});

test('provider model identity comparison excludes the model currently being edited', () => {
  expect(hasEquivalentProviderModelId(
    [{ id: 'Kimi_K3' }],
    'kimi.k3',
    'Kimi_K3',
  )).toBe(false);

  expect(hasEquivalentProviderModelId(
    [{ id: 'Kimi_K3' }, { id: 'kimi.k3' }],
    'kimi-k3',
    'Kimi_K3',
  )).toBe(true);
});

test('provider model identity comparison preserves distinct non-K3 punctuation', () => {
  expect(hasEquivalentProviderModelId(
    [{ id: 'foo/bar' }, { id: 'model.v1' }],
    'foo-bar',
  )).toBe(false);
  expect(hasEquivalentProviderModelId(
    [{ id: 'foo/bar' }, { id: 'model.v1' }],
    'model-v1',
  )).toBe(false);
});

test('Kimi K3 compatibility is limited to the effective OpenAI transport', () => {
  expect(supportsKimiK3Compatibility('custom_0', 'openai')).toBe(true);
  expect(supportsKimiK3Compatibility('custom_0', 'anthropic')).toBe(false);
  expect(supportsKimiK3Compatibility(ProviderName.Moonshot, 'anthropic')).toBe(false);
});

test('legacy Moonshot Anthropic configs stay visible and use their real transport', () => {
  expect(shouldShowApiFormatSelector(ProviderName.Moonshot, 'anthropic')).toBe(true);
  expect(shouldShowApiFormatSelector(ProviderName.Moonshot, 'openai')).toBe(false);
});

test('official Moonshot K3 connection test uses the K3 request contract', () => {
  expect(buildOpenAIConnectionTestRequestBody({
    provider: ProviderName.Moonshot,
    providerConfig: { codingPlanEnabled: false },
    model: { id: 'Kimi_K3' },
    effectiveBaseUrl: 'https://api.moonshot.cn/v1',
    useResponsesApi: false,
  })).toEqual({
    model: 'Kimi_K3',
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 64,
    reasoning_effort: 'max',
  });
});

test('explicit custom K3 alias connection test uses the K3 request contract', () => {
  expect(buildOpenAIConnectionTestRequestBody({
    provider: 'custom_0',
    providerConfig: { codingPlanEnabled: false },
    model: {
      id: 'my-kimi-prod',
      compatibilityMode: 'moonshot-kimi-k3',
    },
    effectiveBaseUrl: 'https://proxy.example.com/v1',
    useResponsesApi: false,
  })).toMatchObject({
    model: 'my-kimi-prod',
    max_tokens: 64,
    reasoning_effort: 'max',
  });
});

test('ordinary OpenAI-compatible connection tests retain their existing token field', () => {
  expect(buildOpenAIConnectionTestRequestBody({
    provider: 'custom_0',
    providerConfig: { codingPlanEnabled: false },
    model: { id: 'ordinary-model' },
    effectiveBaseUrl: 'https://proxy.example.com/v1',
    useResponsesApi: false,
  })).toEqual({
    model: 'ordinary-model',
    messages: [{ role: 'user', content: 'Hi' }],
    max_tokens: 64,
  });
});
